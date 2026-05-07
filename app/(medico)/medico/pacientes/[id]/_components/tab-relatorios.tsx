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

interface Relatorio {
  id: string;
  titulo: string;
  urlPdf: string | null;
  createdAt: string | Date;
}

export function TabRelatorios({ pacienteId, pacienteNome }: TabRelatoriosProps) {
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
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
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = 20;
      const marginRight = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;
      let pageNum = 1;

      // ── Funções auxiliares ──────────────────────────────────────
      const addHeader = () => {
        // Barra dourada superior
        doc.setFillColor(192, 142, 58); // #C08E3A
        doc.rect(0, 0, pageWidth, 4, 'F');

        // Nome da organização
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(192, 142, 58);
        doc.text('Be4Hope', marginLeft, 18);

        // Subtítulo
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 130);
        doc.text('Associação de Medicina Endocanabinóide', marginLeft, 24);

        // Linha separadora
        doc.setDrawColor(220, 220, 220);
        doc.line(marginLeft, 28, pageWidth - marginRight, 28);

        doc.setTextColor(0, 0, 0);
      };

      const addFooter = () => {
        // Linha separadora
        doc.setDrawColor(220, 220, 220);
        doc.line(marginLeft, pageHeight - 16, pageWidth - marginRight, pageHeight - 16);

        // Texto do rodapé
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(160, 160, 160);
        doc.text('CONFIDENCIAL — Documento gerado pela plataforma Be4Hope', marginLeft, pageHeight - 10);
        doc.text(`Página ${pageNum}`, pageWidth - marginRight, pageHeight - 10, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      };

      addHeader();
      addFooter();

      let y = 36;
      const checkPage = (needed: number = 20) => {
        if (y > pageHeight - 30 - needed) {
          doc.addPage();
          pageNum++;
          addHeader();
          addFooter();
          y = 36;
        }
      };

      const addLine = (text: string, bold = false, fontSize = 10) => {
        checkPage();
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setTextColor(0, 0, 0);
        const lines = doc.splitTextToSize(text, contentWidth);
        doc.text(lines, marginLeft, y);
        y += lines.length * (fontSize * 0.45) + 2;
      };

      const addSection = (title: string) => {
        checkPage(15);
        y += 4;
        // Linha dourada da seção
        doc.setFillColor(192, 142, 58);
        doc.rect(marginLeft, y - 2, 40, 0.8, 'F');
        y += 4;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text(title, marginLeft, y);
        doc.setTextColor(0, 0, 0);
        y += 8;
      };

      const addSpacer = (size = 5) => { y += size; };
      const addLabel = (label: string, value: string) => {
        checkPage();
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text(label, marginLeft, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const labelWidth = doc.getTextWidth(label + ' ');
        const valueLines = doc.splitTextToSize(value, contentWidth - labelWidth);
        doc.text(valueLines, marginLeft + labelWidth, y);
        y += valueLines.length * 4.5 + 2;
      };

      // ── Título do Relatório ──────────────────────────────────
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Relatório Médico Completo', marginLeft, y);
      y += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Paciente: ${pacienteNome}`, marginLeft, y);
      y += 6;
      doc.text(
        `Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        marginLeft,
        y,
      );
      y += 4;

      // Linha dourada principal
      doc.setDrawColor(192, 142, 58);
      doc.setLineWidth(0.8);
      doc.line(marginLeft, y + 4, pageWidth - marginRight, y + 4);
      doc.setLineWidth(0.2);
      y += 12;

      // Anamnese
      if (anamRes.sucesso && anamRes.dados && anamRes.dados.length > 0) {
        addSection('Anamnese');
        const a = anamRes.dados[0];
        if (a.queixaPrincipal) addLabel('Queixa Principal:', a.queixaPrincipal);
        if (a.historiaDoencaAtual) addLabel('HDA:', a.historiaDoencaAtual);
        if (a.doencasPrevias) addLabel('Doenças Prévias:', a.doencasPrevias);
        if (a.medicamentosEmUso) addLabel('Medicamentos:', a.medicamentosEmUso);
        if (a.alergias) addLabel('Alergias:', a.alergias);
        addLabel('Tabagismo:', a.tabagismo?.replace('_', ' ') ?? '—');
        addLabel('Álcool:', a.consumoAlcool?.replace('_', ' ') ?? '—');
        addLabel('Sono:', a.qualidadeSono ?? '—');
        if (a.nivelDor != null) addLabel('Nível de Dor:', `${a.nivelDor}/10`);
        addSpacer();
      }

      // Evoluções
      if (evRes.sucesso && evRes.dados && evRes.dados.length > 0) {
        addSection('Evolução do Tratamento');
        for (const ev of evRes.dados.slice(0, 10)) {
          addLine(`${new Date(ev.data + 'T00:00:00').toLocaleDateString('pt-BR')} — ${ev.tipo?.toUpperCase()}`, true, 10);
          addLine(ev.conteudo);
          if (ev.sintomasAtuais) addLabel('Sintomas:', ev.sintomasAtuais);
          if (ev.nivelDor != null) addLabel('Dor:', `${ev.nivelDor}/10`);
          addSpacer(3);
        }
      }

      // Dosagem
      if (dosRes.sucesso && dosRes.dados && dosRes.dados.length > 0) {
        addSection('Histórico de Dosagem');
        for (const aj of dosRes.dados.slice(0, 10)) {
          addLine(`Ajuste em ${new Date(aj.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR')} — ${aj.motivoAjuste}`, true, 10);
          for (const it of aj.itens || []) {
            addLabel(`  • ${it.tipoCanabinoide}:`, `${it.novaDosagem} (${it.frequencia})`);
          }
          addSpacer(3);
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
