/**
 * O e-mail de aviso do comunicado CHEGA ao paciente — ou o admin lê POR QUE não chegou.
 *
 * 🔴 Incidente de 19/10/2026: em produção o admin enviou o comunicado e o e-mail de aviso não
 * chegou ao paciente. O envio falhava em silêncio para quem olhava a tela ("falha no serviço de
 * e-mail"), sem dizer se era o remetente `docs@be4hope.org` (ainda não cadastrado no Brevo), a
 * chave ou a rede.
 *
 * O que este guarda impede de voltar:
 *   · o Brevo recusar o remetente docs@ e o paciente ficar sem e-mail — há UMA nova tentativa pelo
 *     remetente que o produto já usa, com docs@ em `replyTo`
 *   · a falha ser engolida sem o motivo (HTTP, código e mensagem do Brevo) — ele vai ao log e ao
 *     cartão do admin, sem dado pessoal
 *   · o aviso sair sem o botão para o site, sem o caminho "menu Documentos → Abrir e assinar",
 *     sem o endereço por extenso e sem a versão em texto
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const brevo = vi.hoisted(() => ({
  chamadas: [] as {
    sender: { email: string; name?: string };
    replyTo?: { email: string };
    to: { email: string }[];
    textContent?: string;
  }[],
  falhasAntesDeFuncionar: 0,
  erro: undefined as unknown,
}));

vi.mock('@getbrevo/brevo', () => ({
  BrevoClient: class {
    transactionalEmails = {
      sendTransacEmail: async (corpo: (typeof brevo.chamadas)[number]) => {
        brevo.chamadas.push(corpo);
        if (brevo.chamadas.length <= brevo.falhasAntesDeFuncionar) throw brevo.erro;
        return { messageId: 'x' };
      },
    };
  },
}));

import {
  descreverErroDoBrevo,
  enviarEmailConfirmacaoPaciente,
  enviarEmailDeEnvio,
  montarEmailDeEnvio,
} from '@/lib/email/comunicados';

const RAIZ = join(__dirname, '..', '..');
const ERRO_DO_REMETENTE = Object.assign(new Error('Bad Request'), {
  statusCode: 400,
  body: { code: 'invalid_parameter', message: 'valid sender email required' },
});
const PACIENTE = { email: 'paciente@exemplo.com.br', nome: 'Maria Souza' };
const TITULO = 'Atualização do Programa de Doação';

beforeEach(() => {
  brevo.chamadas.length = 0;
  brevo.falhasAntesDeFuncionar = 0;
  brevo.erro = undefined;
  process.env.BREVO_API_KEY = 'chave-de-teste';
  process.env.BREVO_FROM_EMAIL = 'tech@be4hope.org';
  process.env.BREVO_FROM_NAME = 'Be4Hope';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('o envio chega ao paciente mesmo se o Brevo recusar o docs@', () => {
  it('caminho feliz: sai por docs@be4hope.org, para o paciente, com docs@ no replyTo', async () => {
    await enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO });
    expect(brevo.chamadas).toHaveLength(1);
    expect(brevo.chamadas[0].sender.email).toBe('docs@be4hope.org');
    expect(brevo.chamadas[0].to).toEqual([{ email: PACIENTE.email, name: PACIENTE.nome }]);
    expect(brevo.chamadas[0].replyTo?.email).toBe('docs@be4hope.org');
  });

  it('o Brevo recusa o remetente docs@: tenta de novo pelo remetente do produto e o e-mail CHEGA', async () => {
    brevo.falhasAntesDeFuncionar = 1;
    brevo.erro = ERRO_DO_REMETENTE;
    await expect(enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO })).resolves.toBeUndefined();
    expect(brevo.chamadas).toHaveLength(2);
    expect(brevo.chamadas[1].sender.email).toBe('tech@be4hope.org');
    expect(brevo.chamadas[1].replyTo?.email).toBe('docs@be4hope.org'); // a resposta continua indo para docs@
    expect(brevo.chamadas[1].to[0].email).toBe(PACIENTE.email);
  });

  it('as duas tentativas recusadas: LANÇA dizendo o motivo de cada uma, sem o e-mail do paciente', async () => {
    brevo.falhasAntesDeFuncionar = 2;
    brevo.erro = ERRO_DO_REMETENTE;
    const erro = await enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO }).catch(
      (e: Error) => e,
    );
    expect(erro).toBeInstanceOf(Error);
    const msg = (erro as Error).message;
    expect(msg).toContain('docs@be4hope.org');
    expect(msg).toContain('tech@be4hope.org');
    expect(msg).toContain('HTTP 400');
    expect(msg).toContain('valid sender email required');
    expect(msg).not.toContain(PACIENTE.email);
    expect(brevo.chamadas).toHaveLength(2); // uma nova tentativa, não um laço
  });

  it('sem remetente alternativo configurado, falha de uma vez com o motivo', async () => {
    delete process.env.BREVO_FROM_EMAIL;
    brevo.falhasAntesDeFuncionar = 1;
    brevo.erro = ERRO_DO_REMETENTE;
    const erro = await enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO }).catch(
      (e: Error) => e,
    );
    expect((erro as Error).message).toContain('valid sender email required');
    expect(brevo.chamadas).toHaveLength(1);
  });

  it('se o alternativo for o próprio docs@, não repete a mesma tentativa', async () => {
    process.env.BREVO_FROM_EMAIL = 'docs@be4hope.org';
    brevo.falhasAntesDeFuncionar = 1;
    brevo.erro = ERRO_DO_REMETENTE;
    await expect(enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO })).rejects.toThrow();
    expect(brevo.chamadas).toHaveLength(1);
  });

  it('sem BREVO_API_KEY diz qual variável falta, em vez de "falha"', async () => {
    delete process.env.BREVO_API_KEY;
    await expect(enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO })).rejects.toThrow(
      /BREVO_API_KEY/,
    );
  });

  it('a confirmação ao paciente tem o mesmo caminho alternativo', async () => {
    brevo.falhasAntesDeFuncionar = 1;
    brevo.erro = ERRO_DO_REMETENTE;
    await enviarEmailConfirmacaoPaciente({
      para: PACIENTE,
      titulo: TITULO,
      assinadoEmTexto: '19 de outubro de 2026',
    });
    expect(brevo.chamadas).toHaveLength(2);
  });
});

describe('o motivo da recusa é legível', () => {
  it('junta HTTP, código e mensagem do Brevo', () => {
    expect(descreverErroDoBrevo(ERRO_DO_REMETENTE)).toBe(
      'HTTP 400 · invalid_parameter · valid sender email required',
    );
  });
  it('erro de rede e erro sem forma conhecida também viram texto', () => {
    expect(descreverErroDoBrevo(new Error('fetch failed'))).toBe('fetch failed');
    expect(descreverErroDoBrevo(null)).toBe('erro desconhecido');
    expect(descreverErroDoBrevo('x'.repeat(500)).length).toBeLessThanOrEqual(200);
  });
  it('o motivo chega ao cartão do admin (emailEnvioErro leva a mensagem real)', () => {
    const src = readFileSync(join(RAIZ, 'lib/comunicados/assinatura.ts'), 'utf8');
    const i = src.indexOf('export async function enviarAvisoPorEmail');
    const corpo = src.slice(i, src.indexOf('// ── Link de assinatura', i));
    expect(corpo).toMatch(/emailEnvioErro:\s*`O e-mail de aviso não foi enviado\. \$\{/);
    expect(corpo).not.toContain('falha no serviço de e-mail).');
  });
});

describe('o conteúdo do aviso', () => {
  const e = montarEmailDeEnvio({ nome: 'Maria <b>Souza', titulo: TITULO });

  it('tem o botão que leva ao site, na seção dos comunicados', () => {
    expect(e.html).toContain('Ler e assinar o comunicado');
    expect(e.html).toMatch(/href="[^"]*\/paciente\/documentos#comunicados"/);
  });

  it('diz onde achar a tela e como assinar, passo a passo', () => {
    for (const t of [
      'menu lateral esquerdo',
      'Documentos',
      'Pendente de assinatura',
      'Abrir e assinar',
      'toque no ícone de menu',
      TITULO,
    ]) {
      expect(e.html).toContain(t);
    }
  });

  it('traz o endereço por extenso (se o botão não abrir) e o contato', () => {
    expect(e.html).toContain('copie e cole este endereço');
    expect(e.html).toContain('(11) 93204-7360');
  });

  it('escapa o nome e não anexa o documento', () => {
    expect(e.html).toContain('Maria &lt;b&gt;Souza');
    expect(e.html).not.toContain('Maria <b>Souza');
    const src = readFileSync(join(RAIZ, 'lib/email/comunicados.ts'), 'utf8');
    const i = src.indexOf('export async function enviarEmailDeEnvio');
    expect(
      src.slice(i, src.indexOf('export async function enviarEmailConfirmacaoPaciente')),
    ).not.toContain('attachment');
  });

  it('tem a versão em texto puro (melhora a entrega e serve a quem não vê HTML)', () => {
    expect(e.texto).toContain('/paciente/documentos#comunicados');
    expect(e.texto).toContain('"Documentos"');
    expect(e.texto).toContain('Abrir e assinar');
    expect(e.texto).toContain('Maria <b>Souza'); // texto puro não escapa HTML
  });

  it('o envio manda as duas versões ao Brevo', async () => {
    await enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO });
    expect(brevo.chamadas[0].textContent).toContain('Abrir e assinar');
  });

  it('a seção do site que o botão aponta existe (id="comunicados")', () => {
    const tela = readFileSync(
      join(RAIZ, 'components/paciente/comunicados/ComunicadosParaAssinar.tsx'),
      'utf8',
    );
    expect(tela).toContain('id="comunicados"');
  });
});
