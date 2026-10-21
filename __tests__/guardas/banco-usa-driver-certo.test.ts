/**
 * Guarda: a URL decide o driver do banco, e produção nunca cai no caminho local.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Produção é Neon, e o driver `@neondatabase/serverless` fala HTTP. Em 20/08/2026 o projeto
 * passou a aceitar também um driver TCP, para poder rodar contra Postgres local — condição do
 * dono: *"contanto que esteja em localhost, não esteja na main ou não suba para neon"*.
 *
 * 🔴 O RISCO QUE ESTE GUARDA EXISTE PARA IMPEDIR
 * Produção resolver para o driver TCP. Isso não daria erro de compilação nem de tipo: daria
 * erro em runtime, no primeiro acesso ao banco, em produção. É o pior lugar para descobrir.
 *
 * Por isso a decisão é pela **URL**, não por variável de ambiente: uma flag pode ficar ligada
 * por engano num deploy; a URL de produção aponta para o Neon e resolve sozinha.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ehNeon as __ehNeon } from '@/lib/db/driver';

describe('a decisão do driver é pura — senão este guarda não roda', () => {
  // 🔴 REGRESSÃO 1 (20/08/2026). A função morava em `lib/db/index.ts`, que abre conexão no topo
  // do módulo. Importá-la aqui estourava com "No database connection string was provided to
  // `neon()`" — e o Vitest reportava `Test Files 1 failed` ao lado de `Tests 133 passed`: os 8
  // casos abaixo NÃO rodavam, e o número verde escondia isso.
  const fonte = readFileSync('lib/db/driver.ts', 'utf8');

  /**
   * 🔴 SÓ CÓDIGO. Sem isto, o guarda acusaria o próprio comentário que explica a regra — a
   * frase "sem `process.env`" contém `process.env`. É a mesma classe de falsa acusação que os
   * hooks cometeram em 19/08/2026, e que o guarda de relay cometeu neste repositório: casar um
   * texto onde ele *não decide nada*.
   */
  function semComentarios(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  }
  const codigo = semComentarios(fonte);

  it('lib/db/driver.ts não lê variável de ambiente', () => {
    expect(
      /process\.env/.test(codigo),
      'driver.ts passou a ler process.env — volta a exigir ambiente para o guarda rodar',
    ).toBe(false);
  });

  it('lib/db/driver.ts não importa driver nem schema', () => {
    const imports = codigo.match(/^\s*import\s.+$/gm) ?? [];
    expect(imports, `driver.ts deve ser puro, mas importa: ${imports.join(', ')}`).toHaveLength(0);
  });

  // CONTROLE contra falsa acusação: o guarda tem que reagir a CÓDIGO, e ficar quieto diante de
  // comentário. Se algum destes dois inverter, a asserção acima está olhando o lugar errado.
  it('menção a process.env em comentário NÃO é violação', () => {
    expect(
      /process\.env/.test(semComentarios('// usa process.env aqui\nexport const a = 1;')),
    ).toBe(false);
    expect(/process\.env/.test(semComentarios('/* process.env */\nexport const a = 1;'))).toBe(
      false,
    );
  });

  it('uso real de process.env É violação', () => {
    expect(/process\.env/.test(semComentarios('const u = process.env.DATABASE_URL;'))).toBe(true);
  });

  it('lib/db/index.ts não redeclara a decisão por conta própria', () => {
    // Duas cópias divergem em silêncio: o guarda testaria uma e produção usaria a outra.
    const indice = readFileSync('lib/db/index.ts', 'utf8');
    expect(
      /function\s+ehNeon\s*\(/.test(indice),
      'index.ts voltou a declarar ehNeon — a decisão tem que vir de driver.ts',
    ).toBe(false);
    expect(indice, 'index.ts deve importar a decisão de driver.ts').toContain('@/lib/db/driver');
  });
});

describe('a URL do banco decide o driver', () => {
  it.each([
    ['postgresql://u:p@ep-cool-name-123456.us-east-2.aws.neon.tech/db', 'Neon padrão'],
    ['postgres://u:p@ep-x.sa-east-1.aws.neon.tech/db?sslmode=require', 'Neon com sslmode'],
    ['postgresql://u:p@algo.neon.build/db', 'Neon build'],
  ])('%s → driver HTTP (produção): %s', (url) => {
    expect(__ehNeon(url), 'URL de Neon caiu no driver TCP — quebraria em produção').toBe(true);
  });

  it.each([
    ['postgresql://behemp:devlocal@127.0.0.1:5436/behemp_dev', 'Postgres local por IP'],
    ['postgresql://behemp:devlocal@localhost:5436/behemp_dev', 'Postgres local por nome'],
    ['postgresql://u:p@db.interno:5432/x', 'Postgres em rede interna'],
  ])('%s → driver TCP (local): %s', (url) => {
    expect(__ehNeon(url), 'URL local caiu no driver HTTP — não conectaria').toBe(false);
  });

  it('host que só CONTÉM "neon.tech" no meio não é Neon', () => {
    // `neon.tech.exemplo.com` não é Neon. Casar por trecho em vez de por host é como um
    // atacante apontaria o driver de produção para outro lugar.
    expect(__ehNeon('postgresql://u:p@neon.tech.exemplo.com/db')).toBe(false);
  });

  it('"neon.tech" num parâmetro de query não muda o driver', () => {
    // O host é o que importa. Um trecho na query não deveria decidir nada.
    expect(__ehNeon('postgresql://u:p@127.0.0.1:5436/db?options=neon.tech')).toBe(false);
  });

  it('URL malformada assume PRODUÇÃO — falha segura', () => {
    // Não conseguir parsear e então abrir TCP para host desconhecido é pior que assumir Neon.
    expect(__ehNeon('não-é-url')).toBe(true);
    expect(__ehNeon('')).toBe(true);
  });
});
