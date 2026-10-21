/**
 * A leitura do grafo de evidências — helper **puro**, sem React, sem `db`, sem `next/*`.
 *
 * 🔴 POR QUE ISTO SAIU DE DENTRO DO COMPONENTE
 * Em 24/08/2026 o dono pediu que a tela **"Sua decisão"** também mostrasse a evidência de cada
 * hipótese, *"o mesmo dado que há em Hipóteses sugeridas pela IA"*, para revisar sem subir a
 * página. Duas telas passando a depender da mesma leitura deixam duas saídas possíveis:
 * duplicar a função, ou compartilhá-la. Duplicada, ela **diverge em silêncio** — e o dia em que
 * divergir, uma tela dirá "3 a favor" e a outra "2 a favor" para a mesma hipótese, e ninguém
 * saberá qual está certa.
 *
 * Convenção do repositório para este caso: `lib/<dominio>/`, puro e testável sem ambiente
 * (ver `CLAUDE.md`, seção "Onde script, teste e seed moram").
 */
import type { Achado, GrafoEvidencias } from '@/lib/ia-clinica/contrato';

export interface EvidenciaDaHipotese {
  /** Achados que a aresta marca como `suporta`. */
  aFavor: Achado[];
  /** Achados que a aresta marca como `contradiz` — aparecem com o MESMO peso na tela. */
  contra: Achado[];
  /** Achados que a hipótese não explica (`lacuna`). Esconder isto produz fechamento prematuro. */
  lacunas: Achado[];
}

/**
 * Achados ligados a uma hipótese, separados pelo que a aresta diz.
 *
 * Aresta cujo `de` não existe em `achados` é ignorada: grafo parcial é estado normal do motor
 * (`grafoEstaParcial`), e estourar aqui derrubaria a tela por um dado que o contrato admite.
 */
export function evidenciaDa(grafo: GrafoEvidencias, hipoteseId: string): EvidenciaDaHipotese {
  const porId = new Map(grafo.achados.map((a) => [a.id, a]));
  const aFavor: Achado[] = [];
  const contra: Achado[] = [];
  const lacunas: Achado[] = [];
  for (const aresta of grafo.arestas) {
    if (aresta.para !== hipoteseId) continue;
    const achado = porId.get(aresta.de);
    if (!achado) continue;
    if (aresta.tipo === 'suporta') aFavor.push(achado);
    else if (aresta.tipo === 'contradiz') contra.push(achado);
    else if (aresta.tipo === 'lacuna') lacunas.push(achado);
  }
  return { aFavor, contra, lacunas };
}
