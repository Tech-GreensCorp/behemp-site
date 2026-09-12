/**
 * TODO DESTINO É UMA ROTA QUE EXISTE — conferido contra o disco, não contra um comentário.
 *
 * 🔴 O DEFEITO, medido em 12/09/2026. `DESTINOS.agendamento` valia `'/agendamento'`, e a única
 * rota com esse nome é `app/(paciente)/paciente/agendamento`. Não há rewrite no
 * `next.config.ts`. O manifesto do build confirma: `/paciente/agendamento` e nada mais.
 *
 * ⚠️ QUEM CAÍA NISSO ERA A MAIORIA DOS PACIENTES. `destinoDepoisDoCadastro` devolve
 * `agendamento` sempre que falta a receita — o passo 4 do fluxo 2 e o passo 3 do fluxo 4 da
 * Greens. O paciente terminava o cadastro, via a tela de "pronto", e a seguinte era 404.
 *
 * 🔴 E O COMENTÁRIO AFIRMAVA O CONTRÁRIO: _"Os destinos possíveis, todos rotas que já
 * existem"_. Comentário que afirma um fato sobre o disco não é verificação — é uma promessa
 * que ninguém conferiu. É a mesma classe do componente órfão do `AvisoDaProcuracao` e da
 * `prepararTransferencia` que ninguém chamava: a peça existe, a prosa diz que está ligada, e
 * não está.
 *
 * ⚠️ DERIVA DO DISCO, nunca de uma lista paralela. O guarda varre `app/` procurando o
 * diretório que corresponde a cada destino, respeitando route groups — `(paciente)` não
 * aparece na URL. Lista paralela é o que desatualiza e aprova o errado.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { DESTINOS, destinoDepoisDoCadastro } from '@/lib/parceiros/destino-do-paciente';

const RAIZ = join(__dirname, '..', '..');
const APP = join(RAIZ, 'app');

/**
 * Todas as URLs que `app/` serve, com os route groups removidos.
 *
 * Um segmento entre parênteses — `(paciente)`, `(auth)` — organiza arquivos e **não** entra na
 * URL. Um `[token]` é dinâmico: casa com qualquer valor, e por isso vira `*`.
 */
function rotasDoDisco(dir = APP, url = ''): string[] {
  const achadas: string[] = [];
  for (const nome of readdirSync(dir)) {
    if (nome.startsWith('_') || nome === 'api') continue;
    const caminho = join(dir, nome);
    if (!statSync(caminho).isDirectory()) continue;

    const ehGrupo = nome.startsWith('(') && nome.endsWith(')');
    const ehDinamico = nome.startsWith('[');
    const proxima = ehGrupo ? url : `${url}/${ehDinamico ? '*' : nome}`;

    if (!ehGrupo && existsSync(join(caminho, 'page.tsx'))) achadas.push(proxima);
    achadas.push(...rotasDoDisco(caminho, proxima));
  }
  return achadas;
}

const ROTAS = rotasDoDisco();

/** Uma rota casa se for igual, ou se um segmento dinâmico cobrir a diferença. */
function existeNoDisco(destino: string): boolean {
  return ROTAS.some((rota) => {
    const a = rota.split('/');
    const b = destino.split('/');
    if (a.length !== b.length) return false;
    return a.every((seg, i) => seg === '*' || seg === b[i]);
  });
}

describe('todo destino é uma rota que existe', () => {
  it('⚠️ VACUIDADE: o varredor achou rotas de verdade', () => {
    // Sem isto, `existeNoDisco` devolveria false para tudo e os casos abaixo pareceriam
    // rigorosos enquanto mediam uma lista vazia.
    expect(ROTAS.length).toBeGreaterThan(10);
    expect(ROTAS).toContain('/paciente/anvisa');
  });

  it('⚠️ VACUIDADE: o route group não entra na URL', () => {
    expect(ROTAS.every((r) => !r.includes('('))).toBe(true);
  });

  it.each(Object.entries(DESTINOS))('🔴 `%s` → `%s` existe no disco', (_nome, destino) => {
    expect(existeNoDisco(destino), `${destino} não corresponde a nenhuma rota em app/`).toBe(true);
  });

  it('🔴 e uma rota inventada NÃO passa — o controle contra falso verde', () => {
    expect(existeNoDisco('/agendamento')).toBe(false);
    expect(existeNoDisco('/rota-que-nunca-existiu')).toBe(false);
  });

  it('🔴 todo destino que a decisão devolve também existe', () => {
    // Deriva da função, não da constante: se um ramo novo devolver uma string literal que
    // não está em DESTINOS, este caso a pega.
    const casos: readonly string[][] = [
      ['receita_medica', 'autorizacao_anvisa'],
      ['receita_medica'],
      ['autorizacao_anvisa'],
      [],
      ['documento_identidade', 'comprovante_residencia'],
    ];
    for (const pendentes of casos) {
      const destino = destinoDepoisDoCadastro(pendentes);
      expect(existeNoDisco(destino), `${destino} (pendentes: ${pendentes})`).toBe(true);
    }
  });

  it('⚠️ e a ordem clínica continua valendo — consulta antes da procuração', () => {
    // Sem receita não há o que autorizar. Se alguém "consertar" o destino invertendo isto,
    // o guarda acima continuaria verde e a regra teria sumido.
    expect(destinoDepoisDoCadastro(['receita_medica', 'autorizacao_anvisa'])).toBe(
      DESTINOS.agendamento,
    );
    expect(destinoDepoisDoCadastro(['autorizacao_anvisa'])).toBe(DESTINOS.anvisa);
  });
});
