'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, PenSquare, Trash2, Eye, Layout } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { listarTemplatesMedico, criarTemplate, excluirTemplate } from '@/app/(medico)/_actions/receituario-templates';
import { LISTA_ICONES } from '@/lib/receituario/icones-medicos';

export default function ReceituariosPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    nome: '',
    tipo: 'simples',
    padrao: false,
    corPrimaria: '#EA5429'
  });

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    const res = await listarTemplatesMedico();
    if (res.sucesso) {
      setTemplates(res.dados ?? []);
    } else {
      toast.error(res.erro || 'Erro ao carregar templates');
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleSalvar = async () => {
    if (!form.nome.trim()) {
      toast.error('Nome do template é obrigatório');
      return;
    }

    setSalvando(true);
    const config = {
      corPrimaria: form.corPrimaria,
      corFundo: '#ffffff',
      estampa: { tipo: 'nenhuma', opacidade: 0.06 },
      blocos: [] // Vazio, num editor real populariamos com posições 
    };

    const res = await criarTemplate({
      nome: form.nome,
      tipo: form.tipo,
      padrao: form.padrao,
      config
    });

    setSalvando(false);
    if (res.sucesso) {
      toast.success('Template criado com sucesso!');
      setOpen(false);
      setForm({ nome: '', tipo: 'simples', padrao: false, corPrimaria: '#EA5429' });
      carregarDados();
    } else {
      toast.error(res.erro || 'Erro ao criar template');
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Deseja realmente excluir este template?')) return;
    const res = await excluirTemplate(id);
    if (res.sucesso) {
      toast.success('Template excluído');
      carregarDados();
    } else {
      toast.error(res.erro || 'Erro ao excluir');
    }
  };

  if (carregando) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Templates de Receituário</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus modelos de receituário e atestados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="gap-2"><Plus size={16} /> Novo Template</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Template</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Padrão Clínica" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v ?? 'simples' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples</SelectItem>
                    <SelectItem value="controle_especial">Controle Especial</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cor Primária (Hex)</Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={form.corPrimaria} onChange={e => setForm(f => ({ ...f, corPrimaria: e.target.value }))} className="w-16 h-10 p-1" />
                  <Input value={form.corPrimaria} onChange={e => setForm(f => ({ ...f, corPrimaria: e.target.value }))} className="flex-1" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Template Padrão</Label>
                  <p className="text-xs text-muted-foreground">Usar este modelo por padrão em novas emissões</p>
                </div>
                <Switch checked={form.padrao} onCheckedChange={v => setForm(f => ({ ...f, padrao: v }))} />
              </div>
              <Button className="w-full mt-4" onClick={handleSalvar} disabled={salvando}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((t) => (
          <Card key={t.id} className="overflow-hidden flex flex-col">
            <div 
              className="h-24 w-full relative flex items-center justify-center border-b"
              style={{ backgroundColor: (t.config?.corFundo || '#ffffff'), borderTop: `4px solid ${t.config?.corPrimaria || '#EA5429'}` }}
            >
              <Layout size={40} style={{ color: (t.config?.corPrimaria || '#EA5429'), opacity: 0.3 }} />
              {t.padrao && (
                <Badge className="absolute top-2 right-2 bg-primary/20 text-primary hover:bg-primary/30 border-none">
                  Padrão
                </Badge>
              )}
            </div>
            <CardHeader className="py-4 flex-1">
              <CardTitle className="text-lg">{t.nome}</CardTitle>
              <CardDescription>
                {t.tipo === 'simples' ? 'Receituário Simples' : t.tipo === 'controle_especial' ? 'Controle Especial' : 'Personalizado'}
              </CardDescription>
            </CardHeader>
            <CardContent className="py-4 border-t flex items-center justify-between bg-muted/10 gap-2">
              <Button variant="outline" size="sm" className="flex-1" disabled title="Editor visual em construção">
                <PenSquare size={14} className="mr-2" /> Editar
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleExcluir(t.id)}>
                <Trash2 size={16} />
              </Button>
            </CardContent>
          </Card>
        ))}

        {templates.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed rounded-xl border-border bg-muted/20">
            <Layout size={48} className="mx-auto opacity-20 mb-4" />
            <h3 className="text-lg font-medium">Nenhum template criado</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">Você ainda não possui templates de receituário personalizados.</p>
            <Button variant="outline" onClick={() => setOpen(true)}>Criar meu primeiro template</Button>
          </div>
        )}
      </div>

      {/* Editor Canvas de Placeholder */}
      {templates.length > 0 && (
        <Card className="mt-12 border-dashed bg-muted/10">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Editor Visual A4 (Preview)</CardTitle>
            <CardDescription>Arraste os elementos no canvas 794x1123px para personalizar o seu documento.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="w-[794px] h-[300px] border bg-white shadow-sm rounded-sm relative overflow-hidden flex items-center justify-center opacity-50 select-none scale-50 sm:scale-75 md:scale-100 origin-top">
              <div className="absolute top-8 left-10 w-24 h-12 border-2 border-dashed border-primary flex items-center justify-center text-xs text-primary/70 font-semibold bg-primary/5">Logo</div>
              <div className="absolute top-10 left-40 w-[400px] h-8 bg-muted rounded"></div>
              <div className="absolute top-32 left-10 w-[714px] h-32 border border-border bg-muted/20 rounded flex items-center justify-center text-sm font-medium text-muted-foreground">Área de Medicamentos</div>
              <div className="absolute bottom-16 right-10 w-64 border-t-2 border-foreground pt-2 text-center text-xs font-semibold">Assinatura Digital ICP-Brasil</div>
              <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
                <Badge variant="outline" className="text-sm bg-background">Editor Visual em Construção</Badge>
              </div>
            </div>
            
            <div className="mt-8 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 px-12 pb-12 w-full max-w-4xl place-items-center opacity-40">
               {LISTA_ICONES.slice(0, 8).map(i => (
                 <div key={i.id} className="w-10 h-10 rounded bg-white shadow-sm border flex items-center justify-center text-primary">
                    {/* SVG placeholder */}
                    <div className="w-6 h-6 rounded-full bg-primary/20"></div>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
