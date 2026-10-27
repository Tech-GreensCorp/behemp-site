/**
 * Guarda: o "Ver" do checklist da ANVISA, no painel do admin, passa por rota que autentica e
 * audita — e a lista não entrega a URL crua do blob.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Em 27/10/2026, depois de corrigir o "Baixar" do paciente (que salvava um `Forbidden` de 10
 * bytes), o mesmo defeito foi achado no painel `/admin/anvisa`: o "Ver" era
 * `<a href={doc.urlBlob}>`, e a lista `/api/admin/anvisa/listar` devolvia o `urlBlob` cru.
 *
 * 🔴 Os itens do checklist são COPIADOS de `documentos.urlBlob` ao criar a autorização
 * (`(paciente)/_actions/anvisa.ts`). Desde 13/09/2026 esse blob é PRIVADO e o link direto
 * responde 403. Os itens enviados pelo próprio checklist ficam em store PÚBLICO e abrem — sem
 * autenticação, sem escopo e sem auditoria. As duas metades estão erradas.
 *
 * O checklist é um JSON sem o `id` da linha de `documentos` (ADR/ comentário de
 * `documentos-do-paciente.ts`), e itens enviados pelo checklist nem têm linha lá. Por isso a
 * rota resolve o arquivo POR `(autorizacaoId, tipo)` no servidor, lendo o próprio JSON — e o
 * navegador nunca recebe a URL.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');
const ROTA = 'app/api/admin/anvisa/documento/[autorizacaoId]/[tipo]/route.ts';
const LISTAR = 'app/api/admin/anvisa/listar/route.ts';
const PAGINA = 'app/(admin)/admin/anvisa/page.tsx';

function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\{\s*\}/g, '');
}
const ler = (caminho: string) => semComentarios(readFileSync(join(RAIZ, caminho), 'utf8'));
const compactar = (s: string) => s.replace(/\s+/g, ' ');

describe('o checklist vai para a tela sem a URL do blob', () => {
  it('🔴 `checklistParaTela` tira urlBlob e diz só se há arquivo', async () => {
    const { checklistParaTela } = await import('../../lib/anvisa/checklist-para-tela');
    const saida = checklistParaTela([
      {
        tipo: 'rg',
        enviado: true,
        validado: false,
        urlBlob: 'https://x.private.blob.vercel-storage.com/rg.pdf',
        nomeArquivo: 'rg.pdf',
      },
      { tipo: 'receita_medica', enviado: false, validado: false, urlBlob: null, nomeArquivo: null },
    ]);

    expect(saida).toEqual([
      { tipo: 'rg', enviado: true, validado: false, nomeArquivo: 'rg.pdf', temArquivo: true },
      {
        tipo: 'receita_medica',
        enviado: false,
        validado: false,
        nomeArquivo: null,
        temArquivo: false,
      },
    ]);
    expect(JSON.stringify(saida)).not.toMatch(/blob\.vercel-storage|urlBlob/);
  });

  it('entrada que não é lista vira lista vazia (JSON antigo ou nulo não derruba a tela)', async () => {
    const { checklistParaTela } = await import('../../lib/anvisa/checklist-para-tela');
    expect(checklistParaTela(null)).toEqual([]);
    expect(checklistParaTela(undefined)).toEqual([]);
    expect(checklistParaTela({} as never)).toEqual([]);
  });

  it('🔴 a lista usa o ajudante e não devolve o PDF da procuração', () => {
    const c = compactar(ler(LISTAR));
    expect(c, 'a lista deixou de passar o checklist pelo ajudante').toMatch(/checklistParaTela\(/);
    expect(c, 'a lista deixou de dizer SE a procuração tem PDF').toMatch(/temPdfAssinado/);
    expect(
      /procuracao:\s*proc\s*\?\?\s*null/.test(c),
      'a lista voltou a devolver a linha crua da procuração (com urlPdfAssinado/urlPdfGerado)',
    ).toBe(false);
  });
});

describe('a rota autenticada do admin', () => {
  const existe = () => existsSync(join(RAIZ, ROTA));

  it('existe', () => {
    expect(existe(), `falta ${ROTA}`).toBe(true);
  });

  it('🔴 exige admin, limita antes de autenticar e audita a leitura', () => {
    const c = compactar(ler(ROTA));
    expect(c, 'a rota não exige admin').toMatch(/verificarAdmin\(/);
    expect(c, 'a rota não limita as requisições').toMatch(/consumir\(/);
    expect(c.indexOf('consumir('), 'o limite tem de vir ANTES de autenticar').toBeLessThan(
      c.indexOf('verificarAdmin('),
    );
    expect(c, 'a leitura não é auditada').toMatch(/acao:\s*'visualizar'/);
  });

  it('🔴 entrega os bytes pelo ajudante — nunca devolve a URL', () => {
    const c = compactar(ler(ROTA));
    expect(c).toMatch(/entregarBlob\(/);
    expect(
      /NextResponse\.json\([^)]*(urlBlob|urlPdf)/.test(c),
      'a rota devolve a URL do blob no corpo',
    ).toBe(false);
    expect(/NextResponse\.redirect\(/.test(c), 'redirect expõe a URL ao navegador').toBe(false);
  });

  it('🔴 "não existe" e "não pode" respondem igual (404) — sem oráculo', () => {
    const c = ler(ROTA);
    expect(/status:\s*403/.test(c), 'a rota distingue 403 de 404 e vira oráculo').toBe(false);
    expect(c).toMatch(/status:\s*404/);
  });

  it('a autorização apagada não abre', () => {
    expect(ler(ROTA)).toMatch(/isNull\(autorizacoesAnvisa\.deletedAt\)/);
  });
});

describe('a tela do admin', () => {
  const codigo = () => ler(PAGINA);

  it('🔴 não conhece a URL do blob nem a do PDF da procuração', () => {
    const c = codigo();
    for (const campo of ['urlBlob', 'urlPdfAssinado', 'urlPdfGerado']) {
      expect(c.includes(campo), `a tela voltou a usar ${campo}`).toBe(false);
    }
  });

  it('🔴 abre pelo endereço da rota autenticada', () => {
    expect(compactar(codigo())).toMatch(/\/api\/admin\/anvisa\/documento\//);
  });
});

describe('o ajudante existe', () => {
  it('arquivo presente', () => {
    expect(existsSync(join(RAIZ, 'lib/anvisa/checklist-para-tela.ts'))).toBe(true);
  });
});
