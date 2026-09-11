/**
 * GUARDA — buscar o documento do parceiro não pode virar SSRF, nem inventar dado clínico.
 *
 * A CLASSE DE ERRO: desde 10/09/2026 o handoff aceita URLs de arquivo e o nosso servidor as
 * baixa. Isso é exatamente a forma do SSRF — OWASP A10:2021: "SSRF flaws occur whenever a web
 * application is fetching a remote resource without validating the user-supplied URL".
 *
 * Sem allowlist, uma URL apontando para 169.254.169.254 faria o NOSSO servidor buscar as
 * credenciais da instância na AWS e devolvê-las para quem pediu. Com allowlist mas sem
 * resolução de DNS, um host autorizado apontando para 127.0.0.1 passa — é DNS rebinding, que
 * o cheat sheet da OWASP nomeia.
 *
 * A segunda classe é de domínio: `dataEmissao` e `dataValidade` são `notNull`, e a tentação é
 * preencher com qualquer coisa quando o parceiro não informa. Data de validade de documento
 * inventada é pior que ausente — alguém acredita nela.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizarEntradas, origemAutorizada } from '@/lib/parceiros/documentos-do-parceiro';
import { normalizarManifesto, pendenciasDe } from '@/lib/parceiros/documentos';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');
const BUSCADOR = 'lib/parceiros/documentos-do-parceiro.ts';
const MATERIALIZAR = 'lib/parceiros/materializar-documentos.ts';
const CADASTRO = 'app/_actions/cadastro-por-link.ts';

describe('a URL do parceiro é conferida antes de qualquer requisição', () => {
  it('recusa http — segredo e documento não trafegam em claro', async () => {
    process.env.PARCEIRO_ORIGENS_DE_DOCUMENTO = 'https://greens-corp.com';
    const r = await origemAutorizada('http://greens-corp.com/doc.pdf');
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('sem_https');
  });

  it('recusa origem fora da lista', async () => {
    process.env.PARCEIRO_ORIGENS_DE_DOCUMENTO = 'https://greens-corp.com';
    const r = await origemAutorizada('https://outra-empresa.com/doc.pdf');
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('origem_nao_autorizada');
  });

  /**
   * 🔴 O CASO QUE MATA A COMPARAÇÃO POR PREFIXO.
   *
   * `https://greens-corp.com.evil.test` COMEÇA com `https://greens-corp.com`. Se a checagem
   * fosse `startsWith`, o atacante escolheria o destino. É a mesma armadilha do
   * redirecionamento aberto, que a ADR-0016 já tinha resolvido do outro lado.
   */
  it('não cai em domínio que apenas COMEÇA com o autorizado', async () => {
    process.env.PARCEIRO_ORIGENS_DE_DOCUMENTO = 'https://greens-corp.com';
    const r = await origemAutorizada('https://greens-corp.com.evil.test/doc.pdf');
    expect(r.ok).toBe(false);
    /**
     * 🔴 O MOTIVO IMPORTA, E É O QUE FAZ ESTE CASO VALER.
     *
     * Só `ok === false` não prova nada aqui: um domínio inventado também falha no DNS, e o
     * teste ficaria verde mesmo com a checagem trocada por `startsWith` — foi exatamente o
     * que a sabotagem mostrou, em 10/09/2026, antes desta linha existir.
     *
     * Exigir `origem_nao_autorizada` prova que a recusa veio da comparação de ORIGEM, e não
     * de um acidente de resolução de nome.
     */
    expect(r.motivo).toBe('origem_nao_autorizada');
  });

  it('sem origens configuradas, nada é baixado — falha fechada', async () => {
    const antes = { ...process.env };
    delete process.env.PARCEIRO_ORIGENS_DE_DOCUMENTO;
    delete process.env.PARCEIRO_ORIGENS_DE_RETORNO;
    const r = await origemAutorizada('https://greens-corp.com/doc.pdf');
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('sem_origens_configuradas');
    process.env = antes;
  });

  it('recusa host que resolve para dentro da rede — inclui o metadata da nuvem', async () => {
    process.env.PARCEIRO_ORIGENS_DE_DOCUMENTO = 'https://localhost';
    const r = await origemAutorizada('https://localhost/doc.pdf');
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('aponta_para_rede_interna');
  });
});

describe('o código do buscador mantém as defesas que não dá para testar por fora', () => {
  const codigo = ler(BUSCADOR);

  it('resolve o DNS na validação — sem isso, rebinding passa', () => {
    expect(codigo).toContain("from 'node:dns/promises'");
    expect(codigo).toContain('lookup(');
  });

  it('bloqueia 169.254 — é onde vive o metadata da instância', () => {
    expect(codigo).toMatch(/a === 169 && b === 254/);
  });

  it('não segue redirecionamento — é como se escapa de uma allowlist', () => {
    expect(codigo).toContain("redirect: 'error'");
  });

  it('tem limite de tamanho, tempo e tipo de arquivo', () => {
    expect(codigo).toContain('TAMANHO_MAXIMO');
    expect(codigo).toContain('AbortSignal.timeout');
    expect(codigo).toContain('TIPOS_ACEITOS');
  });

  it('nunca deixa a falha subir: o cadastro do paciente não pode cair por um PDF', () => {
    expect(codigo).toMatch(/catch \(erro\)/);
    expect(codigo).toContain('recusados.push');
  });

  it('não imprime a URL em log — ela pode conter assinatura de acesso', () => {
    const handoff = ler('lib/parceiros/handoff.ts');
    const i = handoff.indexOf('documentos recusados');
    expect(i).toBeGreaterThan(-1);
    expect(handoff.slice(i, i + 220)).not.toContain('.url');
  });
});

describe('a data de um documento não se inventa', () => {
  const codigo = ler(MATERIALIZAR);

  it('reusa a regra de validade que já existia, não cria uma segunda', () => {
    expect(codigo).toContain('calcularValidade');
  });

  it('quando o parceiro não informa a emissão, a observação DIZ isso', () => {
    expect(codigo).toContain('data de emissão não informada pelo parceiro');
  });

  it('laudo_medico não é forçado em outro tipo — não há equivalente na tabela', () => {
    const i = codigo.indexOf('const TRADUCAO');
    const bloco = codigo.slice(i, i + 400);
    expect(bloco).not.toMatch(/laudo_medico:\s*'/);
  });

  it('documento_identidade é traduzido para o vocabulário da tabela', () => {
    expect(codigo).toMatch(/documento_identidade:\s*'rg'/);
  });
});

describe('a ordem: o arquivo só vira documento quando o paciente existe', () => {
  const codigo = ler(CADASTRO);

  it('materializa DEPOIS de o pacienteId existir', () => {
    const criacao = codigo.indexOf('const pacienteId = await db.transaction');
    const copia = codigo.indexOf('materializarDocumentosDoParceiro({');
    expect(criacao).toBeGreaterThan(-1);
    expect(copia).toBeGreaterThan(criacao);
  });

  it('e fora da transação — copiar documento não desfaz cadastro que deu certo', () => {
    const fimDaTransacao = codigo.indexOf('const consumiu = await marcarComoUtilizada');
    const copia = codigo.indexOf('materializarDocumentosDoParceiro({');
    expect(copia).toBeGreaterThan(fimDaTransacao);
  });
});

describe('retrocompatibilidade — o formato antigo continua valendo', () => {
  it('lista de nomes continua virando manifesto', () => {
    expect(normalizarManifesto(['documento_identidade', 'laudo_medico'])).toEqual([
      'documento_identidade',
      'laudo_medico',
    ]);
  });

  it('lista de objetos também vira manifesto', () => {
    expect(normalizarManifesto([{ tipo: 'receita_medica', urlBlob: 'x' }])).toEqual([
      'receita_medica',
    ]);
  });

  it('pendenciasDe entende as duas formas', () => {
    const a = pendenciasDe(['receita_medica']).map((p) => p.chave);
    const b = pendenciasDe([{ tipo: 'receita_medica', urlBlob: 'x' }]).map((p) => p.chave);
    expect(a).toEqual(b);
    expect(a).not.toContain('receita_medica');
  });

  it('separa o que tem arquivo do que é só nome', () => {
    const r = normalizarEntradas([
      'laudo_medico',
      { tipo: 'receita_medica', url: 'https://greens-corp.com/r.pdf' },
    ]);
    expect(r.manifesto).toContain('laudo_medico');
    expect(r.manifesto).toContain('receita_medica');
    expect(r.comArquivo).toHaveLength(1);
  });

  it('entrada malformada é descartada, não derruba o cadastro', () => {
    // `as never`: o teste existe justamente para provar que entrada MALFORMADA é descartada,
    // e malformada é o que o tipo não permite escrever.
    const r = normalizarEntradas([
      { tipo: 'receita_medica' },
      { url: 'https://x.com/a.pdf' },
    ] as never);
    expect(r.comArquivo).toHaveLength(0);
  });
});

/**
 * A allowlist só existe se o valor chegar ao servidor.
 *
 * 🔴 CADASTRAR O SECRET NO GITHUB NÃO BASTA. O `deploy.yml` escreve uma lista FIXA de chaves
 * no `.env` do servidor — um secret que não está nessa lista fica no GitHub e nunca chega ao
 * processo. Aconteceu em 10/09/2026: o secret foi cadastrado e o deploy não o escrevia.
 *
 * Sem ele, `origensPermitidas()` cai no `PARCEIRO_ORIGENS_DE_RETORNO` — que tem o domínio do
 * site da Greens, não o bucket de onde os documentos saem. Todo arquivo seria recusado, e em
 * silêncio: recusa vira pendência, não erro.
 */
describe('a variável da allowlist chega ao servidor', () => {
  it('o deploy escreve PARCEIRO_ORIGENS_DE_DOCUMENTO no .env', () => {
    const yaml = readFileSync(path.join(raiz, '.github/workflows/deploy.yml'), 'utf8');
    expect(yaml).toMatch(/gravar PARCEIRO_ORIGENS_DE_DOCUMENTO\s+"\$\{\{ secrets\./);
  });

  it('e o código lê essa variável antes do fallback', () => {
    const codigo = ler(BUSCADOR);
    const i = codigo.indexOf('PARCEIRO_ORIGENS_DE_DOCUMENTO');
    const j = codigo.indexOf('PARCEIRO_ORIGENS_DE_RETORNO');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(-1);
    // a específica vem primeiro; a de retorno é só o fallback
    expect(i).toBeLessThan(j);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('os downloads acontecem em paralelo, sem perder proteção', () => {
  /**
   * 🔴 ACRESCENTADO EM 11/09/2026, depois de a Greens medir do lado deles:
   *
   *   "cria conta → baixa 3 arquivos (sequencial) → responde   ← 15-45 s"
   *
   * O handoff deles ESPERA esta função. Em fila, três documentos viram quase um minuto, e o
   * timeout de 30 s que eles puseram é curativo. Paralelizar derruba o pior caso para o do
   * documento mais lento.
   *
   * ⚠️ O RISCO DE PARALELIZAR É PERDER UMA CHECAGEM no caminho — por isso os casos abaixo
   * medem que cada proteção continua DENTRO do caminho de cada documento.
   */
  const fonte = readFileSync(
    path.join(process.cwd(), 'lib/parceiros/documentos-do-parceiro.ts'),
    'utf8',
  );
  const semComent = fonte
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
  const fn = semComent.slice(semComent.indexOf('export async function materializarArquivos'));

  it('🔴 não baixa em fila — `for` sequencial com `await` dentro some', () => {
    expect(fn).toContain('await Promise.all(');
    expect(fn).not.toMatch(/for \(const entrada of entradas\)/);
  });

  it('cada documento continua passando pela allowlist', () => {
    expect(fn).toContain('await origemAutorizada(entrada.url)');
  });

  it('cada download continua recusando redirect', () => {
    expect(fn).toContain("redirect: 'error'");
  });

  it('cada download continua com tempo limite', () => {
    expect(fn).toContain('AbortSignal.timeout(TEMPO_LIMITE_MS)');
  });

  it('o MIME e o tamanho continuam conferidos por documento', () => {
    expect(fn).toContain('TIPOS_ACEITOS.has(mime)');
    expect(fn).toContain('bytes.byteLength > TAMANHO_MAXIMO');
  });

  it('e o blob continua privado', () => {
    expect(fn).toMatch(/ACESSO_DO_BLOB = 'private'/);
  });

  it('🔴 uma falha não derruba as outras — cada documento tem o próprio catch', () => {
    expect(fn).toMatch(/catch \(erro\)[\s\S]{0,220}erro_desconhecido/);
    // `Promise.all` com rejeição derrubaria o lote inteiro; aqui nada rejeita.
    expect(fn).not.toContain('Promise.allSettled');
    expect(fn).not.toMatch(/^\s*throw /m);
  });

  it('o recusado continua sendo reportado, com o motivo', () => {
    expect(fn).toMatch(/recusados\.push\(\{ tipo: r\.tipo, motivo: r\.motivo \}\)/);
  });
});
