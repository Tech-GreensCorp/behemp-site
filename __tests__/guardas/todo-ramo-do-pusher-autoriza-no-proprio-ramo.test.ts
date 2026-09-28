/**
 * GUARDA — todo ramo de canal em `/api/pusher/auth` termina AUTORIZANDO no próprio ramo.
 *
 * O defeito (Item 49, achado em 28/09/2026): os ramos `private-user-` e `private-chat-` só
 * RECUSAVAM. Na permissão, a execução saía do `if / else if` e caía no default — que o commit
 * `e65771d` (09/09/2026) trocou, corretamente, de "autoriza tudo" para "nega tudo". Os dois
 * ramos que dependiam de cair no default para autorizar ficaram sem saída de sucesso, e por 19
 * dias todo canal pessoal e todo chat legítimo recebeu 403 "Canal não reconhecido" em produção:
 * aviso de pagamento, aviso de teleconsulta, chat em tempo real.
 *
 * Nenhum type-check acusa isso (a função devolve `Response` pelo default), e o teste de
 * integração que prova o comportamento não roda no portão. Por isso este guarda: DERIVA os ramos
 * do próprio código — ramo novo nasce coberto — e exige que cada um tenha o seu `return`
 * autorizando, sem depender do que vem depois.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rota = readFileSync(path.join(process.cwd(), 'app/api/pusher/auth/route.ts'), 'utf8').replace(
  /\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm,
  '$1',
);

/** Os ramos `if (canal…)` / `} else if (canal…)`, do cabeçalho até o próximo ramo ou o default. */
function ramos(fonte: string): { cabecalho: string; corpo: string }[] {
  // Só cabeçalho de RAMO: `canal.startsWith(…)` ou `canal === CONSTANTE`. Um `canal[^)]*`
  // genérico casava também o `if (canalUserId !== user.id)` de DENTRO do ramo e o partia em
  // dois — o caso de vacuidade pegou, em 28/09/2026.
  const marcas = [
    ...fonte.matchAll(/(?:\} else )?if \((canal(?:\.startsWith\('[^']+'\)| === [A-Z_]+))\) \{/g),
  ];
  const fimDaCadeia = fonte.indexOf("{ erro: 'Canal não reconhecido' }");
  return marcas.map((m, i) => ({
    cabecalho: m[1],
    corpo: fonte.slice(m.index! + m[0].length, marcas[i + 1]?.index ?? fimDaCadeia),
  }));
}

describe('todo ramo do Pusher autoriza no próprio ramo', () => {
  const lista = ramos(rota);

  it('⚠️ VACUIDADE: acha os quatro ramos que existem hoje, e o default que nega', () => {
    expect(lista.map((r) => r.cabecalho)).toEqual([
      "canal.startsWith('private-user-')",
      "canal.startsWith('private-chat-')",
      'canal === CANAL_SALA_DE_ESPERA',
      "canal.startsWith('presence-sala-')",
    ]);
    expect(rota).toMatch(
      /return NextResponse\.json\(\{ erro: 'Canal não reconhecido' \}, \{ status: 403 \}\);/,
    );
  });

  it('⚠️ VACUIDADE: o detector acusa um ramo que só recusa', () => {
    const [ramo] = ramos(
      "if (canal.startsWith('x-')) { if (a) { return NextResponse.json({}, { status: 403 }); } } { erro: 'Canal não reconhecido' }",
    );
    expect(ramo.corpo).not.toMatch(/return NextResponse\.json\(autenticarCanal\(/);
  });

  it.each(ramos(rota).map((r) => [r.cabecalho, r.corpo] as const))(
    '🔴 `%s` termina com `return … autenticarCanal(`',
    (_cabecalho, corpo) => {
      expect(corpo).toMatch(/return NextResponse\.json\(autenticarCanal\(socketId, canal/);
    },
  );
});
