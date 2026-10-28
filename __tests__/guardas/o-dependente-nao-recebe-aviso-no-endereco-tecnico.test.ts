/**
 * O DEPENDENTE NÃO RECEBE AVISO NO ENDEREÇO TÉCNICO — ADR-0033 D-04, condição 1.
 *
 * 🔴 O RISCO. O dependente não tem e-mail (P-04 e P-09 de Dryelle), mas `users.email` é `notNull` e único, e
 * 45 joins leem o `users` do paciente. Então ele tem um endereço `dependente-<id>@dependente.invalid` que NÃO
 * EXISTE (`.invalid` é TLD reservado, RFC 2606). Um médico que agende uma consulta para ele dispararia um
 * e-mail para esse endereço, e a falha viria do provedor, no meio do fluxo.
 *
 * ⚠️ POR QUE O FILTRO MORA NA CRIAÇÃO DO CLIENTE: não há um ponto único de envio. Quatro módulos criam o próprio
 * `BrevoClient`. Este guarda DERIVA DO DISCO (Regra 1) toda `new BrevoClient(` de `lib/` e `app/` e exige que
 * ela esteja embrulhada por `comFiltroDeDestinatarios(`. Um quinto módulo de e-mail nasce acusado.
 *
 * ⚠️ O QUE ESTE GUARDA **NÃO** FAZ: não prova que o aviso do dependente chega ao RESPONSÁVEL (P-09). O filtro só
 * impede o envio ao endereço que não existe; o aviso do dependente hoje simplesmente NÃO SAI. Roteá-lo ao
 * responsável é o `destinatarioDoPaciente`, que ainda não existe.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { semComentarios } from './_apoio/codigo';
import {
  DOMINIO_DO_EMAIL_TECNICO,
  ehEmailTecnicoDeDependente,
  emailTecnicoDoDependente,
} from '../../lib/dependentes/regras';
import {
  comFiltroDeDestinatarios,
  corpoSemEnderecosTecnicos,
  semEnderecosTecnicos,
} from '../../lib/email/destinatarios-tecnicos';

const RAIZ = join(__dirname, '..', '..');

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '.next') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, acc);
    else if (/\.(ts|tsx)$/.test(nome)) acc.push(caminho);
  }
  return acc;
}

const PRODUCAO = ['app', 'lib']
  .flatMap((d) => arquivos(join(RAIZ, d)))
  .map((p) => ({
    caminho: relative(RAIZ, p).replace(/\\/g, '/'),
    codigo: semComentarios(readFileSync(p, 'utf8')),
  }));

describe('toda fábrica de cliente de e-mail passa pelo filtro', () => {
  const fabricas = PRODUCAO.flatMap((f) =>
    [...f.codigo.matchAll(/new BrevoClient\(/g)].map((m) => ({
      caminho: f.caminho,
      // O que vem imediatamente antes da chamada: tem de ser `comFiltroDeDestinatarios(`.
      antes: f.codigo.slice(Math.max(0, m.index! - 40), m.index),
    })),
  );

  it('⚠️ VACUIDADE: o guarda enxerga as quatro fábricas que existem', () => {
    expect(fabricas.length, 'não achei as fábricas de BrevoClient').toBeGreaterThanOrEqual(4);
    expect(new Set(fabricas.map((f) => f.caminho)).size).toBeGreaterThanOrEqual(4);
  });

  it('🔴 nenhum `new BrevoClient(` fica sem o `comFiltroDeDestinatarios(`', () => {
    const sem = fabricas
      .filter((f) => !/comFiltroDeDestinatarios\(\s*$/.test(f.antes))
      .map((f) => f.caminho);
    expect(
      sem,
      'cliente de e-mail sem o filtro: o endereço técnico do dependente receberia envio',
    ).toEqual([]);
  });

  it('🔴 ninguém chama a API do Brevo por outro caminho (fetch direto)', () => {
    const onde = PRODUCAO.filter((f) => /api\.brevo\.com/.test(f.codigo)).map((f) => f.caminho);
    expect(onde, 'chamada direta ao Brevo contorna o filtro').toEqual([]);
  });
});

describe('o endereço técnico', () => {
  it('é reconhecido, sem diferenciar caixa nem espaços', () => {
    expect(ehEmailTecnicoDeDependente(emailTecnicoDoDependente('AbC123'))).toBe(true);
    expect(ehEmailTecnicoDeDependente('  Dependente-X@DEPENDENTE.INVALID ')).toBe(true);
  });

  it('é um TLD reservado (.invalid), que nunca entrega', () => {
    expect(DOMINIO_DO_EMAIL_TECNICO.endsWith('.invalid')).toBe(true);
  });

  it('não confunde com e-mail de gente: nem o domínio parecido, nem vazio', () => {
    expect(ehEmailTecnicoDeDependente('mae@dependente.invalid.com')).toBe(false);
    expect(ehEmailTecnicoDeDependente('mae@gmail.com')).toBe(false);
    expect(ehEmailTecnicoDeDependente('')).toBe(false);
    expect(ehEmailTecnicoDeDependente(null)).toBe(false);
  });
});

describe('o filtro EXECUTADO', () => {
  const tecnico = { email: emailTecnicoDoDependente('abc') };
  const mae = { email: 'mae@exemplo.com' };

  it('tira o endereço técnico e mantém o resto', () => {
    expect(semEnderecosTecnicos([tecnico, mae])).toEqual([mae]);
    expect(semEnderecosTecnicos(undefined)).toBeUndefined();
  });

  it('se o ÚNICO destinatário é o técnico, não há o que enviar', () => {
    expect(corpoSemEnderecosTecnicos({ to: [tecnico] })).toBeNull();
    expect(corpoSemEnderecosTecnicos({ to: [] })).toBeNull();
    expect(corpoSemEnderecosTecnicos({})).toBeNull();
  });

  it('cc e bcc também são filtrados', () => {
    const r = corpoSemEnderecosTecnicos({ to: [mae], cc: [tecnico, mae], bcc: [tecnico] });
    expect(r).toEqual({ to: [mae], cc: [mae], bcc: [] });
  });

  it('no cliente embrulhado: o envio ao técnico NÃO chega ao provedor; o envio normal chega', async () => {
    const enviar = vi.fn<(corpo: unknown) => Promise<{ messageId: string }>>(async () => ({
      messageId: 'x',
    }));
    const cliente = comFiltroDeDestinatarios({
      transactionalEmails: { sendTransacEmail: enviar },
    } as never);
    const tx = (cliente as unknown as { transactionalEmails: { sendTransacEmail: typeof enviar } })
      .transactionalEmails;

    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await tx.sendTransacEmail({ to: [tecnico], subject: 'x' } as never);
    expect(enviar).not.toHaveBeenCalled();
    expect(aviso).toHaveBeenCalled();
    // E o log NÃO carrega o endereço: sem PII.
    expect(JSON.stringify(aviso.mock.calls)).not.toContain('dependente-abc');

    await tx.sendTransacEmail({ to: [tecnico, mae], subject: 'y' } as never);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect((enviar.mock.calls[0] as unknown as [{ to: unknown[] }])[0].to).toEqual([mae]);
    aviso.mockRestore();
  });
});
