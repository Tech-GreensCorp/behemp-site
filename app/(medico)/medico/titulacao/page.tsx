'use client';

/**
 * Conduta e titulação — a visão GERAL de todos os pacientes do médico.
 *
 * É o *filtro* do `DO-44` (c): *"além de ter o filtro de geral aonde vê todos os medicamentos
 * prescritos"*. A visão PADRÃO continua sendo a do paciente, na aba do prontuário — esta tela
 * existe para a pergunta "quem está tomando o quê", não para operar a conduta.
 *
 * Por isso aqui **não há formulário**: cada cartão leva ao prontuário, onde o ajuste acontece
 * com o histórico do paciente à vista. Ajustar dose olhando uma lista de todos os pacientes é
 * exatamente o tipo de densidade que o `DO-44` (d) proíbe.
 *
 * Página `'use client'` seguindo o critério medido de `06-PADROES-DO-CODIGO.md` §6: lista com
 * busca e filtro → client page + Server Action.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { listarTitulacaoGeral } from '@/app/(medico)/_actions/conduta';
import { VisaoGeralTitulacao, type LinhaGeral } from '@/components/conduta/VisaoGeralTitulacao';

export default function TitulacaoPage() {
  const [linhas, setLinhas] = useState<LinhaGeral[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Ver a nota em tab-dosagem.tsx: o estado nasce `true` para não haver setState síncrono
  // no corpo do effect (React 19).
  const carregar = useCallback(async () => {
    const res = await listarTitulacaoGeral();
    if (res.sucesso) setLinhas(res.dados);
    else toast.error(res.erro);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <header className="animate-fade-up space-y-1">
        <p className="eyebrow">Acompanhamento</p>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Conduta e titulação</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Todos os planos terapêuticos ativos dos seus pacientes. Para ajustar uma dose, abra o
          prontuário — o ajuste acontece com o histórico do paciente à vista.
        </p>
      </header>

      {carregando ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="text-primary animate-spin" />
        </div>
      ) : (
        <VisaoGeralTitulacao linhas={linhas} />
      )}
    </div>
  );
}
