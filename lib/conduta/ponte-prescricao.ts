/**
 * A ponte da conduta para a prescrição — que PREENCHE e entrega, sem reescrever nada.
 *
 * ADR-0005 D-04: *"A conduta preenche a prescrição e entrega ao fluxo existente. Assinatura,
 * PDF, SNCR e validade permanecem como estão."* O rejeitado R-06 é explícito: reescrever o
 * módulo de receituário é ICP-Brasil em produção.
 *
 * Por isso este módulo é PURO — sem `db`, sem `auth`, sem `next/*`. Ele só traduz um plano
 * terapêutico no formato que `prescricoes.medicamentos` já espera, e é chamado pela action de
 * conduta, que por sua vez chama a `criarPrescricao` que já existe.
 *
 * 🔴 O FORMATO NÃO É INVENTADO AQUI. Ele copia o que `app/(medico)/_actions/prescricao-inline.ts`
 * já grava — `{ nome, dose, forma, posologia, quantidade }` — porque é o que o PDF e a tela do
 * paciente leem. Um formato novo quebraria as duas sem aviso.
 *
 * ⚠️ E É POR ISSO QUE O `medicamentoId` NÃO ENTRA NO JSONB: `prescricoes.medicamentos` é o
 * Item 4 do checklist (JSONB de texto livre, sem FK), está em produção e alimenta PDF assinado
 * e SNCR. Mexer nele exige autorização própria. O vínculo com o catálogo mora em `dosagens`,
 * que é o caminho novo (ADR-0012 D-01).
 */

import { avisoDeReceituario, type TipoReceituario } from './receituario';

/** O JSONB de um medicamento, na forma que o PDF e `/paciente/prescricoes` já leem. */
export interface ItemPrescricaoJsonb {
  nome: string;
  dose: string;
  forma: string;
  posologia: string;
  quantidade: string;
}

export interface RascunhoDePrescricao {
  medicamentos: ItemPrescricaoJsonb[];
  /** O que o `CAN-04` exige para este produto. */
  tipoExigido: TipoReceituario;
  /** O valor que cabe em `prescricaoTipoEnum` hoje. Pode NÃO ser o exigido — ver abaixo. */
  tipoQueOSistemaGrava: 'simples' | 'controle_especial' | 'personalizado';
  /**
   * 🔴 `true` quando o `CAN-04` exige **Notificação de Receita "A"** e o schema não tem esse
   * valor. `prescricaoTipoEnum` é `['simples','controle_especial','personalizado']` — medido em
   * `db/schema/enums.ts:107`. Nesse caso a tela AVISA que o documento precisa ser emitido fora
   * do sistema, em vez de gravar `controle_especial` e deixar parecer que está conforme.
   *
   * Fingir conformidade num receituário controlado é pior que não emitir: o documento existiria,
   * plausível, com o tipo errado. Achado catalogado em `docs/04-LISTA-DE-AFAZERES.md` Item 13.6.
   */
  faltaTipoNoSistema: boolean;
  avisoDoTipo: string;
}

export interface PlanoParaPrescrever {
  medicamentoNome: string;
  gotasPorDia: number;
  mlFrasco: number;
  gotasPorMl: number;
  frequencia: string;
  viaAdministracao: string;
  teorThcPercentual: number | string | null | undefined;
  /** Dias de tratamento previstos; `null` = uso contínuo. */
  duracaoDias?: number | null;
}

/**
 * Monta o rascunho. **Não cria nada** — quem grava é a `criarPrescricao` que já existe, depois
 * de o médico confirmar.
 */
export function montarRascunhoDePrescricao(plano: PlanoParaPrescrever): RascunhoDePrescricao {
  const aviso = avisoDeReceituario(plano.teorThcPercentual);

  const gotas = Math.max(0, Math.round(plano.gotasPorDia));
  const totalGotas = plano.mlFrasco * plano.gotasPorMl;
  const diasDoFrasco = gotas > 0 ? Math.floor(totalGotas / gotas) : 0;

  const item: ItemPrescricaoJsonb = {
    nome: plano.medicamentoNome,
    dose: `${gotas} gota${gotas === 1 ? '' : 's'} por dia`,
    forma: 'Solução oral / extrato',
    posologia: montarPosologia(plano, gotas),
    quantidade: plano.duracaoDias
      ? `${gotas * plano.duracaoDias} gotas (${plano.duracaoDias} dias)`
      : `1 frasco de ${plano.mlFrasco} ml (${diasDoFrasco} dias de uso)`,
  };

  return {
    medicamentos: [item],
    tipoExigido: aviso.tipo,
    // `notificacao_a` não existe no enum: o mais próximo é `controle_especial`, e a UI DIZ isso.
    tipoQueOSistemaGrava: aviso.tipo === 'indeterminado' ? 'simples' : 'controle_especial',
    faltaTipoNoSistema: aviso.tipo === 'notificacao_a',
    avisoDoTipo: aviso.rotulo,
  };
}

function montarPosologia(plano: PlanoParaPrescrever, gotas: number): string {
  const via = plano.viaAdministracao?.trim() || 'sublingual';
  const freq = plano.frequencia?.trim();
  const base = `Tomar ${gotas} gota${gotas === 1 ? '' : 's'} por via ${via}`;
  const comFreq = freq ? `${base}, ${freq}` : base;
  return plano.duracaoDias
    ? `${comFreq}, por ${plano.duracaoDias} dias`
    : `${comFreq} (uso contínuo)`;
}
