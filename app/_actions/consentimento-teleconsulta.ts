'use server';

/**
 * Consentimento para transcrição assistida por IA na teleconsulta.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Até 20/08/2026 o consentimento era um `useState(true)` sem tela — ninguém consentia nada
 * (Item 11 de `docs/04-LISTA-DE-AFAZERES.md`). Decisão na
 * [ADR-0007](../../docs/adr/ADR-0007-consentimento-da-gravacao-de-teleconsulta.md), `DO-23`.
 *
 * 🔴 O QUE ESTE ACEITE BLOQUEIA, E O QUE NÃO BLOQUEIA
 * **Não bloqueia a videochamada** — ela tem base legal própria (LGPD art. 11, II, "f", tutela
 * da saúde em procedimento de profissional de saúde). Quem recusa continua sendo atendido.
 * **Bloqueia a transcrição por IA**, que exige o aceite dos DOIS lados: o áudio capta a voz do
 * médico também, e ele é titular de dado, não só operador do sistema.
 *
 * Fica em `app/_actions/` de propósito: é chamado pela tela do médico E pela do paciente.
 */

import { eq } from 'drizzle-orm';

import { teleconsultas } from '@/db/schema';
import { garantirDonoDaSala } from '@/lib/auth/escopo-sala';
import { db } from '@/lib/db';
import {
  VERSAO_CONSENTIMENTO_IA,
  VERSAO_CONSENTIMENTO_TELECONSULTA,
  consentimentoPodeSerColetado,
  ehRascunho,
} from '@/lib/lgpd/consentimento';
import { registrarAuditoria } from '@/lib/utils/audit';

export interface EstadoConsentimento {
  /** O aceite pode ser pedido neste ambiente? `false` em produção com texto em rascunho. */
  podeSerColetado: boolean;
  pacienteAceitou: boolean;
  medicoAceitou: boolean;
  /** Só com os DOIS a transcrição é liberada. */
  liberado: boolean;
  revogado: boolean;
  /** A versão aceita difere da atual? Então o texto mudou e o aceite precisa ser refeito. */
  versaoDesatualizada: boolean;
  versaoAtual: string;
  ehRascunho: boolean;
}

/** Lê o estado do consentimento da sala. Exige escopo de objeto, como todo acesso à sala. */
export async function buscarEstadoConsentimento(
  salaId: string,
): Promise<{ sucesso: boolean; dados?: EstadoConsentimento; erro?: string }> {
  const escopo = await garantirDonoDaSala({ salaId });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };

  const [sala] = await db
    .select({
      pacienteEm: teleconsultas.consentimentoPacienteEm,
      medicoEm: teleconsultas.consentimentoMedicoEm,
      versao: teleconsultas.consentimentoVersaoTexto,
      revogadoEm: teleconsultas.consentimentoRevogadoEm,
    })
    .from(teleconsultas)
    .where(eq(teleconsultas.id, escopo.sala.salaId))
    .limit(1);

  const revogado = Boolean(sala?.revogadoEm);
  const pacienteAceitou = Boolean(sala?.pacienteEm) && !revogado;
  const medicoAceitou = Boolean(sala?.medicoEm) && !revogado;
  // Texto novo invalida aceite antigo: a pessoa consentiu com outro texto.
  const versaoDesatualizada = Boolean(sala?.versao) && sala?.versao !== VERSAO_CONSENTIMENTO_IA;

  return {
    sucesso: true,
    dados: {
      podeSerColetado: consentimentoPodeSerColetado(),
      pacienteAceitou,
      medicoAceitou,
      liberado:
        pacienteAceitou && medicoAceitou && !versaoDesatualizada && consentimentoPodeSerColetado(),
      revogado,
      versaoDesatualizada,
      versaoAtual: VERSAO_CONSENTIMENTO_IA,
      ehRascunho: ehRascunho(),
    },
  };
}

/**
 * Registra o aceite de quem está chamando, no campo do seu próprio papel.
 *
 * O papel vem do servidor, nunca do cliente — é o que impede um lado de consentir pelo outro,
 * que era exatamente o defeito original (a tela do médico "consentia" pelo paciente).
 */
export async function registrarConsentimentoIa(
  salaId: string,
): Promise<{ sucesso: boolean; dados?: EstadoConsentimento; erro?: string }> {
  const escopo = await garantirDonoDaSala({ salaId });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };

  if (!consentimentoPodeSerColetado()) {
    return {
      sucesso: false,
      erro: 'O texto de consentimento ainda está em revisão jurídica — a transcrição está desativada.',
    };
  }

  // Admin administra a plataforma; não é parte do cuidado, e não consente por ninguém.
  if (escopo.sala.papel !== 'paciente' && escopo.sala.papel !== 'medico') {
    return { sucesso: false, erro: 'Apenas o paciente e o médico da consulta podem consentir' };
  }

  const agora = new Date();
  const campos =
    escopo.sala.papel === 'paciente'
      ? { consentimentoPacienteEm: agora, consentimentoPacientePor: escopo.sala.userId }
      : { consentimentoMedicoEm: agora, consentimentoMedicoPor: escopo.sala.userId };

  await db
    .update(teleconsultas)
    .set({
      ...campos,
      consentimentoVersaoTexto: VERSAO_CONSENTIMENTO_IA,
      // Um novo aceite reabre um consentimento antes revogado.
      consentimentoRevogadoEm: null,
      consentimentoRevogadoPor: null,
    })
    .where(eq(teleconsultas.id, escopo.sala.salaId));

  await registrarAuditoria({
    userId: escopo.sala.userId,
    acao: 'atualizar',
    entidade: 'teleconsultas',
    entidadeId: escopo.sala.salaId,
    dadosDepois: {
      consentimentoIa: 'aceito',
      por: escopo.sala.papel,
      versaoTexto: VERSAO_CONSENTIMENTO_IA,
    },
  });

  return buscarEstadoConsentimento(escopo.sala.salaId);
}

/**
 * Revoga o consentimento (LGPD art. 8º, §5º).
 *
 * ⚠️ Revoga o **aceite** e interrompe transcrição futura. O efeito sobre transcrição e
 * narrativa **já existentes** está em aberto na ADR-0007 D-06 e depende de decisão do dono e
 * do Jurídico: se a narrativa já virou evolução assinada pelo médico, ela é ato clínico e não
 * se apaga. Enquanto não houver decisão, **nada é apagado** — e isto fica dito, em vez de
 * apagado por conta própria.
 */
export async function revogarConsentimentoIa(
  salaId: string,
): Promise<{ sucesso: boolean; dados?: EstadoConsentimento; erro?: string }> {
  const escopo = await garantirDonoDaSala({ salaId });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };

  if (escopo.sala.papel !== 'paciente' && escopo.sala.papel !== 'medico') {
    return { sucesso: false, erro: 'Apenas o paciente e o médico da consulta podem revogar' };
  }

  await db
    .update(teleconsultas)
    .set({ consentimentoRevogadoEm: new Date(), consentimentoRevogadoPor: escopo.sala.userId })
    .where(eq(teleconsultas.id, escopo.sala.salaId));

  await registrarAuditoria({
    userId: escopo.sala.userId,
    acao: 'atualizar',
    entidade: 'teleconsultas',
    entidadeId: escopo.sala.salaId,
    dadosDepois: { consentimentoIa: 'revogado', por: escopo.sala.papel },
  });

  return buscarEstadoConsentimento(escopo.sala.salaId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENTIMENTO DE TELECONSULTA — CFM 2.314/2022, Art. 15 (`CFM-01`)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 Outro consentimento, outra consequência.
 *
 * O de IA bloqueia a IA. **Este bloqueia o atendimento remoto** — é o que a norma exige:
 * *"O paciente ou seu representante legal deverá autorizar o atendimento por telemedicina e a
 * transmissão das suas imagens e dados"*.
 *
 * Só o **paciente** manifesta: a norma nomeia o titular, não o médico. O médico **vê** o estado.
 */
export async function registrarConsentimentoTeleconsulta(
  salaId: string,
): Promise<{ sucesso: boolean; erro?: string }> {
  const escopo = await garantirDonoDaSala({ salaId });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };

  if (!consentimentoPodeSerColetado()) {
    return {
      sucesso: false,
      erro: 'O texto de autorização ainda está em revisão jurídica.',
    };
  }

  // 🔴 Só o paciente. Um médico "autorizando" pelo paciente é exatamente o defeito que a
  // ADR-0007 documenta: inverte o sujeito do consentimento.
  if (escopo.sala.papel !== 'paciente') {
    return {
      sucesso: false,
      erro: 'Somente o paciente pode autorizar o atendimento por telemedicina',
    };
  }

  await db
    .update(teleconsultas)
    .set({
      consentTeleconsultaEm: new Date(),
      consentTeleconsultaPor: escopo.sala.userId,
      consentTeleconsultaVersao: VERSAO_CONSENTIMENTO_TELECONSULTA,
    })
    .where(eq(teleconsultas.id, escopo.sala.salaId));

  // `CFM-01` exige que o aceite faça parte do prontuário. A auditoria com autor e IP é o
  // registro mínimo; a vinculação ao prontuário completo é item aberto no `03`.
  await registrarAuditoria({
    userId: escopo.sala.userId,
    acao: 'criar',
    entidade: 'teleconsultas',
    entidadeId: escopo.sala.salaId,
    dadosDepois: {
      consentimentoTeleconsulta: 'autorizado',
      versaoTexto: VERSAO_CONSENTIMENTO_TELECONSULTA,
      fundamento: 'CFM 2.314/2022 Art. 15',
    },
  });

  return { sucesso: true };
}

/**
 * Abre a sala sob **exceção de emergência médica** — a única que o Art. 15 § único admite.
 *
 * ⚠️ A norma dispensa o **aceite prévio**, não o **registro**. Por isso o motivo é obrigatório:
 * sem ele, "emergência" viraria o caminho de menor resistência para pular o consentimento.
 * Só o médico declara — é juízo clínico.
 */
export async function declararEmergenciaMedica(
  salaId: string,
  motivo: string,
): Promise<{ sucesso: boolean; erro?: string }> {
  const escopo = await garantirDonoDaSala({ salaId });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };

  if (escopo.sala.papel !== 'medico') {
    return { sucesso: false, erro: 'Somente o médico pode declarar emergência médica' };
  }
  if (motivo.trim().length < 10) {
    return { sucesso: false, erro: 'Descreva o motivo da emergência — o registro é obrigatório' };
  }

  await db
    .update(teleconsultas)
    .set({ emergenciaMedica: true, emergenciaMotivo: motivo.trim().slice(0, 2000) })
    .where(eq(teleconsultas.id, escopo.sala.salaId));

  await registrarAuditoria({
    userId: escopo.sala.userId,
    acao: 'atualizar',
    entidade: 'teleconsultas',
    entidadeId: escopo.sala.salaId,
    dadosDepois: {
      emergenciaMedica: true,
      motivo: motivo.trim().slice(0, 500),
      fundamento: 'CFM 2.314/2022 Art. 15 § único',
    },
  });

  return { sucesso: true };
}

export interface EstadoConsentimentoTeleconsulta {
  podeSerColetado: boolean;
  autorizado: boolean;
  /** Aberta sob emergência: o aceite foi dispensado, e isso aparece na tela. */
  emergencia: boolean;
  /** Quem está vendo — decide se a tela pede o aceite ou apenas mostra o estado. */
  souOPaciente: boolean;
  ehRascunho: boolean;
}

/** Estado do consentimento de teleconsulta. É o que decide se a sala abre. */
export async function buscarEstadoConsentTeleconsulta(
  salaId: string,
): Promise<{ sucesso: boolean; dados?: EstadoConsentimentoTeleconsulta; erro?: string }> {
  const escopo = await garantirDonoDaSala({ salaId });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };

  return {
    sucesso: true,
    dados: {
      podeSerColetado: consentimentoPodeSerColetado(),
      autorizado: escopo.sala.consentTeleconsultaOk,
      emergencia: escopo.sala.emergenciaMedica,
      souOPaciente: escopo.sala.papel === 'paciente',
      ehRascunho: ehRascunho(),
    },
  };
}
