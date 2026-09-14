import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import {
  obterConfigPagamentoMedicoLogado,
  salvarConfigPagamentoMedicoLogado,
} from '@/app/(medico)/_actions/pagamentos';
import { FormConfigPagamentoMedico } from '@/components/shared/pagamentos/form-config-pagamento-medico';
import { PageHeader } from '@/components/shared/page-header';

export const metadata: Metadata = {
  title: 'Meus dados de recebimento — Área Médica Be4Hope',
};

export default async function ConfigPagamentoMedicoLogadoPage() {
  const resultado = await obterConfigPagamentoMedicoLogado();
  const config = resultado.dados ?? {
    pixHabilitado: false,
    pixTipoChave: null,
    pixChave: null,
    boletoHabilitado: false,
    cartaoCreditoHabilitado: false,
    cartaoDebitoHabilitado: false,
    bancoNome: null,
    bancoAgencia: null,
    bancoConta: null,
    bancoContaTipo: null,
    bancoTitularNome: null,
    bancoTitularDocumento: null,
    observacoes: null,
  };

  return (
    <div className="space-y-6">
      <Link href="/medico/pagamentos">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ChevronLeft size={16} />
          Pagamentos
        </Button>
      </Link>

      <PageHeader
        title="Meus dados de recebimento"
        description="Cadastre sua chave PIX e dados bancários. Quem decide o que fica disponível para o paciente na etapa de pagamento é o administrador — aqui você só alimenta o dado."
      />

      <FormConfigPagamentoMedico
        perfil="medico"
        configInicial={config}
        aoSalvar={salvarConfigPagamentoMedicoLogado}
      />
    </div>
  );
}
