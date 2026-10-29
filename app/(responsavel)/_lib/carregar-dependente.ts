import { notFound } from 'next/navigation';

import { garantirResponsavelDoPaciente } from '@/lib/auth/escopo-do-responsavel';
import { obterFichaDoDependente } from '@/lib/dependentes/leituras';

/**
 * 🔴 A PORTA de toda página de UM dependente (ADR-0033 D-03).
 *
 * O `pacienteId` vem da URL, ou seja, é ENTRADA DO USUÁRIO. Aqui ele é provado pelo vínculo `ativo` deste
 * responsável; se não for dele, a resposta é a mesma de "não existe" (`notFound`, 404). Quem prossegue usa o
 * `pacienteId` que o resolvedor DEVOLVE (`escopo.pacienteId`), nunca o da URL.
 *
 * ⚠️ CADA PÁGINA CHAMA ISTO, e não só o layout: um layout não protege a página filha (o Next renderiza as duas
 * em paralelo), então confiar no layout deixaria cada `page.tsx` sem prova nenhuma. O guarda
 * `as-telas-do-responsavel-nao-misturam-dependentes` falha se uma página de `[pacienteId]` ficar sem esta chamada.
 */
export async function carregarDependente(pacienteIdDaUrl: string) {
  const g = await garantirResponsavelDoPaciente(pacienteIdDaUrl);
  if (!g.ok) notFound();

  const ficha = await obterFichaDoDependente(g.escopo.pacienteId);
  if (!ficha) notFound();

  return { escopo: g.escopo, ficha };
}
