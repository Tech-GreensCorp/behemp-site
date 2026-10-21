'use server';

/**
 * A chamada de atendimento com suporte — ADR-0029 §10 (D-12 a D-20; `DO-74`).
 *
 * As três perguntas (`.claude/rules/seguranca-lgpd.md`):
 *   · quem pode ler — o paciente dono do pedido e o admin (`lib/auth/escopo-chamada.ts`), nada além;
 *   · quanto tempo fica — `retencaoAte` existe e fica VAZIO até o Jurídico decidir (D-20);
 *   · é auditado — entrar, encerrar e mandar print ficam em `logs_auditoria`; cada mensagem é uma
 *     linha com autor e hora. Ver o print audita `visualizar` na rota que o entrega.
 *
 * O que NUNCA sai do servidor: a URL do print (o Pusher leva só o id da mensagem), nome, e-mail e
 * ids de usuário (o chat identifica o autor pelo PAPEL).
 */

import { createId } from '@paralleldrive/cuid2';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { chamadasDeAtendimento, logsAuditoria, mensagensDeAtendimento, users } from '@/db/schema';
import { canalDoAtendimento } from '@/lib/atendimento/canal';
import {
  garantirAcessoAoPedido,
  garantirParticipanteDaChamada,
  type PapelNaChamada,
} from '@/lib/auth/escopo-chamada';
import { db } from '@/lib/db';
import { guardarDocumentoPrivado } from '@/lib/documentos/store-privado';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';
import { getPusherServer } from '@/lib/integrations/pusher/server';
import { consumir } from '@/lib/seguranca/limite-de-requisicao';
import { registrarAuditoria } from '@/lib/utils/audit';

interface Resultado<T = undefined> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

interface MensagemNaTela {
  id: string;
  autor: PapelNaChamada;
  texto: string | null;
  temPrint: boolean;
  criadaEm: string;
}

interface Entrada {
  sala: string;
  papel: PapelNaChamada;
  mensagens: MensagemNaTela[];
}

// `.strict()`: campo a mais é recusado, não ignorado.
const entradaDoPedido = z.object({ pedidoId: z.string().min(1).max(64) }).strict();
const entradaDaSala = z.object({ sala: z.string().regex(/^[a-f0-9]{32}$/) }).strict();
const entradaDaMensagem = z
  .object({ sala: z.string().regex(/^[a-f0-9]{32}$/), texto: z.string().trim().min(1).max(2000) })
  .strict();

/** D-18: o print é imagem de tela, e nada mais. Conferido no servidor, pelo conteúdo declarado. */
const TIPOS_DE_PRINT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const TAMANHO_MAXIMO_DO_PRINT = 8 * 1024 * 1024;

/** O começo do arquivo tem de ser mesmo uma imagem daquele tipo: `type` declarado mente fácil. */
function assinaturaConfere(bytes: Uint8Array, tipo: string): boolean {
  const comeca = (...b: number[]) => b.every((v, i) => bytes[i] === v);
  if (tipo === 'image/png') return comeca(0x89, 0x50, 0x4e, 0x47);
  if (tipo === 'image/jpeg') return comeca(0xff, 0xd8, 0xff);
  if (tipo === 'image/webp')
    return (
      comeca(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42
    );
  return false;
}

function paraTela(m: {
  id: string;
  texto: string | null;
  printUrl: string | null;
  createdAt: Date;
  autorRole: string | null;
}): MensagemNaTela {
  return {
    id: m.id,
    autor: m.autorRole === 'admin' ? 'admin' : 'paciente',
    texto: m.texto,
    temPrint: m.printUrl !== null,
    criadaEm: m.createdAt.toISOString(),
  };
}

async function mensagensDa(chamadaId: string): Promise<MensagemNaTela[]> {
  // As 200 MAIS RECENTES, em ordem de conversa (revisão de 30/09/2026: `asc` + `limit` mostrava as
  // primeiras e escondia as últimas depois de 200).
  const linhas = await db
    .select({
      id: mensagensDeAtendimento.id,
      texto: mensagensDeAtendimento.texto,
      printUrl: mensagensDeAtendimento.printUrl,
      createdAt: mensagensDeAtendimento.createdAt,
      autorRole: users.role,
    })
    .from(mensagensDeAtendimento)
    .innerJoin(users, eq(users.id, mensagensDeAtendimento.autorId))
    .where(eq(mensagensDeAtendimento.chamadaId, chamadaId))
    .orderBy(desc(mensagensDeAtendimento.createdAt))
    .limit(200);
  return linhas.reverse().map(paraTela);
}

async function avisarNaSala(sala: string, evento: string, dados: Record<string, unknown>) {
  // O Pusher fora do ar não desfaz o que já foi gravado; a tela recarrega a lista.
  await getPusherServer()
    .trigger(canalDoAtendimento(sala), evento, dados)
    .catch((erro) =>
      console.warn('[atendimento] aviso na sala falhou', { motivo: motivoLegivel(erro) }),
    );
}

function codigoDoErro(erro: unknown): string | undefined {
  const e = erro as { code?: unknown; cause?: { code?: unknown } } | null;
  const codigo = e?.code ?? e?.cause?.code;
  return typeof codigo === 'string' ? codigo : undefined;
}

// ── Entrar no atendimento (paciente ou admin) ──────────────────
export async function entrarNoAtendimento(input: unknown): Promise<Resultado<Entrada>> {
  const entrada = entradaDoPedido.safeParse(input);
  if (!entrada.success) return { sucesso: false, erro: 'Dados inválidos' };

  const escopo = await garantirAcessoAoPedido(entrada.data.pedidoId);
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };

  // Cada entrada grava auditoria: sem teto, recarregar em laço enche o log (revisão de 30/09/2026).
  if (!consumir(`atd-entrar:${escopo.userId}`, 30, 60).permitido) {
    return { sucesso: false, erro: 'Muitas tentativas em pouco tempo. Aguarde um instante.' };
  }

  const aberta = async () => {
    const [c] = await db
      .select()
      .from(chamadasDeAtendimento)
      .where(
        and(
          eq(chamadasDeAtendimento.pedidoId, escopo.pedido.id),
          isNull(chamadasDeAtendimento.encerradaEm),
        ),
      )
      .limit(1);
    return c ?? null;
  };

  let chamada = await aberta();
  if (!chamada) {
    try {
      // D-13: sala de 32 caracteres hexadecimais, do gerador criptográfico.
      [chamada] = await db
        .insert(chamadasDeAtendimento)
        .values({
          pedidoId: escopo.pedido.id,
          sala: crypto.randomUUID().replace(/-/g, ''),
          abertaPor: escopo.userId,
        })
        .returning();
    } catch (erro) {
      // Paciente e admin entrando juntos: o índice parcial deixa UMA aberta, e os dois caem nela.
      if (codigoDoErro(erro) !== '23505') {
        console.error('[atendimento] abrir a chamada falhou', { motivo: motivoLegivel(erro) });
        return { sucesso: false, erro: 'Não conseguimos abrir o atendimento. Tente de novo.' };
      }
      chamada = await aberta();
      if (!chamada)
        return { sucesso: false, erro: 'Não conseguimos abrir o atendimento. Tente de novo.' };
    }
  }

  await db
    .insert(logsAuditoria)
    .values({
      userId: escopo.userId,
      acao: 'ENTRAR_ATENDIMENTO',
      entidade: 'chamadas_de_atendimento',
      entidadeId: chamada.id,
      dadosDepois: { papel: escopo.papel, pedidoId: escopo.pedido.id },
    })
    .catch((erro) =>
      console.warn('[atendimento] auditoria da entrada falhou', { motivo: motivoLegivel(erro) }),
    );

  return {
    sucesso: true,
    dados: { sala: chamada.sala, papel: escopo.papel, mensagens: await mensagensDa(chamada.id) },
  };
}

// ── Mensagem de texto ──────────────────────────────────────────
export async function enviarMensagemNoAtendimento(
  input: unknown,
): Promise<Resultado<MensagemNaTela>> {
  const entrada = entradaDaMensagem.safeParse(input);
  if (!entrada.success) return { sucesso: false, erro: 'Mensagem inválida' };

  const escopo = await garantirParticipanteDaChamada({ sala: entrada.data.sala });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };

  if (!consumir(`atd-msg:${escopo.userId}`, 60, 60).permitido) {
    return { sucesso: false, erro: 'Muitas mensagens em pouco tempo. Aguarde um instante.' };
  }

  const [nova] = await db
    .insert(mensagensDeAtendimento)
    .values({ chamadaId: escopo.chamada.id, autorId: escopo.userId, texto: entrada.data.texto })
    .returning();

  const naTela = paraTela({ ...nova, autorRole: escopo.papel });
  await avisarNaSala(entrada.data.sala, 'chat:mensagem', { ...naTela });
  return { sucesso: true, dados: naTela };
}

// ── Print (imagem de tela) ─────────────────────────────────────
export async function enviarPrintNoAtendimento(
  formulario: FormData,
): Promise<Resultado<MensagemNaTela>> {
  const sala = entradaDaSala.safeParse({ sala: formulario.get('sala') });
  const arquivo = formulario.get('arquivo');
  if (!sala.success || !(arquivo instanceof File))
    return { sucesso: false, erro: 'Dados inválidos' };

  const escopo = await garantirParticipanteDaChamada({ sala: sala.data.sala });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };

  if (!consumir(`atd-print:${escopo.userId}`, 20, 600).permitido) {
    return { sucesso: false, erro: 'Muitos prints em pouco tempo. Aguarde alguns minutos.' };
  }

  const extensao = TIPOS_DE_PRINT[arquivo.type];
  if (!extensao) return { sucesso: false, erro: 'Envie uma imagem PNG, JPG ou WebP.' };
  if (arquivo.size === 0 || arquivo.size > TAMANHO_MAXIMO_DO_PRINT) {
    return { sucesso: false, erro: 'A imagem precisa ter até 8 MB.' };
  }
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!assinaturaConfere(bytes, arquivo.type)) {
    return { sucesso: false, erro: 'Este arquivo não é uma imagem válida.' };
  }

  let url: string;
  try {
    // Store PRIVADO (Item 6): quem tiver a URL sem autenticação não lê nada.
    const guardado = await guardarDocumentoPrivado(
      `atendimento/${escopo.chamada.id}/${createId()}.${extensao}`,
      Buffer.from(bytes),
      { contentType: arquivo.type },
    );
    url = guardado.url;
  } catch (erro) {
    console.error('[atendimento] guardar o print falhou', { motivo: motivoLegivel(erro) });
    return { sucesso: false, erro: 'Não conseguimos enviar o print. Tente de novo.' };
  }

  const [nova] = await db
    .insert(mensagensDeAtendimento)
    .values({
      chamadaId: escopo.chamada.id,
      autorId: escopo.userId,
      printUrl: url,
      printTipo: arquivo.type,
      printBytes: arquivo.size,
    })
    .returning();

  await registrarAuditoria({
    userId: escopo.userId,
    acao: 'criar',
    entidade: 'mensagens_de_atendimento',
    entidadeId: nova.id,
    dadosDepois: { print: true, tipo: arquivo.type, bytes: arquivo.size },
  }).catch(() => {});

  const naTela = paraTela({ ...nova, autorRole: escopo.papel });
  // Só o id: a tela busca a imagem na rota autenticada. A URL do blob nunca entra no evento.
  await avisarNaSala(sala.data.sala, 'chat:mensagem', { ...naTela });
  return { sucesso: true, dados: naTela };
}

// ── Encerrar (admin) ───────────────────────────────────────────
export async function encerrarAtendimento(input: unknown): Promise<Resultado> {
  const entrada = entradaDaSala.safeParse(input);
  if (!entrada.success) return { sucesso: false, erro: 'Dados inválidos' };

  const escopo = await garantirParticipanteDaChamada({ sala: entrada.data.sala });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };
  if (escopo.papel !== 'admin')
    return { sucesso: false, erro: 'Só a equipe encerra o atendimento.' };

  const [encerrada] = await db
    .update(chamadasDeAtendimento)
    .set({ encerradaEm: new Date(), encerradaPor: escopo.userId })
    .where(
      and(
        eq(chamadasDeAtendimento.id, escopo.chamada.id),
        isNull(chamadasDeAtendimento.encerradaEm),
      ),
    )
    .returning({ id: chamadasDeAtendimento.id });
  if (!encerrada) return { sucesso: false, erro: 'Este atendimento já foi encerrado.' };

  await db
    .insert(logsAuditoria)
    .values({
      userId: escopo.userId,
      acao: 'ENCERRAR_ATENDIMENTO',
      entidade: 'chamadas_de_atendimento',
      entidadeId: escopo.chamada.id,
    })
    .catch((erro) =>
      console.warn('[atendimento] auditoria do encerramento falhou', {
        motivo: motivoLegivel(erro),
      }),
    );

  await avisarNaSala(entrada.data.sala, 'chamada:encerrada', {});
  return { sucesso: true };
}
