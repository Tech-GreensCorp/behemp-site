'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon, Add01Icon, FileValidationIcon, Download01Icon, ViewIcon } from '@hugeicons/core-free-icons';
import { criarRelatorio, listarRelatorios } from '@/app/_actions/relatorios';
import { listarAnamneses } from '@/app/_actions/anamneses';
import { listarEvolucoes } from '@/app/_actions/evolucoes';
import { listarAjustesDosagem } from '@/app/_actions/ajustes-dosagem';
import { toast } from 'sonner';

interface TabRelatoriosProps { pacienteId: string; pacienteNome: string }

export function TabRelatorios({ pacienteId, pacienteNome }: TabRelatoriosProps) {
  const [relatorios, setRelatorios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarRelatorios(pacienteId);
    if (res.sucesso && res.dados) setRelatorios(res.dados);
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleGerar() {
    setGerando(true);
    try {
      // Buscar dados para o relatório
      const [anamRes, evRes, dosRes] = await Promise.all([
        listarAnamneses(pacienteId),
        listarEvolucoes(pacienteId),
        listarAjustesDosagem(pacienteId),
      ]);

      // Importar jspdf dinamicamente (client-side only)
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      let y = 20;
      const addLine = (text: string, bold = false) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFontSize(bold ? 13 : 10);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        const lines = doc.splitTextToSize(text, 175);
        doc.text(lines, 15, y);
        y += lines.length * 5 + 2;
      };
      const addSpacer = () => { y += 5; };

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório Médico Completo', 15, y);
      y += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Paciente: ${pacienteNome}`, 15, y); y += 6;
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 15, y);
      y += 10;
      doc.setDrawColor(192, 142, 58);
      doc.line(15, y, 195, y);
      y += 8;

      // Anamnese
      if (anamRes.sucesso && anamRes.dados && anamRes.dados.length > 0) {
        addLine('ANAMNESE', true);
        addSpacer();
        const a = anamRes.dados[0];
        if (a.queixaPrincipal) { addLine(`Queixa Principal: ${a.queixaPrincipal}`); }
        if (a.historiaDoencaAtual) { addLine(`História da Doença Atual: ${a.historiaDoencaAtual}`); }
        if (a.doencasPrevias) { addLine(`Doenças Prévias: ${a.doencasPrevias}`); }
        if (a.medicamentosEmUso) { addLine(`Medicamentos em Uso: ${a.medicamentosEmUso}`); }
        if (a.alergias) { addLine(`Alergias: ${a.alergias}`); }
        addLine(`Tabagismo: ${a.tabagismo?.replace('_', ' ')}`);
        addLine(`Consumo de Álcool: ${a.consumoAlcool?.replace('_', ' ')}`);
        addLine(`Qualidade do Sono: ${a.qualidadeSono}`);
        if (a.nivelDor != null) addLine(`Nível de Dor: ${a.nivelDor}/10`);
        addSpacer();
      }

      // Evoluções
      if (evRes.sucesso && evRes.dados && evRes.dados.length > 0) {
        addLine('EVOLUÇÃO DO TRATAMENTO', true);
        addSpacer();
        for (const ev of evRes.dados.slice(0, 10)) {
          addLine(`${new Date(ev.data + 'T00:00:00').toLocaleDateString('pt-BR')} — ${ev.tipo?.toUpperCase()}`);
          addLine(ev.conteudo);
          if (ev.sintomasAtuais) addLine(`Sintomas: ${ev.sintomasAtuais}`);
          if (ev.nivelDor != null) addLine(`Dor: ${ev.nivelDor}/10`);
          addSpacer();
        }
      }

      // Dosagem
      if (dosRes.sucesso && dosRes.dados && dosRes.dados.length > 0) {
        addLine('HISTÓRICO DE DOSAGEM', true);
        addSpacer();
        for (const aj of dosRes.dados.slice(0, 10)) {
          addLine(`Ajuste em ${new Date(aj.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR')} — ${aj.motivoAjuste}`);
          for (const it of aj.itens || []) {
            addLine(`  • ${it.tipoCanabinoide}: ${it.novaDosagem} (${it.frequencia})`);
          }
          addSpacer();
        }
      }

      // Salvar
      const pdfBlob = doc.output('blob');
      const fileName = `relatorio-${pacienteNome.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;

      // Upload para Vercel Blob
      const { put } = await import('@vercel/blob');
      // Criar File a partir do Blob
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Upload direto via fetch para API route
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload-relatorio', { method: 'POST', body: formData });
      let urlPdf = '';
      if (uploadRes.ok) {
        const json = await uploadRes.json();
        urlPdf = json.url;
      }

      // Registrar no banco
      await criarRelatorio(pacienteId, urlPdf || '');

      // Download local
      doc.save(fileName);

      toast.success('Relatório gerado com sucesso!');
      await carregar();
    } catch (error) {
      console.error('[Relatório]', error);
      toast.error('Erro ao gerar relatório');
    }
    setGerando(false);
  }

  if (carregando) return <div className="flex justify-center py-16"><HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <Card className="border-border/40 shadow-sm">
        <CardHeader className="border-b border-border/30 pb-4">
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <HugeiconsIcon icon={FileValidationIcon} size={18} className="text-[#C08E3A]" />
            Gerar Novo Relatório
          </CardTitle>
          <p className="text-sm text-muted-foreground">Gere um relatório médico completo em PDF com todos os dados do paciente, anamnese, evolução do tratamento e histórico de dosagem.</p>
        </CardHeader>
        <CardContent className="pt-4">
          <Button onClick={handleGerar} disabled={gerando} className="gap-2 rounded-xl bg-[#C08E3A] hover:bg-[#a8762f]">
            {gerando ? <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" /> : <HugeiconsIcon icon={Add01Icon} size={16} />}
            {gerando ? 'Gerando...' : 'Gerar Relatório em PDF'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/40 shadow-sm">
        <CardHeader className="border-b border-border/30 pb-4">
          <CardTitle className="font-heading text-base">Relatórios Gerados</CardTitle>
          <p className="text-sm text-muted-foreground">Histórico de relatórios médicos gerados para {pacienteNome}</p>
        </CardHeader>
        <CardContent className="pt-4">
          {relatorios.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum relatório gerado</p>
          ) : (
            <div className="space-y-3">
              {relatorios.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C08E3A]/10">
                      <HugeiconsIcon icon={FileValidationIcon} size={18} className="text-[#C08E3A]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{r.titulo}</p>
                      <p className="text-xs text-muted-foreground">Gerado em {new Date(r.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {r.urlPdf && (
                      <>
                        <a href={r.urlPdf} download><Button variant="outline" size="sm" className="gap-1.5"><HugeiconsIcon icon={Download01Icon} size={14} /> Download</Button></a>
                        <a href={r.urlPdf} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="gap-1.5"><HugeiconsIcon icon={ViewIcon} size={14} /> Ver</Button></a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
