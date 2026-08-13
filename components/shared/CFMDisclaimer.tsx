import { AlertCircle } from 'lucide-react';

export function CFMDisclaimer() {
  return (
    <div className="bg-muted/30 border border-border/50 rounded-lg p-3 flex items-start gap-3 text-xs text-muted-foreground mt-4">
      <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      <p className="leading-relaxed">
        <strong>Aviso CFM (Resolução nº 2.314/2022):</strong> Este panorama foi gerado por IA para auxiliar na análise clínica. O médico assistente detém a responsabilidade exclusiva pelo diagnóstico, prescrição e acompanhamento do paciente.
      </p>
    </div>
  );
}
