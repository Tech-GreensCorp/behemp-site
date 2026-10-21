/**
 * GUARDA — documento de paciente não abre por URL, e não abre para quem não é dele.
 *
 * A CLASSE DE ERRO: até 10/09/2026 todo documento deste projeto ia para store **público** —
 * RG, laudo, receita e procuração assinada legíveis por qualquer um com o endereço. É o Item 6,
 * e a regra do repositório é literal: _"Store público significa: quem tem a URL lê, sem
 * autenticação. Obscuridade de URL não é controle de acesso."_
 *
 * Decisão do dono em 10/09/2026: _"então vamos colocar no nosso store privado"_.
 *
 * Duas coisas não podem regredir, e a segunda é a que mata:
 *
 *   1. **os caminhos novos gravam privado** — e voltar a `'public'` é uma letra
 *   2. **a entrega confere escopo de OBJETO** — papel certo com id alheio é OWASP API1
 *      (BOLA), o risco número um deste projeto. Autenticar sem conferir de quem é o documento
 *      entrega o RG de qualquer paciente a qualquer médico.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ehDoStorePrivado,
  guardarDocumentoPrivado,
  StorePrivadoNaoConfigurado,
  tokenDoStorePrivado,
} from '@/lib/documentos/store-privado';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

/** Todos os `.ts`/`.tsx` sob os diretórios dados, em caminho relativo à raiz. */
function varrer(dirs: string[]): string[] {
  const saida: string[] = [];
  const andar = (rel: string) => {
    let entradas: string[];
    try {
      entradas = readdirSync(path.join(raiz, rel));
    } catch {
      return;
    }
    for (const nome of entradas) {
      const filho = path.join(rel, nome);
      if (statSync(path.join(raiz, filho)).isDirectory()) andar(filho);
      else if (/\.tsx?$/.test(nome)) saida.push(filho);
    }
  };
  dirs.forEach(andar);
  return saida;
}

const ESCOPO = 'lib/auth/escopo-documento.ts';
const ROTA = 'app/api/documentos/[id]/arquivo/route.ts';
const ANEXO = 'lib/documentos/anexo-do-cadastro.ts';
const PARCEIRO = 'lib/parceiros/documentos-do-parceiro.ts';

/** Sem comentários: os arquivos EXPLICAM o que não pode voltar, e a menção não é uso. */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\/\*|\*)/.test(linha))
    .join('\n');
}

/**
 * 11/09/2026 — o Item 6 fechando ponto a ponto.
 *
 * Decisão do dono: _"AGORA É O MOMENTO de ajustarmos isso"_. Os quatro pontos que gravam na
 * tabela `documentos` passaram a gravar privado, e as três telas que os abriam passaram a
 * apontar para a rota autenticada.
 *
 * 🔴 A ORDEM IMPORTA, e é o que este bloco protege: **a tela vem antes do upload**. Trocar o
 * upload sem trocar a tela deixa o documento INVISÍVEL — e invisível é pior que público,
 * porque some sem ninguém perceber.
 */
describe('os pontos que gravam em `documentos` não gravam mais público', () => {
  const PONTOS = [
    'app/_actions/documentos.ts',
    'app/_actions/documentos-paciente.ts',
    'app/_actions/documentos-paciente-self.ts',
    'app/api/upload-documento/route.ts',
  ];

  /**
   * 🔴 A PROPRIEDADE, NÃO A FORMA — retificado em 13/09/2026.
   *
   * A versão anterior exigia o literal `access: 'private'` em cada ponto. Ela ficava VERDE
   * enquanto os seis caminhos gravavam contra um store PÚBLICO e o SDK recusava todos:
   * `access` no `put` não escolhe nada, porque acesso é propriedade do STORE, imutável desde
   * a criação. O guarda media a intenção escrita, e a intenção estava certa — o resultado é
   * que não.
   *
   * O que importa agora: o ponto **não chama `put` direto**. Quem chama `put` pode escolher o
   * store, e escolher o store é escolher se o RG do paciente fica legível sem autenticação.
   */
  it.each(PONTOS.map((p) => [p] as const))('%s grava pelo store privado', (ponto) => {
    const codigo = semComentarios(ler(ponto));
    expect(codigo).toContain('guardarDocumentoPrivado');
    expect(codigo).not.toMatch(/\bput\(/);
    expect(codigo).not.toContain("access: 'public'");
  });

  /**
   * ⚠️ E o token não se escolhe no ponto de chamada.
   *
   * Três destes passavam `BLOB_BEHEMP_READ_WRITE_TOKEN` — a MESMA variável com que
   * `upload-avatar` e `upload-exame` gravam `access: 'public'`. Um token resolve um store, e
   * um store tem um único acesso: enquanto o nome do token estiver espalhado, alguém aponta
   * documento de paciente para o store errado sem que nada acuse.
   */
  it.each(PONTOS.map((p) => [p] as const))('%s não escolhe o token', (ponto) => {
    expect(semComentarios(ler(ponto))).not.toMatch(/BLOB_[A-Z_]*TOKEN/);
  });
});

describe('as telas abrem pela rota autenticada, nunca pela URL do blob', () => {
  const TELAS = [
    'app/(medico)/medico/pacientes/[id]/_components/tab-documentos.tsx',
    'app/(paciente)/paciente/perfil/page.tsx',
    'app/(paciente)/paciente/documentos/page.tsx',
  ];

  it.each(TELAS.map((t) => [t] as const))('%s', (tela) => {
    const codigo = ler(tela);
    /**
     * ⚠️ RETIFICADO em 15/09/2026. A versão anterior exigia o literal
     * `/api/documentos/${doc.id}/arquivo` NA TELA — e congelava o formato da entrega, não a
     * propriedade. Em 15/09 as telas trocaram o link de abrir-em-aba pelo
     * `<VisualizadorDeDocumento>`, que chama **a mesma rota** por dentro: o guarda ficou
     * vermelho por uma mudança que não afrouxou nada.
     *
     * A propriedade é: **a tela abre o documento por um caminho que autentica**. Isso é
     * verdade tanto com a URL escrita ali quanto delegando ao componente — e o componente
     * tem guarda próprio (`ver-o-documento-passa-pela-porta-autenticada`, 31 casos) que
     * proíbe ele mesmo de usar `urlBlob`.
     */
    const pelaRota = codigo.includes('/api/documentos/${doc.id}/arquivo');
    const peloVisualizador = codigo.includes('<VisualizadorDeDocumento');
    expect(
      pelaRota || peloVisualizador,
      'a tela não abre o documento nem pela rota nem pelo visualizador',
    ).toBe(true);

    /**
     * 🔴 E NÃO PODE SOBRAR O href DIRETO.
     *
     * Um blob privado não abre por link — a tela que ficou para trás mostra um erro para o
     * paciente no pior momento, e ninguém descobre até alguém reclamar. Com blob antigo é
     * pior: abre, sem autenticação e sem auditoria.
     */
    expect(codigo).not.toContain('href={doc.urlBlob}');
    expect(
      /(?:href|src)=\{[^}]*urlBlob/.test(codigo),
      'a tela voltou a abrir o documento pela URL do blob',
    ).toBe(false);
  });
});

describe('os caminhos novos gravam privado', () => {
  it.each([
    ['o anexo do cadastro', ANEXO],
    ['o documento que vem do parceiro', PARCEIRO],
  ])('%s', (_nome, arquivo) => {
    const codigo = semComentarios(ler(arquivo));
    expect(codigo).toContain('guardarDocumentoPrivado');
    expect(codigo).not.toMatch(/\bput\(/);
    expect(codigo).not.toContain("access: 'public'");
  });
});

/**
 * 🔴 O MÓDULO É A GARANTIA — e ele falha FECHADO.
 *
 * Se `store-privado` cair para o store público quando o token faltar, todo o resto deste
 * arquivo vira decoração: os seis pontos continuariam "gravando privado" e o RG do paciente
 * ficaria legível para quem tem a URL. É a diferença entre um módulo que centraliza e um
 * módulo que protege.
 */
describe('o store privado falha fechado', () => {
  const modulo = semComentarios(ler('lib/documentos/store-privado.ts'));

  it('lança quando o token não está configurado', () => {
    expect(modulo).toContain('StorePrivadoNaoConfigurado');
    expect(modulo).toMatch(/throw new StorePrivadoNaoConfigurado\(\)/);
  });

  it('e NUNCA cai para público', () => {
    expect(modulo).not.toContain("access: 'public'");
    expect(modulo).not.toMatch(/access:\s*[a-zA-Z]/);
  });

  it('o acesso não é parâmetro — quem chama não escolhe o store', () => {
    expect(modulo).not.toMatch(/access[?]?:\s*(BlobAccessType|string)/);
  });

  /**
   * ⚠️ A entrega é o segundo elo, e ele estava quebrado junto: `fetch(url)` cru responde 401
   * num blob privado. Não teria aparecido em teste nenhum enquanto o primeiro elo impedia
   * qualquer blob privado de existir.
   */
  it('a entrega sabe ler blob privado, não só fazer fetch', () => {
    /**
     * ⚠️ SEM AS LINHAS DE IMPORT — duas sabotagens sobreviveram por causa disto em
     * 13/09/2026. `toContain('lerDocumentoPrivado')` fica verde com o corpo trocado por
     * `fetch(url)`, porque o nome continua no import. Importar não é chamar; é a mesma
     * "menção vs uso" que já custou sete guardas neste repositório.
     */
    const corpo = semComentarios(ler('app/api/documentos/[id]/arquivo/route.ts'))
      .split('\n')
      .filter((linha) => !/^\s*import\b/.test(linha) && !/^\s*\}\s*from\s*'/.test(linha))
      .join('\n');

    expect(corpo).toMatch(/if\s*\(\s*ehDoStorePrivado\(\s*url\s*\)\s*\)/);
    expect(corpo).toMatch(/await lerDocumentoPrivado\(/);
  });

  it('e o host decide pelo fim, nunca por prefixo ou includes na URL inteira', () => {
    expect(modulo).toMatch(/new URL\(url\)\.host\.endsWith\(/);
  });
});

/**
 * 🔴 COBERTURA — o que pega o ponto SÉTIMO, que ainda não existe.
 *
 * Lista fixa envelhece: quem acrescentar um upload de documento amanhã não vai lembrar de
 * vir aqui. Este caso deriva do código — varre quem importa `put` do SDK — e fica vermelho
 * nomeando o arquivo novo que grava documento sem passar pelo módulo.
 */
describe('nenhum ponto novo grava documento fora do store privado', () => {
  it('quem importa `put` do SDK não grava em `documentos`', () => {
    const suspeitos = varrer(['lib', 'app'])
      .filter((f) => !f.includes('store-privado'))
      .filter((f) => /import\s*\{[^}]*\bput\b[^}]*\}\s*from\s*'@vercel\/blob'/.test(ler(f)))
      .filter((f) => {
        const codigo = semComentarios(ler(f));
        return /insert\(documentos\)|update\(documentos\)/.test(codigo);
      });

    expect(suspeitos).toEqual([]);
  });
});

describe('a entrega confere escopo de objeto — OWASP API1', () => {
  const escopo = ler(ESCOPO);

  it('a rota não entrega nada antes de o escopo autorizar', () => {
    const rota = ler(ROTA);
    const checagem = rota.indexOf('garantirLeitorDoDocumento(');
    const entrega = rota.indexOf('new NextResponse(resposta.body');
    expect(checagem).toBeGreaterThan(-1);
    expect(entrega).toBeGreaterThan(-1);
    expect(checagem).toBeLessThan(entrega);
  });

  it('o próprio paciente pode ler', () => {
    expect(escopo).toMatch(/paciente\.userId === user\.id/);
  });

  /**
   * 🔴 A CONJUNÇÃO É O QUE IMPEDE O BOLA.
   *
   * "É médico" não basta: tem de ser o médico DESTE paciente. Sem `paciente.medicoId ===
   * medico.id`, qualquer médico autenticado lê o documento de qualquer paciente da
   * plataforma — que é exatamente o que o guarda `autorizacao-tem-escopo-de-objeto` já
   * protege nas actions de teleconsulta.
   */
  it('o médico só lê documento de paciente DELE', () => {
    expect(escopo).toMatch(/paciente\.medicoId === medico\.id/);
  });

  /**
   * ⚠️ E TUDO O QUE NÃO PODE RESPONDE 404, NUNCA 403.
   *
   * Distinguir "não existe" de "existe e não é seu" transforma a rota em oráculo: com um laço
   * sobre ids, alguém enumera os documentos da plataforma.
   */
  it('negar e não existir respondem igual — a rota não é oráculo', () => {
    const negativas = escopo.match(/status: 40\d/g) ?? [];
    // só 401 (não autenticado) e 404 (qualquer outra recusa)
    expect(negativas.every((s) => s.endsWith('401') || s.endsWith('404'))).toBe(true);
    expect(escopo).not.toMatch(/status: 403/);
  });

  it('a leitura é auditada — é a terceira pergunta da regra de LGPD', () => {
    const rota = ler(ROTA);
    expect(rota).toContain('registrarAuditoria');
    expect(rota).toMatch(/acao: 'visualizar'/);
  });

  it('e a auditoria não pode impedir o paciente de ver o próprio documento', () => {
    expect(ler(ROTA)).toMatch(/registrarAuditoria\([\s\S]{0,200}\}\)\.catch\(\(\) => \{\}\)/);
  });

  it('dado de saúde não entra em cache compartilhado', () => {
    const rota = ler(ROTA);
    expect(rota).toContain("'cache-control': 'private, no-store'");
    expect(rota).toContain("export const dynamic = 'force-dynamic'");
  });
});

describe('controle — o guarda não pode acusar inocente', () => {
  it('os arquivos existem e têm conteúdo (vacuidade)', () => {
    for (const arquivo of [ESCOPO, ROTA, ANEXO, PARCEIRO]) {
      expect(ler(arquivo).length).toBeGreaterThan(200);
    }
  });

  /**
   * ⚠️ A ROTA AINDA ATENDE BLOB ANTIGO, e isso é deliberado.
   *
   * Os 14 pontos de upload que ainda gravam público são o Item 6 — trabalho próprio. Exigir
   * que a rota recuse o antigo quebraria a tela para todo documento já existente.
   */
  it('a rota ainda serve o blob antigo, sem quebrar o que existe', () => {
    expect(ler(ROTA)).toContain('NextResponse.redirect(url)');
  });
});

/**
 * 🔴 ESTES CASOS EXECUTAM O MÓDULO — os de cima só leem o arquivo.
 *
 * A distinção não é acadêmica: em 13/09/2026 este repositório tinha 1212 guardas verdes
 * enquanto os SEIS caminhos de documento falhavam em produção. Todos liam o código, e o
 * código estava escrito certo. O que não funcionava era o resultado.
 */
describe('o store privado, em execução', () => {
  const original = process.env.BLOB_TOKEN_PRIVADO;
  afterEach(() => {
    process.env.BLOB_TOKEN_PRIVADO = original;
  });

  it('sem token configurado, LANÇA em vez de gravar', async () => {
    delete process.env.BLOB_TOKEN_PRIVADO;
    await expect(guardarDocumentoPrivado('x/y.pdf', Buffer.from([1, 2, 3]))).rejects.toThrow(
      StorePrivadoNaoConfigurado,
    );
  });

  it('token só com espaços conta como ausente', () => {
    process.env.BLOB_TOKEN_PRIVADO = '   ';
    expect(tokenDoStorePrivado()).toBeNull();
  });

  /**
   * ⚠️ O HOST DECIDE, e as três últimas entradas são ataque.
   *
   * `url.includes('private')` acerta as duas primeiras e erra todas as outras — e errar aqui
   * significa tratar blob público como privado (e devolver 502 a quem tinha direito de ler) ou,
   * na direção que importa, buscar sem autenticação um arquivo que exigia token.
   */
  it.each([
    ['https://abc.private.blob.vercel-storage.com/doc.pdf', true],
    ['https://abc.public.blob.vercel-storage.com/doc.pdf', false],
    ['https://abc.public.blob.vercel-storage.com/private/rg.pdf', false],
    ['https://private.blob.vercel-storage.com.evil.com/x', false],
    ['https://evil.com/?u=abc.private.blob.vercel-storage.com', false],
    ['nao-e-url', false],
  ])('%s → privado? %s', (url, esperado) => {
    expect(ehDoStorePrivado(url)).toBe(esperado);
  });
});
