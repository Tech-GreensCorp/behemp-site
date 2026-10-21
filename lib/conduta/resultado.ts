/**
 * Reexportação, não cópia.
 *
 * `interface ActionResult` está duplicada em 10+ arquivos deste repositório (Prioridade 3 do
 * `03-CHECKLIST-MESTRE.md`), e cada cópia divergiu: umas têm `dados`, outras `data`. O módulo
 * de IA clínica já declarou a forma canônica uma vez; a conduta não vira a 11ª cópia.
 *
 * O reexport existe só para que o ponto de uso leia `@/lib/conduta/resultado` — importar
 * `@/lib/ia-clinica/resultado` numa action de prescrição diria uma coisa que não é verdade.
 *
 * ⚠️ Quando as 10+ cópias forem unificadas (trabalho próprio, catalogado), o alvo deste
 * reexport muda em UMA linha.
 */
export { ok, falha, type ResultadoAction, type ResultadoSimples } from '@/lib/ia-clinica/resultado';
