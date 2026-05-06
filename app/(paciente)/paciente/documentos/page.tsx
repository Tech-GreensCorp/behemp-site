import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Download, AlertTriangle } from 'lucide-react';

const DOCUMENTOS_MOCK = [
  { id: '1', tipo: 'RG', nome: 'RG_Maria_Silva.pdf', status: 'valido', validade: '—' },
  { id: '2', tipo: 'Receita Médica', nome: 'Receita_CBD_2026.pdf', status: 'valido', validade: '20/09/2026' },
  { id: '3', tipo: 'Autorização Anvisa', nome: 'Anvisa_Auth_2026.pdf', status: 'vencendo', validade: '15/06/2026' },
  { id: '4', tipo: 'Comprovante de Residência', nome: 'Comprovante_End.pdf', status: 'valido', validade: '—' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon?: typeof AlertTriangle }> = {
  valido: { label: '✓ Válido', variant: 'outline' },
  vencendo: { label: '⚠ Vencendo', variant: 'secondary', icon: AlertTriangle },
  vencido: { label: '✕ Vencido', variant: 'default', icon: AlertTriangle },
};

export default function DocumentosPacientePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Documentos enviados e gerenciados pela clínica
          </p>
        </div>
        <Button className="gap-1.5">
          <Upload className="h-4 w-4" />
          Enviar documento
        </Button>
      </div>

      <div className="space-y-3">
        {DOCUMENTOS_MOCK.map((doc) => {
          const config = STATUS_CONFIG[doc.status];
          return (
            <Card key={doc.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{doc.tipo}</p>
                  <p className="truncate text-xs text-muted-foreground">{doc.nome}</p>
                </div>
                <div className="hidden items-center gap-3 sm:flex">
                  {doc.validade !== '—' && (
                    <span className="text-xs text-muted-foreground">
                      Validade: {doc.validade}
                    </span>
                  )}
                  <Badge variant={config?.variant || 'outline'}>
                    {config?.label}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
