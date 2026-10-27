/**
 * QUEM PODE LER UM EXAME DE PACIENTE.
 *
 * Irmão de `escopo-documento.ts`. Exame não está em `documentos` — tem tabela própria e nenhum
 * vínculo era conferido: `verificarMedicoOuAdmin()` só olha o PAPEL, e papel certo com id
 * alheio é OWASP API1 (BOLA). A pergunta "este médico é o DESTE paciente?" já tem resposta em
 * `garantirMedicoDoPaciente`; aqui só se descobre o paciente a partir do exame.
 *
 * ⚠️ Tudo o que não pode responde 404, nunca 403 — 403 transforma a rota em oráculo de
 * enumeração.
 */

import { and, eq, isNull } from 'drizzle-orm';

import { exames } from '@/db/schema';
import { garantirMedicoDoPaciente } from '@/lib/auth/escopo-paciente';
import { db } from '@/lib/db';

export type ResultadoDeLeituraDoExame =
  | {
      ok: true;
      exame: { id: string; urlArquivo: string; nomeArquivo: string | null };
      userId: string;
    }
  | { ok: false; status: 404; erro: string };

const NAO_ENCONTRADO = { ok: false, status: 404, erro: 'Exame não encontrado' } as const;

export async function garantirLeitorDoExame(exameId: string): Promise<ResultadoDeLeituraDoExame> {
  const [exame] = await db
    .select({
      id: exames.id,
      pacienteId: exames.pacienteId,
      urlArquivo: exames.urlArquivo,
      nomeArquivo: exames.nomeArquivo,
    })
    .from(exames)
    .where(and(eq(exames.id, exameId), isNull(exames.deletedAt)))
    .limit(1);
  if (!exame || !exame.urlArquivo) return NAO_ENCONTRADO;

  const escopo = await garantirMedicoDoPaciente(exame.pacienteId);
  if (!escopo.ok) return NAO_ENCONTRADO;

  return {
    ok: true,
    exame: { id: exame.id, urlArquivo: exame.urlArquivo, nomeArquivo: exame.nomeArquivo },
    userId: escopo.escopo.userId,
  };
}
