'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ItemExportavel {
  pacienteNome: string;
  dataHora: string | Date;
  valor: string;
  moeda: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  isento: 'Isento',
  cancelado: 'Cancelado',
  estornado: 'Estornado',
};

function escaparCampoCsv(valor: string): string {
  if (/[";\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

/**
 * Exporta a lista já carregada (sem nova consulta ao servidor) como CSV — separador `;`
 * e decimal com vírgula, porque é o que o Excel em pt-BR espera ao abrir o arquivo direto.
 */
export function ExportarPagamentosCsv({ itens }: { itens: ItemExportavel[] }) {
  function handleExportar() {
    const cabecalho = ['Paciente', 'Data', 'Valor', 'Moeda', 'Status'];
    const linhas = itens.map((p) => [
      p.pacienteNome,
      new Date(p.dataHora).toLocaleString('pt-BR'),
      Number(p.valor).toFixed(2).replace('.', ','),
      p.moeda,
      STATUS_LABEL[p.status] ?? p.status,
    ]);

    const csv = [cabecalho, ...linhas]
      .map((linha) => linha.map((campo) => escaparCampoCsv(String(campo))).join(';'))
      .join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagamentos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="outline"
      onClick={handleExportar}
      disabled={itens.length === 0}
      className="w-full gap-2 sm:w-auto"
    >
      <Download size={16} />
      Exportar CSV
    </Button>
  );
}
