'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  criarAjusteDosagem,
  editarAjusteDosagem,
  excluirAjusteDosagem,
  listarAjustesDosagem,
} from '@/app/_actions/ajustes-dosagem';
import { toast } from 'sonner';
import {
  Loader2,
  Pencil,
  Pill,
  Plus,
  Trash2,
} from 'lucide-react';

const ITEM_VAZIO = {
  tipoCanabinoide: '', novaDosagem: '', dosagemAnterior: '',
  frequencia: '', concentracaoTHC: '', concentracaoCBD: '', viaAdministracao: '',
};

interface TabDosagemProps { pacienteId: string }

export function TabDosagem({ pacienteId }: TabDosagemProps) {
  const [ajustes, setAjustes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // ── Estado do formulário (criação ou edição) ─────────────────
  const [modoForm, setModoForm] = useState<'nenhum' | 'criar' | 'editar'>('nenhum');
  const [ajusteEmEdicao, setAjusteEmEdicao] = useState<string | null>(null);
  const [dataAjuste, setDataAjuste] = useState('');
  const [proximaRevisao, setProximaRevisao] = useState('');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);

  // ── Estado de exclusão ────────────────────────────────────────
  const [ajusteParaExcluir, setAjusteParaExcluir] = useState<{ id: string; data: string } | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarAjustesDosagem(pacienteId);
    if (res.sucesso && res.dados) setAjustes(res.dados);
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Helpers de itens ──────────────────────────────────────────
  function addItem() { setItens(p => [...p, { ...ITEM_VAZIO }]); }
  function removeItem(idx: number) { setItens(p => p.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, campo: string, valor: string) {
    setItens(p => p.map((item, i) => i === idx ? { ...item, [campo]: valor } : item));
  }

  function resetForm() {
    setModoForm('nenhum');
    setAjusteEmEdicao(null);
    setDataAjuste(''); setProximaRevisao(''); setMotivoAjuste('');
    setItens([{ ...ITEM_VAZIO }]);
  }

  // ── Abrir edição preenchendo o form com dados existentes ──────
  function abrirEdicao(aj: any) {
    setModoForm('editar');
    setAjusteEmEdicao(aj.id);
    setDataAjuste(aj.dataAjuste ?? '');
    setProximaRevisao(aj.proximaRevisao ?? '');
    setMotivoAjuste(aj.motivoAjuste ?? '');
    setItens(
      aj.itens?.length > 0
        ? aj.itens.map((it: any) => ({
            tipoCanabinoide: it.tipoCanabinoide ?? '',
            novaDosagem: it.novaDosagem ?? '',
            dosagemAnterior: it.dosagemAnterior ?? '',
            frequencia: it.frequencia ?? '',
            concentracaoTHC: it.concentracaoTHC ?? '',
            concentracaoCBD: it.concentracaoCBD ?? '',
            viaAdministracao: it.viaAdministracao ?? '',
          }))
        : [{ ...ITEM_VAZIO }],
    );
    // Rolar suavemente até o topo do formulário
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  // ── Salvar (criação ou edição) ────────────────────────────────
  async function handleSalvar() {
    if (!dataAjuste || !motivoAjuste || !itens[0]?.tipoCanabinoide) {
      toast.error('Preencha os campos obrigatórios: Data, Motivo e ao menos 1 medicamento');
      return;
    }
    setSalvando(true);
    try {
      let res;
      if (modoForm === 'editar' && ajusteEmEdicao) {
        res = await editarAjusteDosagem({
          ajusteId: ajusteEmEdicao,
          dataAjuste, proximaRevisao: proximaRevisao || undefined, motivoAjuste, itens,
        });
      } else {
        res = await criarAjusteDosagem({
          pacienteId, dataAjuste, proximaRevisao: proximaRevisao || undefined, motivoAjuste, itens,
        });
      }
      if (res.sucesso) {
        toast.success(modoForm === 'editar' ? 'Ajuste atualizado!' : 'Ajuste de dosagem registrado!');
        resetForm();
        await carregar();
      } else {
        toast.error(res.erro || 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  // ── Excluir ───────────────────────────────────────────────────
  async function handleExcluir() {
    if (!ajusteParaExcluir) return;
    setExcluindo(true);
    try {
      const res = await excluirAjusteDosagem(ajusteParaExcluir.id);
      if (res.sucesso) {
        toast.success('Ajuste excluído com sucesso');
        setAjusteParaExcluir(null);
        await carregar();
      } else {
        toast.error(res.erro || 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir. Tente novamente.');
    } finally {
      setExcluindo(false);
    }
  }

  const dosagemAtual = ajustes[0];

  if (carregando) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  // ── Formulário compartilhado (criar / editar) ─────────────────
  const FormularioAjuste = (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="border-b border-border/30 pb-4">
        <CardTitle className="font-heading text-base">
          {modoForm === 'editar' ? 'Editar Ajuste de Dosagem' : 'Novo Ajuste de Dosagem'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {/* Datas */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Data do Ajuste *</Label>
            <Input type="date" value={dataAjuste} onChange={e => setDataAjuste(e.target.value)} />
          </div>
          <div>
            <Label>Próxima Revisão</Label>
            <Input type="date" value={proximaRevisao} onChange={e => setProximaRevisao(e.target.value)} />
          </div>
        </div>

        {/* Medicamentos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Medicamentos</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-xs">
              <Plus size={12} /> Adicionar Medicamento
            </Button>
          </div>
          {itens.map((item, idx) => (
            <Card key={idx} className="border-border/40 bg-muted/20">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Medicamento {idx + 1}</Badge>
                  {itens.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Tipo de Canabinóide *</Label>
                    <Input value={item.tipoCanabinoide} onChange={e => updateItem(idx, 'tipoCanabinoide', e.target.value)} placeholder="Ex: CBD, THC, Full Spectrum" />
                  </div>
                  <div>
                    <Label>Nova Dosagem *</Label>
                    <Input value={item.novaDosagem} onChange={e => updateItem(idx, 'novaDosagem', e.target.value)} placeholder="Ex: 20mg 2x/dia" />
                  </div>
                  <div>
                    <Label>Dosagem Anterior</Label>
                    <Input value={item.dosagemAnterior} onChange={e => updateItem(idx, 'dosagemAnterior', e.target.value)} />
                  </div>
                  <div>
                    <Label>Frequência *</Label>
                    <Input value={item.frequencia} onChange={e => updateItem(idx, 'frequencia', e.target.value)} placeholder="Ex: 2x ao dia" />
                  </div>
                  <div>
                    <Label>Concentração THC</Label>
                    <Input value={item.concentracaoTHC} onChange={e => updateItem(idx, 'concentracaoTHC', e.target.value)} />
                  </div>
                  <div>
                    <Label>Concentração CBD</Label>
                    <Input value={item.concentracaoCBD} onChange={e => updateItem(idx, 'concentracaoCBD', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Via de Administração</Label>
                  <Input value={item.viaAdministracao} onChange={e => updateItem(idx, 'viaAdministracao', e.target.value)} placeholder="Ex: Sublingual, Oral" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Motivo */}
        <div>
          <Label>Motivo do Ajuste *</Label>
          <Textarea value={motivoAjuste} onChange={e => setMotivoAjuste(e.target.value)} rows={2} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={resetForm}>Cancelar</Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando || !dataAjuste || !motivoAjuste || !itens[0]?.tipoCanabinoide}
            className="gap-2 rounded-xl"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : (modoForm === 'editar' ? <Pencil size={16} /> : <Plus size={16} />)}
            {salvando ? 'Salvando...' : (modoForm === 'editar' ? 'Salvar Alterações' : 'Registrar Ajuste')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Dosagem Atual */}
      {dosagemAtual && (
        <Card className="border-[#C08E3A]/30 bg-[#C08E3A]/5 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="font-heading text-base">💊 Dosagem Atual</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Ajuste em {new Date(dosagemAtual.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
            {dosagemAtual.itens?.map((item: any, i: number) => (
              <div key={i} className="rounded-lg border border-border/30 bg-background p-3">
                <div className="flex items-center gap-2">
                  <Badge>{item.tipoCanabinoide}</Badge>
                  <span className="text-sm font-semibold">{item.novaDosagem}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Frequência: {item.frequencia}</p>
                {item.viaAdministracao && <p className="text-xs text-muted-foreground">Via: {item.viaAdministracao}</p>}
              </div>
            ))}
            {dosagemAtual.proximaRevisao && (
              <p className="text-xs font-medium text-[#C08E3A]">
                Próxima revisão: {new Date(dosagemAtual.proximaRevisao + 'T00:00:00').toLocaleDateString('pt-BR')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Histórico de Dosagem</h2>
        {modoForm === 'nenhum' && (
          <Button size="sm" className="gap-2 rounded-xl" onClick={() => setModoForm('criar')}>
            <Plus size={14} /> Novo Ajuste
          </Button>
        )}
      </div>

      {/* Formulário (criação ou edição) */}
      {modoForm !== 'nenhum' && FormularioAjuste}

      {/* Lista de ajustes */}
      {ajustes.length === 0 && modoForm === 'nenhum' ? (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-lg font-medium">Nenhum ajuste registrado</p>
            <p className="text-sm text-muted-foreground">Clique em &quot;+ Novo Ajuste&quot; para adicionar</p>
          </CardContent>
        </Card>
      ) : (
        ajustes.map((aj) => (
          <Card
            key={aj.id}
            className={`border-border/40 shadow-sm transition-shadow hover:shadow-md ${ajusteEmEdicao === aj.id ? 'ring-2 ring-primary/30' : ''}`}
          >
            <CardContent className="p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                {/* Info */}
                <div className="flex items-center gap-2">
                  <Pill size={16} className="text-[#C08E3A]" />
                  <p className="text-sm font-medium">
                    {new Date(aj.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  <Badge variant="outline">{aj.itens?.length || 0} medicamento(s)</Badge>
                </div>

                {/* Botões */}
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => abrirEdicao(aj)}
                    disabled={modoForm !== 'nenhum'}
                  >
                    <Pencil size={13} />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => setAjusteParaExcluir({
                      id: aj.id,
                      data: new Date(aj.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR'),
                    })}
                    disabled={modoForm !== 'nenhum'}
                  >
                    <Trash2 size={13} />
                    Excluir
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground"><strong>Motivo:</strong> {aj.motivoAjuste}</p>
              {aj.itens?.map((it: any, i: number) => (
                <div key={i} className="mt-2 flex items-center gap-2 text-xs">
                  <Badge variant="secondary">{it.tipoCanabinoide}</Badge>
                  <span>{it.novaDosagem} — {it.frequencia}</span>
                </div>
              ))}
              {aj.proximaRevisao && (
                <p className="mt-2 text-xs font-medium text-[#C08E3A]">
                  Próxima revisão: {new Date(aj.proximaRevisao + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={!!ajusteParaExcluir} onOpenChange={(open) => { if (!open) setAjusteParaExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ajuste de dosagem?</AlertDialogTitle>
            <AlertDialogDescription>
              O ajuste de <strong>{ajusteParaExcluir?.data}</strong> será removido permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {excluindo ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
