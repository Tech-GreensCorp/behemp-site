'use client';

/**
 * AVISO NO DASHBOARD: há documento da equipe esperando a assinatura do paciente.
 *
 * Hoje é o comunicado enviado para assinatura eletrônica (a carta de doação). Lê o MESMO dado da
 * tela Documentos (`listarMeusComunicados`): só `pendente` conta — assinado, recusado e cancelado
 * não geram aviso. Quem não recebeu nenhum envio não vê nada.
 *
 * O aviso LEVA à tela Documentos, onde o botão de assinar já existe; não assina por aqui. Em tom
 * dourado (já usado nos cartões de Endereço do produto) para se distinguir dos avisos em terracota.
 * Falha ao consultar não mostra nada: o dashboard não depende dele.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileSignature } from 'lucide-react';

import { listarMeusComunicados } from '@/app/_actions/comunicados';

export function AvisoDeDocumentoParaAssinar({
  destino = '/paciente/documentos',
}: {
  destino?: string;
}) {
  const [titulos, setTitulos] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    void listarMeusComunicados()
      .then((res) => {
        if (!vivo || !res.sucesso) return;
        setTitulos(res.dados.filter((c) => c.status === 'pendente').map((c) => c.titulo));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (titulos.length === 0) return null;

  return (
    <Link
      href={destino}
      className="animate-fade-up group flex items-start gap-4 rounded-2xl border border-[#C08E3A]/40 bg-[#C08E3A]/10 p-5 transition-colors hover:bg-[#C08E3A]/15"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#C08E3A]/20 text-[#C08E3A]">
        <FileSignature size={19} />
      </span>
      <div className="space-y-1">
        <h3 className="text-foreground text-sm font-semibold">
          {titulos.length === 1
            ? 'Você tem um documento para assinar'
            : `Você tem ${titulos.length} documentos para assinar`}
        </h3>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {titulos.length === 1 ? titulos[0] : titulos.join(' · ')}
        </p>
        <span className="inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-[#C08E3A] transition-opacity group-hover:opacity-70">
          Assinar agora
          <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  );
}
