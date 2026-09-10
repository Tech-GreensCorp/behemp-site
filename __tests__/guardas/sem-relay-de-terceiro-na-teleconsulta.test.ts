/**
 * Guarda: a mídia da consulta não atravessa relay de terceiro sem contrato, e nenhuma
 * credencial de retransmissão fica escrita no código.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Até 20/08/2026 a lista de `iceServers` estava escrita em DOIS arquivos do cliente com o
 * relay gratuito `openrelay.metered.ca` e a credencial `openrelayproject`, que é pública na
 * internet. Quando a conexão direta falha — Wi-Fi corporativo, 4G, firewall —, TODA a mídia
 * da consulta médica passa pelo relay: operador de dado de saúde sem contrato, sem SLA, com
 * credencial compartilhada com o mundo. Item 8 de docs/04-LISTA-DE-AFAZERES.md.
 *
 * O dono escolheu a Cloudflare Realtime TURN em 20/08/2026, entre 4 opções comparadas com
 * preço, e a credencial passou a ser gerada no servidor com validade de 2 h.
 *
 * ⚠️ ESTE GUARDA NASCEU VERDE, E ISSO É DE PROPÓSITO.
 * Ele foi escrito DEPOIS da correção, não antes. Guarda para violação conhecida e não
 * corrigida nasce vermelho e FICA vermelho — e guarda permanentemente vermelho é guarda que
 * alguém desliga (`.claude/rules/seguranca-lgpd.md`). A prova de que ele funciona é a
 * sabotagem: reintroduzir o array hardcoded deixa este arquivo vermelho.
 *
 * 🔴 A GRANULARIDADE IMPORTA, E JÁ ERROU UMA VEZ
 * Na primeira tentativa, a checagem procurou a string `openrelayproject` em qualquer posição
 * do arquivo — e acusou o COMENTÁRIO que documenta a correção. É exatamente o defeito que
 * produziu as duas falsas acusações do hook `git-perigoso` em 19/08: menção em documentação
 * lida como uso real. Aqui a checagem é por credencial em POSIÇÃO DE VALOR de propriedade.
 * Regra 2 de docs/TECNICA-DOS-GUARDAS.md.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');

/** Onde uma videochamada é criada neste produto. */
const TELAS_DE_CHAMADA = [
  'components/teleconsulta/GlobalTeleconsultaHost.tsx',
  'app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx',
  'app/(medico)/medico/teleconsulta/page.tsx',
];

/**
 * Relays de terceiro conhecidos por serem gratuitos e sem contrato. Lista de partida, não
 * exaustiva — a checagem de credencial abaixo pega o caso geral.
 */
const RELAYS_SEM_CONTRATO = ['openrelay.metered.ca', 'relay.metered.ca', 'freeturn.'];

/**
 * Credencial em POSIÇÃO DE VALOR — `credential: '...'` ou `username: '...'` com literal.
 * Menção em comentário não conta: ver o parágrafo de granularidade no topo.
 */
const CREDENCIAL_LITERAL = /(?:username|credential)\s*:\s*['"`][^'"`$]+['"`]/;

/** Um `urls:` de TURN com endereço literal no código do cliente. */
const TURN_LITERAL = /urls\s*:\s*['"`]turns?:/;

function fonte(arquivo: string): string {
  return readFileSync(join(RAIZ, arquivo), 'utf8');
}

describe('a mídia da consulta não atravessa relay de terceiro', () => {
  // Vacuidade: se os caminhos mudarem de nome, o guarda passaria sobre zero arquivo.
  it('o guarda enxerga as telas que precisa proteger', () => {
    for (const arquivo of TELAS_DE_CHAMADA) {
      expect(() => fonte(arquivo), `${arquivo} não existe — o guarda ficou sem alvo`).not.toThrow();
    }
    const comChamada = TELAS_DE_CHAMADA.filter((a) => /RTCPeerConnection/.test(fonte(a)));
    expect(
      comChamada.length,
      'nenhuma tela cria RTCPeerConnection — a lista de alvos está errada',
    ).toBeGreaterThanOrEqual(2);
  });

  it.each(TELAS_DE_CHAMADA)('%s não aponta para relay gratuito de terceiro', (arquivo) => {
    const texto = fonte(arquivo);
    // Só conta dentro de um `urls:` — o nome do serviço pode aparecer em comentário que
    // explica a correção, e isso não é uso.
    const usos = [...texto.matchAll(/urls\s*:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
    const proibidos = usos.filter((u) => RELAYS_SEM_CONTRATO.some((r) => u.includes(r)));
    expect(
      proibidos,
      `${arquivo} aponta a mídia da consulta para relay sem contrato de operador: ` +
        `${proibidos.join(', ')}. Use /api/teleconsulta/ice-servers, que gera credencial ` +
        `efêmera do provedor contratado.`,
    ).toEqual([]);
  });

  it.each(TELAS_DE_CHAMADA)(
    '%s não tem credencial de retransmissão escrita no código',
    (arquivo) => {
      const texto = fonte(arquivo);
      expect(
        CREDENCIAL_LITERAL.test(texto),
        `${arquivo} tem credencial literal de ICE server. Credencial no cliente é credencial ` +
          `vazada — ela é gerada no servidor, com validade curta.`,
      ).toBe(false);
    },
  );

  it.each(TELAS_DE_CHAMADA)('%s não fixa endereço de TURN no cliente', (arquivo) => {
    expect(
      TURN_LITERAL.test(fonte(arquivo)),
      `${arquivo} fixa um endereço de TURN. Trocar de provedor passaria a exigir mudar tela — ` +
        `foi a duplicação que fez o diagnóstico inicial contar 1 ocorrência quando havia 2.`,
    ).toBe(false);
  });
});

describe('a credencial de retransmissão é gerada no servidor e só para quem está na sala', () => {
  const ENDPOINT = 'app/api/teleconsulta/ice-servers/route.ts';

  it('o endpoint existe e lê a credencial do ambiente, não do código', () => {
    const texto = fonte(ENDPOINT);
    expect(/process\.env\.CLOUDFLARE_TURN_KEY_ID/.test(texto)).toBe(true);
    expect(/process\.env\.CLOUDFLARE_TURN_API_TOKEN/.test(texto)).toBe(true);
    expect(
      CREDENCIAL_LITERAL.test(texto),
      'o endpoint tem credencial literal — deveria vir só do ambiente',
    ).toBe(false);
  });

  it('só entrega credencial a quem participa da sala', () => {
    // Sem isto, qualquer usuário autenticado consome a cota paga da conta.
    expect(
      /garantirDonoDaSala\s*\(/.test(fonte(ENDPOINT)),
      'o endpoint entrega credencial de TURN sem verificar vínculo com a sala',
    ).toBe(true);
  });

  it('as variáveis estão declaradas no schema de ambiente e no .env.example', () => {
    expect(/CLOUDFLARE_TURN_KEY_ID/.test(fonte('lib/env.ts'))).toBe(true);
    expect(/CLOUDFLARE_TURN_API_TOKEN/.test(fonte('lib/env.ts'))).toBe(true);
    expect(/CLOUDFLARE_TURN_KEY_ID/.test(fonte('.env.example'))).toBe(true);
  });
});

// CONTROLE CONTRA FALSA ACUSAÇÃO
// Este describe não olha o repositório: exercita as regras contra textos construídos, para
// provar que elas distinguem USO de MENÇÃO. Existe porque a primeira versão deste guarda
// acusou o próprio comentário que documentava a correção — o mesmo defeito das duas falsas
// acusações do hook `git-perigoso` em 19/08/2026. Guarda que acusa inocente é guarda que
// alguém desliga.
describe('controle: menção em documentação não é uso', () => {
  const MENCOES_LEGITIMAS = [
    '// Aqui havia openrelay.metered.ca com credencial openrelayproject, e foi removido',
    '/* O relay antigo usava username: era openrelayproject — não use mais */',
    '// Item 8: credential pública openrelayproject saiu do código em 20/08',
  ];

  it.each(MENCOES_LEGITIMAS)('não acusa: %s', (texto) => {
    const usosDeUrl = [...texto.matchAll(/urls\s*:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
    expect(usosDeUrl, 'comentário não é um urls: de configuração').toEqual([]);
    expect(CREDENCIAL_LITERAL.test(texto), 'menção em comentário não é credencial em uso').toBe(
      false,
    );
    expect(TURN_LITERAL.test(texto), 'menção em comentário não é endereço de TURN').toBe(false);
  });

  it('mas ACUSA o uso real, senão o controle acima seria vácuo', () => {
    const usoReal =
      "{ urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }";
    const usosDeUrl = [...usoReal.matchAll(/urls\s*:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
    expect(usosDeUrl.some((u) => RELAYS_SEM_CONTRATO.some((r) => u.includes(r)))).toBe(true);
    expect(CREDENCIAL_LITERAL.test(usoReal)).toBe(true);
    expect(TURN_LITERAL.test(usoReal)).toBe(true);
  });
});
