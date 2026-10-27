/**
 * Guarda: BAIXAR um documento do paciente passa pela rota que autentica, e um erro nunca vira
 * arquivo.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Em 27/10/2026 o admin baixou "TERMO_DE_RESPONSABILIDADE_E_USO_ADEQUADO.docx.pdf" e o Chrome
 * respondeu "Falha ao carregar documento PDF". O arquivo salvo tinha **10 bytes** e continha a
 * palavra `Forbidden`: o botão "Baixar" fazia `fetch(doc.urlBlob)` — a URL crua, que no store
 * PRIVADO exige `Authorization: Bearer` — e gravava o 403 com o nome do PDF.
 *
 * Dois defeitos, e os dois têm de morrer:
 *
 * 1. **a porta errada.** `urlBlob` não abre blob privado, e é privado todo documento novo
 *    (desde 13/09/2026). O VER já usava `/api/documentos/{id}/arquivo`; o BAIXAR ficou para
 *    trás, e o guarda `ver-o-documento-passa-pela-porta-autenticada` até o declarava legítimo;
 * 2. **`response.blob()` sem `response.ok`.** Resposta 4xx/5xx não lança: o corpo do erro vira
 *    arquivo. O `catch` com `window.open` só pegava erro de REDE, que não era o caso.
 *
 * ⚠️ O segundo é o pior: mesmo com a porta certa, uma sessão expirada ou o limite de 30
 * leituras/min (429) voltariam a produzir um "PDF" de poucos bytes.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');
const AJUDANTE = 'components/shared/documentos/baixar-documento.ts';

/** Tira comentário na ordem que o guarda do VER fixou: bloco, linha, `{ }` vazio. */
function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\{\s*\}/g, '');
}

const ler = (caminho: string) => semComentarios(readFileSync(join(RAIZ, caminho), 'utf8'));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. O COMPORTAMENTO — executado, não lido
// ═══════════════════════════════════════════════════════════════════════════════

type Ajudante = typeof import('../../components/shared/documentos/baixar-documento');

async function carregarAjudante(): Promise<Ajudante> {
  /**
   * Import dinâmico de propósito: se o arquivo não existe, só os casos que EXECUTAM ficam
   * vermelhos — e os estruturais das telas seguem acusando o defeito pelo motivo certo.
   */
  return import('../../components/shared/documentos/baixar-documento');
}

const resposta = (status: number, corpo = 'Forbidden') =>
  new Response(corpo, { status }) as Response;

describe('buscar os bytes: só resposta 2xx vira arquivo', () => {
  it('🔴 chama a rota autenticada com o id do documento', async () => {
    const { buscarArquivoDoDocumento } = await carregarAjudante();
    const chamadas: string[] = [];
    const buscar = (async (url: string) => {
      chamadas.push(String(url));
      return resposta(200, '%PDF-1.7');
    }) as unknown as typeof fetch;

    await buscarArquivoDoDocumento('abc123', buscar);

    expect(chamadas).toEqual(['/api/documentos/abc123/arquivo']);
  });

  it('o corpo da resposta 200 é devolvido como está', async () => {
    const { buscarArquivoDoDocumento } = await carregarAjudante();
    const buscar = (async () => resposta(200, '%PDF-1.7')) as unknown as typeof fetch;

    const blob = await buscarArquivoDoDocumento('abc123', buscar);

    expect(await blob.text()).toBe('%PDF-1.7');
  });

  it.each([
    [401, /sess[ãa]o/i],
    [403, /permiss[ãa]o|acesso/i],
    [404, /n[ãa]o encontrado|permiss[ãa]o|acesso/i],
    [429, /aguarde|muitos|instantes/i],
    [502, /n[ãa]o foi poss[íi]vel/i],
    [500, /n[ãa]o foi poss[íi]vel/i],
  ])(
    '🔴 status %i LANÇA, com mensagem que o usuário entende — e não devolve arquivo',
    async (status, mensagem) => {
      const { buscarArquivoDoDocumento } = await carregarAjudante();
      const buscar = (async () => resposta(status)) as unknown as typeof fetch;

      // Era aqui que o defeito morava: o 403 virava um Blob de 9 bytes com o nome do PDF.
      await expect(buscarArquivoDoDocumento('abc123', buscar)).rejects.toThrow(mensagem);
    },
  );

  it('🔴 a mensagem NÃO carrega o corpo da resposta nem o id', async () => {
    const { buscarArquivoDoDocumento } = await carregarAjudante();
    const buscar = (async () => resposta(502, 'blob xyz inexistente')) as unknown as typeof fetch;

    const erro = await buscarArquivoDoDocumento('segredo-do-id', buscar).catch((e: Error) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).not.toMatch(/blob xyz|segredo-do-id/);
  });

  it('falha de rede (fetch lança) também vira erro com mensagem, não TypeError cru', async () => {
    const { buscarArquivoDoDocumento } = await carregarAjudante();
    const buscar = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    await expect(buscarArquivoDoDocumento('abc123', buscar)).rejects.toThrow(
      /n[ãa]o foi poss[íi]vel/i,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. O AJUDANTE — a fonte não pode voltar a conhecer o blob
// ═══════════════════════════════════════════════════════════════════════════════

describe('o ajudante de download', () => {
  const fonte = () => ler(AJUDANTE);

  it('🔴 confere `ok` ANTES de ler o corpo', () => {
    const codigo = fonte().replace(/\s+/g, ' ');
    const iOk = codigo.search(/\.ok\b/);
    const iBlob = codigo.search(/\.blob\(\)/);
    expect(iOk, 'o ajudante deixou de conferir response.ok').toBeGreaterThan(-1);
    expect(
      iBlob,
      'o ajudante deixou de ler o corpo — o guarda ficou sem o que medir',
    ).toBeGreaterThan(-1);
    expect(iOk, 'o corpo é lido antes de conferir `ok`: erro vira arquivo').toBeLessThan(iBlob);
  });

  it('🔴 não conhece urlBlob nem URL de blob', () => {
    const codigo = fonte();
    expect(/urlBlob/i.test(codigo), 'o ajudante passou a conhecer a URL do blob').toBe(false);
    expect(/blob\.vercel-storage\.com/i.test(codigo)).toBe(false);
  });

  it('🔴 não tem o fallback que abria a URL crua em nova aba', () => {
    expect(
      /window\.open\(/.test(fonte()),
      'window.open(url) é o caminho que escondia o erro e fura a autenticação',
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AS TELAS — o Baixar delas usa o ajudante
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Nomeadas, e a lista é o contrato (mesma decisão do guarda do VER): são as duas telas que
 * baixam documento do paciente por `id`. `tab-exames.tsx` tem o mesmo padrão de fetch cru, mas
 * baixa EXAME (`urlArquivo`), que não tem rota por id — está catalogado, não corrigido aqui.
 */
const TELAS = [
  'app/(medico)/medico/pacientes/[id]/_components/tab-documentos.tsx',
  'app/(paciente)/paciente/documentos/page.tsx',
];

describe.each(TELAS)('%s', (tela) => {
  const codigo = () => ler(tela);

  it('🔴 baixa pelo ajudante, com um ID — nunca a URL do blob', () => {
    const c = codigo().replace(/\s+/g, ' ');
    expect(c, 'a tela deixou de importar o ajudante de download').toContain(
      '@/components/shared/documentos/baixar-documento',
    );
    expect(c, 'o ajudante foi importado e nunca chamado — o Baixar não faz nada').toMatch(
      /baixarDocumento\(\s*\w/,
    );
    // O nome da função local e da variável são detalhe; o que NÃO pode passar é a URL.
    expect(/baixarDocumento\([^)]*urlBlob/.test(c), 'o ajudante recebeu a URL do blob').toBe(false);
    expect(
      /onClick=\{[^}]*\(\s*doc\.id\b[^}]*\}/.test(c),
      'nenhum botão passa `doc.id` ao download — o Baixar ficou sem o que medir',
    ).toBe(true);
  });

  it('🔴 NÃO busca a URL crua do blob', () => {
    const c = codigo();
    expect(
      /fetch\(\s*(?:url|doc\.urlBlob)\b/.test(c),
      'a tela voltou a fazer fetch da URL do blob — no store privado isso responde 403',
    ).toBe(false);
    expect(
      /handleDownload\(\s*doc\.urlBlob/.test(c),
      'o botão Baixar voltou a passar urlBlob',
    ).toBe(false);
  });

  it('🔴 NÃO tem o fallback window.open(url) que escondia o erro', () => {
    expect(/window\.open\(\s*url\b/.test(codigo())).toBe(false);
  });

  it('🔴 a falha do download é DITA ao usuário', () => {
    const c = codigo().replace(/\s+/g, ' ');
    // Sem isto o botão continuaria "não fazendo nada" quando a rota recusa.
    expect(c).toMatch(/baixarDocumento\([^)]*\)[\s\S]{0,200}catch[\s\S]{0,200}toast\.error/);
  });
});
