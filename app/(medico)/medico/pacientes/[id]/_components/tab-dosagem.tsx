'use client';

/**
 * A aba de dosagem do prontuário — agora a superfície da CONDUTA e da TITULAÇÃO.
 *
 * 🔴 O QUE MUDOU EM 24/08/2026, E POR QUÊ (`DO-48`)
 * Esta tela gravava a dosagem em TEXTO LIVRE (`"Ex: 20mg 2x/dia"`), sem vínculo com o produto do
 * catálogo, e permitia **editar** e **excluir** ajuste — sendo que a edição fazia `DELETE` físico
 * dos itens antes de reinserir. Nenhum dos três sustenta o `CAN-03` (nome e concentração do
 * produto na prescrição) nem o `CAN-04` (tipo de receituário derivado do teor de THC).
 *
 * O dono decidiu a opção B, entre três apresentadas: *"Vamos na opção B."* — as duas convivem, e
 * a antiga vira **somente leitura** do histórico.
 *
 * Então, nesta tela:
 * · o caminho novo (`PainelTitulacao`) é o único que aceita dado novo;
 * · o histórico já digitado continua **visível e íntegro**, colapsado, marcado como texto livre;
 * · **saíram** "Novo Ajuste", "Editar" e "Excluir".
 *
 * ⚠️ NENHUMA LINHA DO BANCO FOI TOCADA e nenhuma action foi removida do módulo — as
 * `editarAjusteDosagem`/`excluirAjusteDosagem` continuam existindo e estão catalogadas em
 * `docs/04-LISTA-DE-AFAZERES.md` Item 13.4. Esta tela apenas deixou de chamá-las.
 *
 * 🔴 UMA ABA, NÃO DUAS. O prontuário já tem 10 abas; uma 11ª contrariaria o `DO-44` (d)
 * — *"nada muito cheio pra nao bagunçar a mente do médico"*.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pill } from 'lucide-react';
import { toast } from 'sonner';

import {
  ajustarDose,
  criarConduta,
  listarCatalogoDeProdutos,
  listarTitulacaoDoPaciente,
  prepararPrescricaoDaConduta,
  type ProdutoDoCatalogo,
} from '@/app/(medico)/_actions/conduta';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PainelTitulacao } from '@/components/conduta/PainelTitulacao';
import { PontePrescricao, type RascunhoParaConfirmar } from '@/components/conduta/PontePrescricao';
import type { PassoDaCurva } from '@/components/conduta/CurvaDeTitulacao';
import type { ValoresDaConduta } from '@/components/conduta/FormConduta';
import type { PlanoVigenteDados } from '@/components/conduta/PlanoVigente';
import { listarAjustesDosagem } from '@/app/_actions/ajustes-dosagem';
import { criarPrescricao } from '@/app/(medico)/_actions/prescricoes';

interface TabDosagemProps {
  pacienteId: string;
}

export function TabDosagem({ pacienteId }: TabDosagemProps) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [planos, setPlanos] = useState<PlanoVigenteDados[]>([]);
  const [curva, setCurva] = useState<PassoDaCurva[]>([]);
  const [produtos, setProdutos] = useState<ProdutoDoCatalogo[]>([]);
  const [legado, setLegado] = useState<AjusteLegado[]>([]);
  const [nome, setNome] = useState<string | null>(null);
  // A ponte para a prescrição: o rascunho fica no estado até o médico confirmar (ADR-0005 D-04).
  const [rascunho, setRascunho] = useState<RascunhoParaConfirmar | null>(null);
  const [emitindo, setEmitindo] = useState(false);

  // ⚠️ Sem `setCarregando(true)` aqui: o estado já nasce `true`, e um setState SÍNCRONO no
  // corpo do effect dispara render em cascata no React 19 (react-hooks/set-state-in-effect).
  const carregar = useCallback(async () => {
    const [titulacao, catalogo, antigos] = await Promise.all([
      listarTitulacaoDoPaciente(pacienteId),
      listarCatalogoDeProdutos(),
      listarAjustesDosagem(pacienteId),
    ]);

    if (titulacao.sucesso) {
      setPlanos(titulacao.dados.planosVigentes as PlanoVigenteDados[]);
      setCurva(titulacao.dados.curva);
      setNome(titulacao.dados.pacienteNome);
    } else {
      toast.error(titulacao.erro);
    }

    if (catalogo.sucesso) setProdutos(catalogo.dados);
    if (antigos?.sucesso && Array.isArray(antigos.dados)) {
      setLegado(antigos.dados as AjusteLegado[]);
    }
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleCriarConduta(v: ValoresDaConduta) {
    setSalvando(true);
    const res = await criarConduta({
      pacienteId,
      medicamentoId: v.medicamentoId,
      gotasPorDia: v.gotasPorDia,
      mlFrasco: v.mlFrasco,
      dataInicio: v.data,
      frequencia: v.frequencia,
      viaAdministracao: v.viaAdministracao,
      teorThcInformado: v.teorThcInformado || null,
    });
    setSalvando(false);

    if (!res.sucesso) {
      toast.error(res.erro);
      return;
    }
    toast.success(`Conduta registrada · ${res.dados.avisoReceituario}`);
    await carregar();
  }

  async function handleAjustarDose(v: ValoresDaConduta, plano: PlanoVigenteDados) {
    setSalvando(true);
    const res = await ajustarDose({
      pacienteId,
      dosagemAnteriorId: plano.dosagemId,
      medicamentoId: v.medicamentoId,
      gotasPorDia: v.gotasPorDia,
      mlFrasco: v.mlFrasco,
      dataAjuste: v.data,
      proximaRevisao: v.proximaRevisao || null,
      motivoAjuste: v.motivoAjuste,
      frequencia: v.frequencia,
      viaAdministracao: v.viaAdministracao,
      teorThcInformado: v.teorThcInformado || null,
      gerarPrescricaoNova: v.gerarPrescricaoNova,
    });
    setSalvando(false);

    if (!res.sucesso) {
      toast.error(res.erro);
      return;
    }
    // O paciente é notificado pela action, sem exceção (`DO-44` b) — a tela só confirma.
    toast.success('Ajuste registrado. O paciente foi notificado.');
    if (res.dados.aviso) toast.warning(res.dados.aviso, { duration: 9000 });
    await carregar();
  }

  // ── A ponte para a prescrição (ADR-0005 D-04) ────────────────────────────────
  // Preparar NÃO grava: devolve o rascunho para o médico conferir. Quem grava é a
  // `criarPrescricao` que já existe — o fluxo de assinatura, PDF e SNCR não é tocado.
  async function handlePrescrever(plano: PlanoVigenteDados) {
    const res = await prepararPrescricaoDaConduta(plano.dosagemId);
    if (!res.sucesso) {
      toast.error(res.erro);
      return;
    }
    setRascunho(res.dados as RascunhoParaConfirmar);
  }

  async function handleConfirmarPrescricao() {
    if (!rascunho) return;
    setEmitindo(true);
    const res = await criarPrescricao({
      pacienteId,
      tipo: rascunho.tipoQueOSistemaGrava,
      medicamentos: rascunho.medicamentos,
      validadeDias: 30,
    });
    setEmitindo(false);

    if (!res?.sucesso) {
      toast.error(res?.erro ?? 'Erro ao emitir a prescrição');
      return;
    }
    setRascunho(null);
    toast.success('Prescrição emitida.');
    if (rascunho.faltaTipoNoSistema) {
      toast.warning(
        'A Notificação de Receita "A" exigida pelo CAN-04 precisa ser emitida fora do sistema.',
        { duration: 12000 },
      );
    }
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={32} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PontePrescricao
        rascunho={rascunho}
        emitindo={emitindo}
        onFechar={() => setRascunho(null)}
        onConfirmar={handleConfirmarPrescricao}
      />
      <PainelTitulacao
        pacienteNome={nome}
        planosVigentes={planos}
        curva={curva}
        produtos={produtos}
        salvando={salvando}
        onCriarConduta={handleCriarConduta}
        onAjustarDose={handleAjustarDose}
        onPrescrever={handlePrescrever}
        historicoLegado={legado.length > 0 ? <HistoricoLegado ajustes={legado} /> : undefined}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// O HISTÓRICO LEGADO — leitura, e só (`DO-48`)
// ═══════════════════════════════════════════════════════════════════════════════

interface AjusteLegado {
  id: string;
  dataAjuste: string;
  proximaRevisao: string | null;
  motivoAjuste: string;
  itens?: Array<{
    tipoCanabinoide: string;
    novaDosagem: string;
    dosagemAnterior: string | null;
    frequencia: string;
    viaAdministracao: string | null;
    medicamentoId?: string | null;
  }>;
}

/**
 * Mostra o que foi digitado antes da Sprint 5. **Sem nenhum botão de mutação.**
 *
 * As linhas com `medicamentoId` vieram do caminho novo e já aparecem na curva acima — para não
 * mostrar o mesmo ajuste duas vezes, só o que é de fato legado entra aqui.
 */
function HistoricoLegado({ ajustes }: { ajustes: AjusteLegado[] }) {
  const somenteLegado = ajustes.filter((a) => (a.itens ?? []).some((i) => !i.medicamentoId));

  if (somenteLegado.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-3 text-sm">
        Nenhum registro anterior em texto livre.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        Estes registros foram digitados em texto livre, sem vínculo com produto do catálogo. Ficam
        preservados para consulta e não recebem dado novo — a partir de agora todo ajuste passa pela
        conduta acima.
      </p>
      {somenteLegado.map((a) => (
        <Card key={a.id} className="bg-muted/20 border-0 shadow-sm">
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill size={14} className="text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">{formatarData(a.dataAjuste)}</span>
              <Badge variant="outline" className="text-muted-foreground font-normal">
                texto livre
              </Badge>
            </div>
            {(a.itens ?? [])
              .filter((i) => !i.medicamentoId)
              .map((i, idx) => (
                <p key={idx} className="text-muted-foreground font-mono text-xs">
                  {i.tipoCanabinoide} · {i.novaDosagem}
                  {i.frequencia ? ` · ${i.frequencia}` : ''}
                  {i.viaAdministracao ? ` · ${i.viaAdministracao}` : ''}
                </p>
              ))}
            <p className="text-muted-foreground text-xs">
              <span className="text-foreground/70 font-medium">Motivo:</span> {a.motivoAjuste}
            </p>
            {a.proximaRevisao && (
              <p className="text-muted-foreground font-mono text-[0.7rem]">
                próxima revisão anotada: {formatarData(a.proximaRevisao)}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatarData(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
}
