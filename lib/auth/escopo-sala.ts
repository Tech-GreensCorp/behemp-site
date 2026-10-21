/**
 * Escopo de objeto para sala de teleconsulta.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * A auditoria da Sprint 1 (20/08/2026) encontrou 7 lugares que verificavam o PAPEL
 * (`verificarMedico`, `verificarPaciente`, `auth()`) e então usavam um identificador vindo
 * do cliente direto no `where`. Papel certo + id alheio é OWASP API1:2023 (BOLA) — o que
 * `.claude/rules/seguranca-lgpd.md` chama de "o risco número um deste projeto".
 *
 * O pior efeito: qualquer usuário autenticado assinava o canal Pusher de uma consulta
 * alheia e negociava WebRTC nela. Diagnóstico completo no Item 11 de
 * `docs/04-LISTA-DE-AFAZERES.md`.
 *
 * POR QUE UM HELPER, E NÃO O `where` REPETIDO
 * A repetição foi a causa da divergência: o mesmo módulo acertava na leitura
 * (`buscarSalaPorRoomId`) e errava na escrita (`pacienteEntrarSala`). Um lugar só para a
 * regra significa um lugar só para consertar quando ela mudar.
 *
 * O guarda `__tests__/guardas/autorizacao-tem-escopo-de-objeto.test.ts` cobra o uso disto
 * — ou de uma conjunção de dono equivalente — em toda função que toca tabela clínica com
 * id vindo do cliente.
 */
import { auth } from '@clerk/nextjs/server';
import { and, eq, isNull } from 'drizzle-orm';

import { medicos, pacientes, teleconsultas, users } from '@/db/schema';
import { db } from '@/lib/db';
import {
  VERSAO_CONSENTIMENTO_IA,
  VERSAO_CONSENTIMENTO_TELECONSULTA,
  consentimentoPodeSerColetado,
} from '@/lib/lgpd/consentimento';

export type PapelNaSala = 'medico' | 'paciente' | 'admin';

export interface SalaAutorizada {
  salaId: string;
  roomId: string;
  medicoId: string;
  pacienteId: string;
  status: string;
  /** `users.id` de quem fez a requisição — é o que a auditoria precisa registrar. */
  userId: string;
  /** Como o requisitante está ligado a ESTA sala. */
  papel: PapelNaSala;
  /** Consentimento LGPD como está NO BANCO, não como o cliente afirma. */
  consentimentoLgpd: boolean;
  /**
   * Consentimento para transcrição por IA — exige os DOIS lados (ADR-0007, `DO-23`).
   * ⚠️ Não governa a videochamada: ela tem base legal própria (LGPD art. 11, II, "f").
   * Governa apenas o envio de áudio ao Google e de texto ao Gemini.
   */
  consentimentoIaLiberado: boolean;
  /**
   * 🔴 Consentimento de **TELECONSULTA** — CFM 2.314/2022 Art. 15 (`CFM-01`). Outra coisa que o
   * de IA: **este bloqueia o atendimento remoto**. `true` também quando a sala foi marcada como
   * emergência médica, a única exceção que o Art. 15 § único admite.
   */
  consentTeleconsultaOk: boolean;
  /** A sala foi aberta sob exceção de emergência? Muda o que a tela mostra e o que se registra. */
  emergenciaMedica: boolean;
}

export type ResultadoEscopo =
  | { ok: true; sala: SalaAutorizada }
  | { ok: false; erro: string; status: 401 | 403 | 404 };

/**
 * Garante que quem faz a requisição é o médico ou o paciente DESTA sala.
 *
 * Aceita a sala por `salaId` (chave interna) ou por `roomId` (código de 6 caracteres que
 * aparece na URL). Admin passa, porque administra a plataforma — e o acesso dele fica
 * registrado pelo `papel: 'admin'` que volta daqui.
 *
 * Devolve união discriminada de propósito: quem chama é obrigado a tratar a recusa, em vez
 * de receber `null` e seguir adiante por engano.
 */
export async function garantirDonoDaSala(
  ref: { salaId: string } | { roomId: string },
): Promise<ResultadoEscopo> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, erro: 'Não autenticado', status: 401 };

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!user) return { ok: false, erro: 'Usuário não encontrado', status: 403 };

  const filtroSala =
    'salaId' in ref ? eq(teleconsultas.id, ref.salaId) : eq(teleconsultas.roomId, ref.roomId);

  const [sala] = await db
    .select({
      id: teleconsultas.id,
      roomId: teleconsultas.roomId,
      medicoId: teleconsultas.medicoId,
      pacienteId: teleconsultas.pacienteId,
      status: teleconsultas.status,
      consentimentoLgpd: teleconsultas.consentimentoLgpd,
      consentimentoPacienteEm: teleconsultas.consentimentoPacienteEm,
      consentimentoMedicoEm: teleconsultas.consentimentoMedicoEm,
      consentimentoVersaoTexto: teleconsultas.consentimentoVersaoTexto,
      consentimentoRevogadoEm: teleconsultas.consentimentoRevogadoEm,
      consentTeleconsultaEm: teleconsultas.consentTeleconsultaEm,
      consentTeleconsultaVersao: teleconsultas.consentTeleconsultaVersao,
      emergenciaMedica: teleconsultas.emergenciaMedica,
    })
    .from(teleconsultas)
    .where(and(filtroSala, isNull(teleconsultas.deletedAt)))
    .limit(1);

  // 404 sem distinguir "não existe" de "não é sua": responder diferente para os dois casos
  // transforma o endpoint num oráculo de enumeração de salas.
  if (!sala) return { ok: false, erro: 'Sala não encontrada', status: 404 };

  // Os DOIS aceites, da versão ATUAL do texto, e não revogados. Aceite de texto antigo não
  // vale: a pessoa consentiu com outro texto.
  const consentimentoIaLiberado =
    Boolean(sala.consentimentoPacienteEm) &&
    Boolean(sala.consentimentoMedicoEm) &&
    !sala.consentimentoRevogadoEm &&
    sala.consentimentoVersaoTexto === VERSAO_CONSENTIMENTO_IA &&
    consentimentoPodeSerColetado();

  // Consentimento de teleconsulta: aceite na versão ATUAL do texto, ou emergência declarada.
  // Aceite de versão antiga não vale — `LGPD-03` (art. 9º §2º): finalidade nova pede aceite novo.
  const consentTeleconsultaOk =
    Boolean(sala.emergenciaMedica) ||
    (Boolean(sala.consentTeleconsultaEm) &&
      sala.consentTeleconsultaVersao === VERSAO_CONSENTIMENTO_TELECONSULTA);

  const base = {
    salaId: sala.id,
    roomId: sala.roomId,
    medicoId: sala.medicoId,
    pacienteId: sala.pacienteId,
    status: sala.status as string,
    userId: user.id,
    consentimentoLgpd: sala.consentimentoLgpd ?? false,
    consentimentoIaLiberado,
    consentTeleconsultaOk,
    emergenciaMedica: Boolean(sala.emergenciaMedica),
  };

  if (user.role === 'admin') {
    return { ok: true, sala: { ...base, papel: 'admin' } };
  }

  if (user.role === 'medico') {
    const [medico] = await db
      .select({ id: medicos.id })
      .from(medicos)
      .where(and(eq(medicos.userId, user.id), eq(medicos.id, sala.medicoId)))
      .limit(1);
    if (medico) return { ok: true, sala: { ...base, papel: 'medico' } };
  }

  if (user.role === 'paciente') {
    const [paciente] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(
        and(
          eq(pacientes.userId, user.id),
          eq(pacientes.id, sala.pacienteId),
          isNull(pacientes.deletedAt),
        ),
      )
      .limit(1);
    if (paciente) return { ok: true, sala: { ...base, papel: 'paciente' } };
  }

  return { ok: false, erro: 'Sala não encontrada', status: 404 };
}
