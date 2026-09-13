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

const FONTE_MOD = readFileSync(
  path.join(process.cwd(), 'lib/parceiros/documentos-do-parceiro.ts'),
  'utf8',
);

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
    expect(r.motivo).toMatch(/^origem_nao_autorizada/);
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
    expect(r.motivo).toMatch(/^origem_nao_autorizada/);
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

  /**
   * ⚠️ ESTES DOIS OLHAM O `fetch`, ONDE QUER QUE ELE ESTEJA — e a mudança é de 13/09/2026.
   *
   * Eles liam só o corpo de `materializarArquivos`. Quando o download ganhou retentativa e saiu
   * para `baixarComRetentativa`, os dois ficaram vermelhos acusando o código certo — **e isso
   * foi útil**: as duas proteções são anti-SSRF, e um guarda que não as encontra mais é um
   * guarda que deixou de vigiar. O conserto é olhar o `fetch`, não o recorte.
   */
  const blocoDoFetch = () => {
    const i = semComent.indexOf('await fetch(');
    expect(i, 'não há mais fetch do documento — o guarda perdeu o alvo').toBeGreaterThan(-1);
    return semComent.slice(i, semComent.indexOf('});', i));
  };

  it('cada download continua recusando redirect', () => {
    // Seguir redirect é como se escapa de uma allowlist: o primeiro host passa, o segundo não.
    expect(blocoDoFetch(), 'o fetch do documento voltou a seguir redirect').toContain(
      "redirect: 'error'",
    );
  });

  it('cada download continua com tempo limite', () => {
    expect(blocoDoFetch(), 'o fetch do documento perdeu o tempo limite').toContain(
      'AbortSignal.timeout(TEMPO_LIMITE_MS)',
    );
  });

  it('🔴 e a retentativa NÃO insiste contra 403/404 — expirada é expirada', () => {
    /**
     * Insistir contra veredicto definitivo gasta a janela de validade de que as falhas
     * transitórias precisam — e, no caso do 403, martela a assinatura do parceiro à toa.
     */
    const i = semComent.indexOf('async function baixarComRetentativa');
    expect(i, 'a retentativa sumiu').toBeGreaterThan(-1);
    const fnRetry = semComent.slice(i, semComent.indexOf('\n}', i));
    expect(fnRetry, 'a retentativa insiste contra 403/404').toMatch(/403|404/);
    expect(fnRetry, 'a retentativa não tem limite de vezes').toMatch(/TENTATIVAS_DE_DOWNLOAD/);
  });

  it('o MIME e o tamanho continuam conferidos por documento', () => {
    expect(fn).toContain('TIPOS_ACEITOS.has(mime)');
    expect(fn).toContain('bytes.byteLength > TAMANHO_MAXIMO');
  });

  it('🔴 e o MOTIVO da recusa distingue — `erro.name` é sempre "Error"', () => {
    /**
     * 🔴 Medido em produção em 13/09/2026, e custou o diagnóstico do fluxo 1 inteiro:
     *
     *     [parceiros] documentos recusados: receita_medica:Error,comprovante_residencia:Error
     *
     * `erro.name` de um `new Error()` é **sempre** `'Error'`. Três documentos que podem ter
     * falhado por motivos diferentes produziram a mesma palavra, e não havia como saber se foi
     * allowlist, 403, MIME ou DNS — informações que o código já calcula e jogava fora.
     */
    expect(semComent, 'o motivo voltou a ser erro.name, que não distingue nada').not.toMatch(
      /motivo: erro instanceof Error \? erro\.name/,
    );

    /**
     * ⚠️ E NUNCA a URL: a `message` de um erro de `fetch` costuma trazer o endereço, e o do
     * parceiro carrega assinatura de acesso ao S3 dele. Log não é lugar de credencial.
     */
    const i = semComent.indexOf('function motivoLegivel');
    expect(i, 'a função que monta o motivo sumiu').toBeGreaterThan(-1);
    const helper = semComent.slice(i, semComent.indexOf('\n}', i));
    expect(helper, 'o motivo pode vazar a URL assinada do parceiro').toMatch(/https\?/);
  });

  it('e o blob continua privado', () => {
    /**
     * 🔴 RETIFICADO EM 13/09/2026 — este caso media a FORMA e ficava verde com o defeito.
     *
     * Ele exigia a constante `ACESSO_DO_BLOB = 'private'`, que existia e estava certa —
     * enquanto o `put` falhava com `Cannot use private access on a public store` em TODOS os
     * documentos do SOL-000046. Acesso não é propriedade do upload: é do STORE, escolhido na
     * criação e imutável. Declarar a intenção no ponto de chamada não guarda nada.
     *
     * A propriedade que importa: este arquivo não chama `put` — ele delega a `store-privado`,
     * que resolve o store certo e LANÇA quando o token falta, em vez de cair para público com
     * documento de paciente de outra empresa dentro.
     */
    expect(fn).toContain('guardarDocumentoPrivado');
    expect(fn, 'escolher o store aqui é escolher se o RG fica legível sem auth').not.toMatch(
      /\bput\(/,
    );
  });

  it('🔴 uma falha não derruba as outras — cada documento tem o próprio catch', () => {
    /**
     * ⚠️ RETIFICADO EM 13/09/2026. A versão anterior exigia a string `erro_desconhecido` a até
     * 220 caracteres do `catch` — e ficou vermelha quando o motivo passou a ser calculado por
     * uma função, acusando o conserto. **Sexta vez nesta sessão que um guarda meu congela a
     * forma em vez da propriedade.**
     *
     * A propriedade é: o `catch` existe DENTRO do map (um por documento) e **devolve** em vez
     * de lançar — é isso que impede que um documento ruim derrube os outros e o handoff junto.
     */
    expect(fn, 'o catch por documento sumiu').toMatch(/catch \(erro\)/);

    const i = fn.indexOf('catch (erro)');
    const bloco = fn.slice(i, fn.indexOf('\n          }', i));
    expect(bloco, 'o catch relança — uma falha derrubaria o handoff inteiro').not.toMatch(/throw /);
    expect(bloco, 'o catch não devolve a recusa do documento').toMatch(/ok: false/);
    // `Promise.all` com rejeição derrubaria o lote inteiro; aqui nada rejeita.
    expect(fn).not.toContain('Promise.allSettled');
    expect(fn).not.toMatch(/^\s*throw /m);
  });

  it('o recusado continua sendo reportado, com o motivo', () => {
    expect(fn).toMatch(/recusados\.push\(\{ tipo: r\.tipo, motivo: r\.motivo \}\)/);
  });
});

/**
 * 🔴 O DOCUMENTO NÃO É CONVENIÊNCIA — decisão do dono em 13/09/2026.
 *
 *   _"o envio do documento é tão necessário quanto a criação da conta. O paciente passa por 2
 *   formulários e 1 se torna à toa e o outro mentiroso, já que os dados nunca chegam. Para que
 *   serve então esse fluxo todo que estamos criando?"_
 *
 * **Medido:** dos 67 itens de documento recebidos da Greens, ZERO tinham arquivo. E quando um
 * download falhava, o item voltava ao banco como a mesma `string` do documento que o parceiro
 * nunca mandou — tornando os dois fatos indistinguíveis.
 */
describe('a recusa de documento deixa rastro — não vira "nunca mandou"', () => {
  const handoff = readFileSync(
    path.join(process.cwd(), 'lib/parceiros/handoff.ts'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  it('⚠️ VACUIDADE: o handoff ainda monta o manifesto a partir do que recusou', () => {
    expect(handoff).toMatch(/materializarArquivos\(/);
    expect(handoff).toMatch(/recusados/);
  });

  it('🔴 o item recusado guarda o MOTIVO — senão some a prova de que o parceiro mandou', () => {
    /**
     * Sem isto, "a Greens não mandou" e "a Greens mandou e nós não conseguimos buscar" viram o
     * mesmo registro. Foi o que fez 67 itens passarem semanas sem dono — e o que quase me fez
     * escrever na ADR que ela "nunca manda arquivo", quando o log provava o contrário.
     */
    expect(handoff, 'a recusa não é gravada no manifesto').toMatch(/recusadoPorque/);

    const i = handoff.indexOf('const semArquivo');
    expect(i, 'não achei a montagem do manifesto').toBeGreaterThan(-1);
    const bloco = handoff.slice(i, handoff.indexOf('return [...semArquivo', i));
    expect(bloco, 'o item recusado volta a ser string pura').toMatch(/recusadosPorTipo/);
  });

  it('🔴 e o tipo do manifesto CONHECE a recusa — sem lista paralela', () => {
    /**
     * A forma do manifesto estava escrita à mão em dois lugares. Quando a terceira variante
     * nasceu, a cópia não soube — e só não divergiu em silêncio porque o type-check pegou.
     */
    const schema = readFileSync(
      path.join(process.cwd(), 'db/schema/solicitacoes-cadastro.ts'),
      'utf8',
    );
    expect(schema, 'o schema não conhece a recusa').toMatch(/recusadoPorque/);

    const token = readFileSync(
      path.join(process.cwd(), 'lib/chatpro/token-de-cadastro.ts'),
      'utf8',
    );
    expect(token, 'voltou a declarar a forma do manifesto à mão').toMatch(
      /documentosDoParceiro: DocumentoDoParceiro\[\] \| null/,
    );
  });

  it('🔴 o código NÃO trata documento como conveniência dispensável', () => {
    /**
     * O comentário antigo dizia _"documento é conveniência; o cadastro é o que importa"_ em três
     * arquivos. Não lançar continua certo — deixar o paciente sem conta E sem documento é pior.
     * O que mudou é que a falha é **fato a cobrar**, não custo aceito.
     */
    for (const arq of [
      'lib/parceiros/handoff.ts',
      'lib/parceiros/documentos-do-parceiro.ts',
      'lib/parceiros/materializar-documentos.ts',
    ]) {
      /**
       * ⚠️ Só o CÓDIGO, não os comentários — que é onde a decisão antiga fica registrada como
       * histórico. Apagar o registro do que se pensava antes é pior que mantê-lo: a ADR-0007
       * mudou duas vezes, e o caminho ensinou mais que o destino.
       */
      const texto = readFileSync(path.join(process.cwd(), arq), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(texto, `${arq} voltou a tratar documento como conveniência no CÓDIGO`).not.toMatch(
        /[Dd]ocumento é conveniência/,
      );
    }
  });
});

/**
 * 🔴 A ORIGEM RECUSADA APARECE NO MOTIVO — e a assinatura NÃO.
 *
 * Medido em produção em 13/09/2026: o log dizia `receita_medica:origem_nao_autorizada` e parava
 * aí. A allowlist tinha o bucket certo e mesmo assim recusava — sem dizer **qual** origem
 * chegou, não havia o que corrigir.
 *
 * ⚠️ O S3 serve o mesmo arquivo por dois endereços com origens diferentes:
 *   virtual-hosted: https://<bucket>.s3.<regiao>.amazonaws.com/<chave>
 *   path-style:     https://s3.<regiao>.amazonaws.com/<bucket>/<chave>
 *
 * Uma allowlist com o primeiro recusa o segundo em silêncio.
 */
describe('a origem recusada é dita, sem vazar a assinatura', () => {
  it('🔴 o motivo carrega a origem que chegou', async () => {
    const { origemAutorizada } = await import('@/lib/parceiros/documentos-do-parceiro');
    const r = await origemAutorizada(
      'https://s3.us-east-1.amazonaws.com/bucket/x.pdf?X-Amz-Signature=abc123',
    );
    expect(r.ok).toBe(false);
    expect(r.motivo, 'o motivo não diz qual origem chegou').toContain('s3.us-east-1.amazonaws.com');
  });

  it('🔴 e NUNCA a query string — é lá que vive o X-Amz-Signature', () => {
    /**
     * O host é público: aparece em qualquer requisição. A query string do S3 carrega a
     * assinatura, e quem a tiver baixa o documento clínico sem mais nada.
     */
    const i = FONTE_MOD.indexOf('origem_nao_autorizada:');
    expect(i, 'o motivo não carrega a origem').toBeGreaterThan(-1);
    const linha = FONTE_MOD.slice(FONTE_MOD.lastIndexOf('\n', i), FONTE_MOD.indexOf('\n', i));
    expect(linha, 'o motivo usa a URL inteira — vaza a assinatura').not.toMatch(
      /alvo\.href|\burl\b/,
    );
    expect(linha, 'o motivo deveria usar só o origin').toMatch(/alvo\.origin/);
  });
});
