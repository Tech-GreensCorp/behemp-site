/**
 * Guarda do comunicado "Atualização do Programa de Doação" (envio pelo admin + assinatura DocuSign).
 *
 * 🔴 O que ele impede de voltar:
 *   · marcar o comunicado como assinado por causa do que o NAVEGADOR ou o CORPO DO WEBHOOK dizem —
 *     o status vem da API do DocuSign (`consultarStatusDoEnvelope`)
 *   · anexar o documento NÃO assinado a um e-mail, ou o paciente receber o PDF por e-mail
 *   · action do comunicado sem checagem de papel/escopo; paciente ler o de outro
 *   · o PDF sair com campo em branco da carta ([DATA], [TELEFONE]…) ou sem as âncoras da assinatura
 *   · o PDF assinado ser entregue por URL crua do store, ou o `urlPdfAssinado` vazar para a tela
 *   · o item "Documentos" sumir da sidebar do paciente
 *
 * O comportamento (banco real) é provado em `__tests__/integracao/o-comunicado-so-assina-quem-o-docusign-confirma.test.ts`;
 * aqui fica o que é estrutural e as funções puras.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  clientUserIdDoComunicado,
  ehViolacaoDeUnico,
  situacaoPeloStatusDoDocusign,
} from '@/lib/comunicados/puro';
import { REMETENTE_DOCUMENTOS } from '@/lib/comunicados/catalogo';
import {
  montarEmailConfirmacaoPaciente,
  montarEmailDeEnvio,
  montarEmailNotificacaoDocs,
} from '@/lib/email/comunicados';

const RAIZ = join(__dirname, '..', '..');
const ler = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

/** Tira comentários, para a asserção olhar o código e não a explicação do código. */
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('o status vem do DocuSign, nunca do cliente', () => {
  it('traduz os status do envelope', () => {
    expect(situacaoPeloStatusDoDocusign('completed')).toBe('assinado');
    expect(situacaoPeloStatusDoDocusign('Completed')).toBe('assinado');
    expect(situacaoPeloStatusDoDocusign('declined')).toBe('recusado');
    expect(situacaoPeloStatusDoDocusign('voided')).toBe('recusado');
    for (const s of ['created', 'sent', 'delivered', 'signed', 'qualquer-coisa']) {
      expect(situacaoPeloStatusDoDocusign(s)).toBe('pendente');
    }
  });

  it('a rota de retorno NÃO lê o `event` da URL e sincroniza pela API', () => {
    const src = semComentarios(ler('app/api/comunicados/[id]/retorno/route.ts'));
    expect(src).not.toMatch(/searchParams\.get\(\s*['"]event['"]/);
    expect(src).toContain('sincronizarComunicado(');
  });

  it('o webhook entrega ao comunicado SÓ o envelopeId — o status do corpo não decide nada', () => {
    const src = semComentarios(ler('app/api/webhooks/docusign/route.ts'));
    const trecho = src.slice(
      src.indexOf('envelopeIdDoPayload'),
      src.indexOf('const { event, data } = body'),
    );
    expect(trecho).toContain('processarWebhookDoComunicado(envelopeIdDoPayload)');
    expect(trecho).not.toMatch(/body\??\.event|envelopeSummary\??\.status|statusMap/);
  });

  it('só a sincronização muda o status para assinado, e só a partir de pendente', () => {
    const src = semComentarios(ler('lib/comunicados/assinatura.ts'));
    const escritas = src.match(/\.set\(\{\s*status:\s*'assinado'/g) ?? [];
    // só a transição escreve 'assinado'; o resto são retornos, comparações e tipos
    expect(escritas.length).toBe(1);
    const i = src.indexOf("status: 'assinado',\n      docusignStatus");
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, i + 700)).toContain("eq(comunicadosAssinatura.status, 'pendente')");
  });

  it('o identificador do signatário deriva do id da linha', () => {
    expect(clientUserIdDoComunicado('abc')).toBe('comunicado-abc');
  });

  it('reconhece violação de índice único, com e sem o embrulho do Drizzle', () => {
    expect(ehViolacaoDeUnico({ code: '23505' })).toBe(true);
    expect(ehViolacaoDeUnico({ cause: { code: '23505' } })).toBe(true);
    expect(ehViolacaoDeUnico(new Error('x'))).toBe(false);
    expect(ehViolacaoDeUnico(null)).toBe(false);
  });
});

describe('e-mails do fluxo', () => {
  const html = (s: { html: string }) => s.html;

  it('docs@be4hope.org é a caixa de respostas e o destino da notificação, não o remetente', () => {
    expect(REMETENTE_DOCUMENTOS.email).toBe('docs@be4hope.org');
    const src = ler('lib/email/comunicados.ts');
    expect(src).toContain('REMETENTE_DOCUMENTOS');
    expect(semComentarios(src)).toMatch(/sender: sender\(\)/);
    expect(semComentarios(src)).toMatch(/BREVO_FROM_EMAIL/);
  });

  it('só a notificação a docs@ leva anexo — e o paciente recebe link, não arquivo', () => {
    const src = semComentarios(ler('lib/email/comunicados.ts'));
    expect((src.match(/attachment:/g) ?? []).length).toBe(1);
    const fnDocs = src.slice(src.indexOf('export async function enviarEmailNotificacaoDocs'));
    expect(fnDocs).toContain('attachment:');
    const antes = src.slice(0, src.indexOf('export async function enviarEmailNotificacaoDocs'));
    expect(antes).not.toContain('attachment:');
  });

  it('o aviso de envio explica o passo a passo e leva ao sistema', () => {
    const e = montarEmailDeEnvio({
      nome: 'Maria <b>',
      titulo: 'Atualização do Programa de Doação',
    });
    expect(e.assunto).toContain('Atualização do Programa de Doação');
    expect(html(e)).toContain('/paciente/documentos');
    expect(html(e)).toContain('Abrir e assinar');
    expect(html(e)).toContain('assinar');
    expect(html(e)).not.toContain('Maria <b>'); // HTML do nome escapado
    expect(html(e)).toContain('Maria &lt;b&gt;');
  });

  it('a confirmação ao paciente cita a data e aponta para o documento seguro', () => {
    const e = montarEmailConfirmacaoPaciente({
      nome: 'Maria',
      titulo: 'Atualização do Programa de Doação',
      assinadoEmTexto: '15 de outubro de 2026 às 12:30',
    });
    expect(html(e)).toContain('15 de outubro de 2026 às 12:30');
    expect(html(e)).toContain('/paciente/documentos');
  });

  it('a notificação a docs@ traz paciente, documento, data e envelope', () => {
    const e = montarEmailNotificacaoDocs({
      pacienteNome: 'Maria Souza',
      pacienteEmail: 'maria@exemplo.com',
      pacienteId: 'pac1',
      titulo: 'Atualização do Programa de Doação',
      assinadoEmTexto: '15 de outubro de 2026',
      envelopeId: 'env-123',
      nomeDoAnexo: 'x.pdf',
    });
    for (const t of [
      'Maria Souza',
      'maria@exemplo.com',
      'Atualização do Programa de Doação',
      '15 de outubro de 2026',
      'env-123',
      'x.pdf',
    ]) {
      expect(html(e)).toContain(t);
    }
    expect(e.assunto).toContain('Maria Souza');
  });
});

describe('escopo e vazamento', () => {
  const src = semComentarios(ler('app/_actions/comunicados.ts'));
  const acoes = [...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);

  it('as actions existem (a derivação não ficou cega)', () => {
    expect(acoes.length).toBeGreaterThanOrEqual(6);
  });

  it.each(acoes)('%s começa checando quem chama', (nome) => {
    const i = src.indexOf(`export async function ${nome}(`);
    const corpo = src.slice(i, i + 700);
    expect(corpo).toMatch(/adminAtual\(\)|pacienteDaSessao\(\)/);
  });

  it('o paciente só alcança comunicado cujo pacienteId é o da SUA sessão', () => {
    const i = src.indexOf('export async function iniciarAssinaturaDoComunicado');
    expect(src.slice(i)).toContain('eq(comunicadosAssinatura.pacienteId, eu.pacienteId)');
  });

  it('a lista do paciente exclui erro e cancelado (nunca chegaram a ele)', () => {
    const lib = semComentarios(ler('lib/comunicados/assinatura.ts'));
    const i = lib.indexOf('export async function listarParaPaciente');
    expect(lib.slice(i, i + 900)).toContain("['pendente', 'assinado', 'recusado']");
  });

  it('nenhum tipo devolvido às telas carrega a URL do arquivo', () => {
    const lib = ler('lib/comunicados/assinatura.ts');
    for (const tipo of ['ComunicadoParaAdmin', 'ComunicadoParaPaciente']) {
      const i = lib.indexOf(`export interface ${tipo}`);
      const bloco = lib.slice(i, lib.indexOf('}', i));
      expect(bloco).not.toContain('urlPdfAssinado');
    }
  });

  it('o PDF assinado é entregue pela rota autenticada, em store privado, e nunca por URL crua', () => {
    const rota = semComentarios(ler('app/api/comunicados/[id]/arquivo/route.ts'));
    expect(rota).toContain('lerDocumentoPrivado(');
    expect(rota).toContain('registrarAuditoria(');
    expect(rota).toContain('consumir(');
    expect(rota).not.toMatch(/NextResponse\.redirect\(/);
    const lib = semComentarios(ler('lib/comunicados/assinatura.ts'));
    expect(lib).toContain('guardarDocumentoPrivado(');
    expect(lib).not.toMatch(/from '@vercel\/blob'|put\(/);
    for (const tela of [
      'components/paciente/comunicados/ComunicadosParaAssinar.tsx',
      'components/admin/comunicados/CartaoComunicadoDoacao.tsx',
    ]) {
      expect(semComentarios(ler(tela))).not.toContain('urlPdfAssinado');
    }
  });

  it('reiniciar o fluxo NÃO apaga: a função só atualiza a linha e preserva o PDF assinado', () => {
    const lib = semComentarios(ler('lib/comunicados/assinatura.ts'));
    const i = lib.indexOf('export async function reiniciarComunicado');
    const corpo = lib.slice(i, lib.indexOf('// ── Leituras', i));
    expect(corpo).toContain("status: 'cancelado'");
    expect(corpo).toContain("eq(comunicadosAssinatura.status, 'assinado')"); // só sai de assinado
    expect(corpo).toContain('motivoCancelamento');
    expect(corpo).toContain('canceladoPorUserId');
    expect(corpo).toContain('registrarAuditoria(');
    expect(corpo).not.toMatch(/\.delete\(|apagarDocumentoPrivado|urlPdfAssinado:\s*null/);
  });

  it('só o admin reinicia, e o motivo é obrigatório', () => {
    const acoesSrc = semComentarios(ler('app/_actions/comunicados.ts'));
    const i = acoesSrc.indexOf('export async function reiniciarFluxoDoComunicado');
    const corpo = acoesSrc.slice(i, i + 900);
    expect(corpo).toContain('adminAtual()');
    expect(corpo).toContain('motivoSchema');
    expect(acoesSrc).toMatch(/motivoSchema[\s\S]*?\.min\(5/);
  });

  it('o PDF de um fluxo reiniciado só abre para o admin (o paciente recebe 404)', () => {
    const rota = semComentarios(ler('app/api/comunicados/[id]/arquivo/route.ts'));
    expect(rota).toMatch(/status === 'cancelado' && user\.role === 'admin'/);
  });

  it('o paciente não vê comunicado reiniciado (a lista só traz pendente, assinado e recusado)', () => {
    const lib = semComentarios(ler('lib/comunicados/assinatura.ts'));
    const i = lib.indexOf('export async function listarParaPaciente');
    expect(lib.slice(i, i + 900)).not.toContain("'cancelado'");
  });

  it('a migration do reinício só ACRESCENTA colunas', () => {
    const sql = ler('db/migrations/0052_reinicio_do_comunicado.sql');
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|ALTER COLUMN|TRUNCATE/i);
    for (const col of ['cancelado_em', 'cancelado_por_user_id', 'motivo_cancelamento']) {
      expect(sql).toContain(col);
    }
  });

  it('o comunicado alcança o paciente por onde o admin já vê o paciente (aba Documentos) e pela tela Documentos', () => {
    expect(ler('app/(medico)/medico/pacientes/[id]/_components/tab-documentos.tsx')).toContain(
      '<CartaoComunicadoDoacao',
    );
    expect(ler('app/(paciente)/paciente/documentos/page.tsx')).toContain('<ComunicadosParaAssinar');
  });
});

describe('Documentos na sidebar do paciente', () => {
  it('existe um item Documentos apontando para /paciente/documentos', () => {
    const src = ler('components/shared/paciente-sidebar.tsx');
    expect(src).toMatch(/label: 'Documentos', href: '\/paciente\/documentos'/);
  });
});

describe('o banco recusa o segundo envio ativo', () => {
  it('a migration traz o índice único parcial por paciente e tipo', () => {
    const sql = ler('db/migrations/0051_comunicados_assinatura.sql');
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "comunicados_assinatura_ativo_unq".*\("paciente_id","tipo"\) WHERE .*'pendente', 'assinado'/,
    );
  });
});
