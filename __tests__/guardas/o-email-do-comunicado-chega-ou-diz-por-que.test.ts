/**
 * O e-mail de aviso do comunicado CHEGA ao paciente — ou o admin lê POR QUE não chegou.
 *
 * 🔴 Incidente de 19/10/2026: em produção o admin enviou o comunicado e o e-mail de aviso não
 * chegou ao paciente. O envio falhava em silêncio para quem olhava a tela ("falha no serviço de
 * e-mail"), sem dizer se era o remetente `docs@be4hope.org` (ainda não cadastrado no Brevo), a
 * chave ou a rede.
 *
 * O que este guarda impede de voltar:
 *   · o fluxo enviar por `docs@be4hope.org` como REMETENTE — o remetente é o padrão do produto
 *     (`BREVO_FROM_EMAIL`), o mesmo que já entrega os outros e-mails; `docs@` só recebe as respostas
 *     e a notificação de conclusão
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
  enviarEmailNotificacaoDocs,
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

describe('o remetente é o PADRÃO do produto, o que já entrega em produção', () => {
  it('sai pelo BREVO_FROM_EMAIL, nunca por docs@, com docs@ só como destino das respostas', async () => {
    await enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO });
    expect(brevo.chamadas).toHaveLength(1);
    expect(brevo.chamadas[0].sender).toEqual({ email: 'tech@be4hope.org', name: 'Be4Hope' });
    expect(brevo.chamadas[0].replyTo?.email).toBe('docs@be4hope.org');
    expect(brevo.chamadas[0].to).toEqual([{ email: PACIENTE.email, name: PACIENTE.nome }]);
  });

  it('sem variáveis de ambiente usa o mesmo padrão de lib/email/brevo.ts (tech@be4hope.org)', async () => {
    delete process.env.BREVO_FROM_EMAIL;
    delete process.env.BREVO_FROM_NAME;
    await enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO });
    expect(brevo.chamadas[0].sender).toEqual({ email: 'tech@be4hope.org', name: 'Be4Hope' });
  });

  it('o remetente configurado em produção vale, e é o MESMO das outras mensagens do fluxo', async () => {
    process.env.BREVO_FROM_EMAIL = 'contato@be4hope.org';
    process.env.BREVO_FROM_NAME = 'Be4Hope Teste';
    await enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO });
    await enviarEmailConfirmacaoPaciente({
      para: PACIENTE,
      titulo: TITULO,
      assinadoEmTexto: '19 de outubro de 2026',
    });
    for (const c of brevo.chamadas) {
      expect(c.sender).toEqual({ email: 'contato@be4hope.org', name: 'Be4Hope Teste' });
    }
  });

  it('a notificação de conclusão chega a docs@ (destinatário), enviada pelo remetente padrão', async () => {
    await enviarEmailNotificacaoDocs({
      pacienteNome: 'Maria',
      pacienteEmail: PACIENTE.email,
      pacienteId: 'p1',
      titulo: TITULO,
      assinadoEmTexto: '19 de outubro de 2026',
      envelopeId: 'env-1',
      pdfAssinado: Buffer.from('%PDF'),
      nomeDoAnexo: 'x.pdf',
    });
    expect(brevo.chamadas[0].to[0].email).toBe('docs@be4hope.org');
    expect(brevo.chamadas[0].sender.email).toBe('tech@be4hope.org');
  });

  it('o código não usa docs@ como remetente em lugar nenhum', () => {
    const src = readFileSync(join(RAIZ, 'lib/email/comunicados.ts'), 'utf8');
    const semComentarios = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    // sender: sempre a função sender(), que lê o ambiente; nunca o REMETENTE_DOCUMENTOS
    expect(semComentarios).not.toMatch(/sender:\s*\{?\s*(name|email)?[^}]*REMETENTE_DOCUMENTOS/);
    expect(semComentarios).toMatch(/const sender = \(\) => \(\{[\s\S]*?BREVO_FROM_EMAIL/);
    expect(semComentarios).toMatch(/sender: sender\(\)/);
  });

  it('o Brevo recusa: LANÇA dizendo o motivo, sem o e-mail do paciente, e sem repetir o envio', async () => {
    brevo.falhasAntesDeFuncionar = 1;
    brevo.erro = ERRO_DO_REMETENTE;
    const erro = await enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO }).catch(
      (e: Error) => e,
    );
    expect(erro).toBeInstanceOf(Error);
    const msg = (erro as Error).message;
    expect(msg).toContain('HTTP 400');
    expect(msg).toContain('valid sender email required');
    expect(msg).not.toContain(PACIENTE.email);
    expect(brevo.chamadas).toHaveLength(1);
  });

  it('sem BREVO_API_KEY diz qual variável falta, em vez de "falha"', async () => {
    delete process.env.BREVO_API_KEY;
    await expect(enviarEmailDeEnvio({ para: PACIENTE, titulo: TITULO })).rejects.toThrow(
      /BREVO_API_KEY/,
    );
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
