import { and, asc, eq, exists, inArray, isNull, lte, not, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { consultas, medicos, pacientes, pagamentos, users } from '@/db/schema';
import { db } from '@/lib/db';
import { marcarErroConfirmacao } from '@/lib/agendamento/confirmar-consulta-paga';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';
import { registrarAuditoria } from '@/lib/utils/audit';

/**
 * LIBERAR RESERVAS EXPIRADAS — sem sessão, chamável pela rota do worker das filas.
 *
 * Extraída de `liberarReservasExpiradas` do Inngest (`lib/integrations/inngest/functions.ts`),
 * que nunca rodou em produção (Item 40). O efeito é o MESMO: a consulta vira 'cancelada' (o
 * índice único de horários deixa de tratá-la como ativa e o horário volta a ficar livre), o
 * pagamento vinculado recebe o motivo em `erroConfirmacao`, e o paciente é avisado por e-mail.
 * A auditoria é nova: a versão do Inngest não registrava.
 *
 * 🔴 A TRAVA DA CORRIDA (Parte 2, Fase 4 — Decisão 3). Uma reserva vencida NÃO é liberada se:
 *
 *   1. `consultas.pix_valido_ate > agora` — o PIX gerado ainda pode ser pago. A reserva vence em
 *      30 min, mas um PIX gerado no minuto 29 continua pagável depois disso
 *   2. existe pagamento `em_processamento` — cartão em análise, ou PIX/aprovação aguardando o
 *      webhook. Soft delete NÃO tira a proteção: se há dinheiro em trânsito, o horário fica
 *
 * Liberar nesses casos entregaria o horário a outro paciente, e o pagamento aprovado depois
 * cairia em `pago_sem_horario` (`lib/mercadopago/notificacoes.ts`), com reembolso manual.
 *
 * A seleção e a liberação são UM `UPDATE … WHERE id IN (subquery)`: a janela entre ler e
 * escrever é a de um único comando, não a de duas idas ao banco. ⚠️ Ela não é zero: sob
 * `READ COMMITTED`, o Postgres reavalia o `WHERE` na versão nova da linha de `consultas`
 * (uma confirmação concorrente vence), mas o `NOT EXISTS` em `pagamentos` usa o snapshot do
 * comando. Um pagamento que COMMITA durante este comando não o impede. O caminho que sobra
 * — cobrança criada antes do prazo, gravada depois dele — cai em `pago_sem_horario`, visível
 * ao admin (Fase 4.2).
 *
 * 🔴 ESTE ARQUIVO NÃO PODE TER `'use server'`, E NÃO PODE SER RE-EXPORTADO DE UM QUE TENHA.
 * A função não confere quem chama; como Server Action, qualquer um dispararia os cancelamentos
 * e os e-mails. Guarda: `a-confirmacao-paga-nao-e-action-publica`.
 */

/** Teto por chamada: o worker roda a cada ~60 s, e cada liberação envia um e-mail. */
const LIMITE_POR_CHAMADA = 50;

/**
 * A reserva NÃO tem pagamento em curso (as duas proteções acima). Exportada para que todo
 * caminho que cancela reserva vencida use a MESMA regra.
 */
export function semPagamentoEmCurso(agora: Date): SQL {
  // `and()` só devolve `undefined` sem argumentos; aqui há sempre dois.
  return and(
    or(isNull(consultas.pixValidoAte), lte(consultas.pixValidoAte, agora)),
    not(
      exists(
        db
          .select({ um: sql`1` })
          .from(pagamentos)
          .where(
            and(eq(pagamentos.consultaId, consultas.id), eq(pagamentos.status, 'em_processamento')),
          ),
      ),
    ),
  ) as SQL;
}

function vencida(agora: Date) {
  return and(
    eq(consultas.status, 'reservada'),
    lte(consultas.expiraEm, agora),
    isNull(consultas.deletedAt),
  );
}

export interface ResultadoDaLiberacao {
  /** Reservas canceladas nesta chamada. */
  liberadas: number;
  /** Reservas vencidas que ficaram por causa de PIX pagável ou pagamento em processamento. */
  protegidas: number;
}

export async function liberarReservasExpiradas(
  opcoes: { agora?: Date; limite?: number } = {},
): Promise<ResultadoDaLiberacao> {
  const agora = opcoes.agora ?? new Date();
  const limite = opcoes.limite ?? LIMITE_POR_CHAMADA;

  const [{ protegidas }] = await db
    .select({ protegidas: sql<number>`count(*)::int` })
    .from(consultas)
    .where(and(vencida(agora), not(semPagamentoEmCurso(agora))));

  const liberadas = await db
    .update(consultas)
    .set({ status: 'cancelada', expiraEm: null })
    .where(
      and(
        inArray(
          consultas.id,
          db
            .select({ id: consultas.id })
            .from(consultas)
            .where(and(vencida(agora), semPagamentoEmCurso(agora)))
            .orderBy(asc(consultas.expiraEm))
            .limit(limite),
        ),
        // Repetido no UPDATE: se outra transação mudou a linha (confirmou, cancelou), o
        // Postgres reavalia estas condições na versão nova antes de escrever. ⚠️ Defesa em
        // profundidade: a sabotagem que a remove não ficou vermelha na integração.
        vencida(agora),
        semPagamentoEmCurso(agora),
      ),
    )
    .returning({ id: consultas.id });

  if (liberadas.length === 0) return { liberadas: 0, protegidas };

  // users é referenciado duas vezes (paciente e médico) — alias evita ambiguidade.
  const medicoUsers = alias(users, 'medico_users');
  const avisos = await db
    .select({
      consultaId: consultas.id,
      dataHora: consultas.dataHora,
      pacienteNome: users.nome,
      pacienteEmail: users.email,
      medicoNome: medicoUsers.nome,
    })
    .from(consultas)
    .innerJoin(pacientes, eq(consultas.pacienteId, pacientes.id))
    .innerJoin(users, eq(pacientes.userId, users.id))
    .innerJoin(medicos, eq(consultas.medicoId, medicos.id))
    .innerJoin(medicoUsers, eq(medicoUsers.id, medicos.userId))
    .where(
      inArray(
        consultas.id,
        liberadas.map((l) => l.id),
      ),
    );

  for (const { id } of liberadas) {
    await marcarErroConfirmacao(id, 'Reserva expirada antes da confirmação.');
    await registrarAuditoria({
      userId: null,
      acao: 'atualizar',
      entidade: 'consultas',
      entidadeId: id,
      dadosAntes: { status: 'reservada' },
      dadosDepois: { status: 'cancelada', motivo: 'reserva_expirada' },
    });
  }

  for (const aviso of avisos) {
    try {
      const { enviarEmailReservaExpirada } = await import('@/lib/email/consultas');
      await enviarEmailReservaExpirada({
        pacienteNome: aviso.pacienteNome,
        pacienteEmail: aviso.pacienteEmail,
        medicoNome: aviso.medicoNome,
        dataHora: aviso.dataHora,
      });
    } catch (erro) {
      console.error(`[expirar] reserva ${aviso.consultaId} liberada, mas falhou o e-mail`, {
        motivo: motivoLegivel(erro),
      });
    }
  }

  console.log(`[expirar] ${liberadas.length} liberada(s), ${protegidas} protegida(s)`);
  return { liberadas: liberadas.length, protegidas };
}
