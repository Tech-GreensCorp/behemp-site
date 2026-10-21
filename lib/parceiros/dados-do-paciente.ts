/**
 * OS DADOS PESSOAIS QUE O PARCEIRO MANDA, TRADUZIDOS PARA O VOCABULÁRIO DAQUI.
 *
 * 🔴 O que motivou: o paciente digita o RG no formulário da Greens, e o número é o que a
 * PROCURAÇÃO da ANVISA precisa — `app/api/anvisa/procuracao/route.ts:96` lê `pacientes.rg`
 * com `?? ''`, então sem ele o documento sai com o campo **em branco**, sem erro e sem
 * aviso. A Greens manda `rg`, `dataNascimento` e `genero` no corpo do handoff desde
 * 15/09/2026 (`HandoffService.ts:387-393` no repositório deles); o nosso schema não os
 * declarava, e o Zod — que por padrão faz *strip* — os descartava em silêncio.
 *
 * ⚠️ PURO DE PROPÓSITO: sem `db`, sem `auth`, sem `next/*`. A tradução de um vocabulário
 * para o outro se testa sem banco, e é onde o erro de contrato aparece.
 */

/**
 * O VOCABULÁRIO DE GÊNERO DAQUI — medido, não suposto.
 *
 * ⚠️ O comentário da coluna (`db/schema/pacientes.ts:32`) diz `Masculino | Feminino | Outro |
 * Não informado`. Isso é o RÓTULO, não o valor: o `Select` do médico grava
 * `masculino | feminino | outro | nao_informado`
 * (`app/(medico)/medico/pacientes/[id]/page.tsx:286-289`), e `GENERO_LABEL` (`:100`) traduz
 * de volta para a tela. Seguir o comentário gravaria um valor que nenhuma tela reconhece.
 */
export const GENEROS_DAQUI = ['masculino', 'feminino', 'outro', 'nao_informado'] as const;
export type GeneroDaqui = (typeof GENEROS_DAQUI)[number];

/**
 * O enum da Greens (`MedicationRequestPatientGender`, `prisma/schema.prisma`) viaja **sem
 * tradução**, por decisão deles: _"inventar um catálogo de tradução seria uma segunda fonte
 * de verdade para o mesmo dado"_. A tradução, então, é nossa.
 *
 * ⚠️ `NON_BINARY → outro` ACHATA a informação, e isso fica registrado em vez de escondido:
 * o vocabulário daqui não tem `nao_binario`, e criá-lo mudaria o `Select` do médico, a
 * tabela de rótulos e a tela do perfil — trabalho próprio, fora desta correção. `outro` é o
 * valor mais próximo que **já existe**; inventar um que nenhuma tela lê seria pior.
 */
const DA_GREENS: Record<string, GeneroDaqui> = {
  MALE: 'masculino',
  FEMALE: 'feminino',
  NON_BINARY: 'outro',
  PREFER_NOT_TO_SAY: 'nao_informado',
};

/**
 * Traduz o gênero do parceiro. **Valor desconhecido devolve `null`** — nunca um palpite.
 *
 * 🔴 Devolver `null` em vez de recusar a chamada é deliberado: um valor novo do lado deles,
 * amanhã, não pode derrubar o cadastro de um paciente aqui. É a mesma decisão que
 * `normalizarManifesto` já toma com documento desconhecido (`documentos.ts:75`).
 *
 * Aceita também o valor já canônico daqui, porque o mesmo caminho serve a um parceiro que
 * um dia mande no nosso vocabulário.
 */
export function generoDoParceiro(cru: unknown): GeneroDaqui | null {
  if (typeof cru !== 'string') return null;
  const limpo = cru.trim();
  if (!limpo) return null;
  if (DA_GREENS[limpo]) return DA_GREENS[limpo];
  const minusculo = limpo.toLowerCase();
  return (GENEROS_DAQUI as readonly string[]).includes(minusculo)
    ? (minusculo as GeneroDaqui)
    : null;
}

/**
 * O RG como TEXTO, sem exigir padrão.
 *
 * 🔴 Não existe formato nacional de RG: cada UF emite o seu, e há dígito verificador com
 * letra. Exigir máscara recusaria documento legítimo — e recusar o RG de alguém por causa da
 * UF em que ele nasceu é o tipo de regra que ninguém consegue defender depois.
 *
 * O teto de 30 é o mesmo que o formulário do próprio paciente já usa
 * (`app/_actions/perfil-paciente.ts:94`). Uma segunda regra para o mesmo campo seria uma
 * segunda verdade sobre ele.
 *
 * ⚠️ A Greens manda `(pedido.patientRg ?? "").trim()` — ou seja, **string vazia** quando não
 * tem, não `null`. Sem este tratamento, um `''` sobrescreveria um RG bom por nada.
 */
export function rgDoParceiro(cru: unknown): string | null {
  if (typeof cru !== 'string') return null;
  const limpo = cru.trim();
  if (!limpo || limpo.length > 30) return null;
  return limpo;
}

/**
 * A data de nascimento em `YYYY-MM-DD`, que é o formato em que a Greens a manda
 * (`HandoffService.ts:391-393`: `toISOString().slice(0, 10)`) e o que a coluna `date` do
 * Drizzle espera. Os dois lados já concordam; esta função só recusa o que não for isso.
 *
 * ⚠️ Confere se a data EXISTE, não só se o formato casa: `2026-02-31` passa no regex e não
 * é dia nenhum. O Postgres recusaria com `date/time field value out of range`, e a falha
 * apareceria no meio do handoff, não aqui.
 */
export function dataDeNascimentoDoParceiro(cru: unknown): string | null {
  if (typeof cru !== 'string') return null;
  const limpo = cru.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return null;
  const data = new Date(`${limpo}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return null;
  return data.toISOString().slice(0, 10) === limpo ? limpo : null;
}
