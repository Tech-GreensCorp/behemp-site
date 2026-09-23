/**
 * GUARDA — redirect montado no servidor usa o domínio público, nunca o host da requisição.
 *
 * A CLASSE DE ERRO: em produção o Next roda standalone atrás do Nginx, com `HOSTNAME=0.0.0.0`
 * e `PORT=3000`. O `request.url` que a rota recebe carrega esse endereço INTERNO. Toda
 * `new URL(caminho, request.url)` vira `https://0.0.0.0:3000/caminho` para o navegador.
 *
 * O que isso custou em 23/09/2026: o primeiro médico a conectar o Mercado Pago em produção
 * voltou para `https://0.0.0.0:3000/medico/pagamentos/config?mp=erro&motivo=state` — página
 * que não abre. Os dois callbacks do Google tinham o mesmo padrão desde sempre.
 *
 * DERIVADO DO CÓDIGO: varre `app/`, `lib/` e `middleware.ts` atrás de qualquer `new URL(…)`
 * cuja base seja a URL da requisição. Rota nova com o padrão fica vermelha aqui, nomeada.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { urlAbsoluta } from '@/lib/url';

const raiz = process.cwd();

function arquivosDeFonte(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome.startsWith('.')) continue;
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDeFonte(caminho, achados);
    else if (/\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

/** Sem os comentários: `lib/url.ts` EXPLICA o padrão proibido, e menção não é uso. */
function semComentarios(texto: string): string {
  return texto
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
}

/** `new URL(<qualquer coisa>, request.url | req.url | request.nextUrl | req.nextUrl)` */
const URL_SOBRE_A_REQUISICAO = /new URL\([^;]*?,\s*(?:request|req)\.(?:url|nextUrl)\s*,?\s*\)/g;

function ocorrencias(texto: string): string[] {
  return [...semComentarios(texto).matchAll(URL_SOBRE_A_REQUISICAO)].map((m) => m[0]);
}

describe('🔴 nenhum redirect é montado sobre o host da requisição', () => {
  const arquivos = [
    ...arquivosDeFonte(path.join(raiz, 'app')),
    ...arquivosDeFonte(path.join(raiz, 'lib')),
    path.join(raiz, 'middleware.ts'),
  ];

  it('a varredura enxerga as rotas (vacuidade)', () => {
    const relativos = arquivos.map((a) => path.relative(raiz, a));
    expect(relativos).toContain('app/api/medico/mercadopago/callback/route.ts');
    expect(relativos).toContain('app/api/auth/google/callback/route.ts');
  });

  it('o detector reconhece o padrão proibido nas formas em que ele aparece (vacuidade)', () => {
    expect(ocorrencias("new URL('/medico?x=1', request.url)")).toHaveLength(1);
    expect(ocorrencias('new URL(`/a?${qs}`, request.url)')).toHaveLength(1);
    // Quebrado pelo Prettier em várias linhas, com vírgula final.
    expect(ocorrencias("new URL(\n  '/medico',\n  req.url,\n)")).toHaveLength(1);
    expect(ocorrencias("new URL('/a', request.nextUrl)")).toHaveLength(1);
    expect(ocorrencias("urlAbsoluta('/medico')")).toHaveLength(0);
    expect(ocorrencias("// new URL('/a', request.url)")).toHaveLength(0);
  });

  it('nenhum arquivo monta URL sobre request.url — usar urlAbsoluta() de lib/url.ts', () => {
    const achados = arquivos.flatMap((arquivo) =>
      ocorrencias(readFileSync(arquivo, 'utf8')).map(
        (trecho) => `${path.relative(raiz, arquivo)}: ${trecho.replace(/\s+/g, ' ')}`,
      ),
    );
    expect(achados).toEqual([]);
  });
});

describe('urlAbsoluta', () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it('monta sobre NEXT_PUBLIC_APP_URL, com ou sem barra no fim', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://be4hope.org/';
    expect(urlAbsoluta('/medico/pagamentos/config?mp=erro&motivo=state').toString()).toBe(
      'https://be4hope.org/medico/pagamentos/config?mp=erro&motivo=state',
    );
    process.env.NEXT_PUBLIC_APP_URL = 'https://be4hope.org';
    expect(urlAbsoluta('/medico').toString()).toBe('https://be4hope.org/medico');
  });

  it('sem a variável cai no localhost de desenvolvimento', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(urlAbsoluta('/medico').origin).toBe('http://localhost:3000');
  });

  it('recusa o que não é caminho do próprio site — nada de redirect aberto', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://be4hope.org';
    expect(() => urlAbsoluta('//outro.site/x')).toThrow();
    expect(() => urlAbsoluta('https://outro.site/x')).toThrow();
    expect(() => urlAbsoluta('medico')).toThrow();
  });

  it('lê process.env.NEXT_PUBLIC_APP_URL literal, que o build congela — não o env de runtime', () => {
    const fonte = semComentarios(readFileSync(path.join(raiz, 'lib/url.ts'), 'utf8'));
    expect(fonte).toContain('process.env.NEXT_PUBLIC_APP_URL');
    expect(fonte).not.toMatch(/from ['"]@\/lib\/env['"]/);
  });
});
