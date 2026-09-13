/**
 * TODA PORTA DE ENTRADA DECLARA DE ONDE VEIO — nenhuma depende do default.
 *
 * 🔴 ADR-0022 §27 e D-15. O dono mapeou **quatro caminhos** que chegam na mesma tela
 * `/cadastro/[token]`, e a varredura mostrou que uma delas não se identifica:
 *
 *   1. link automático do ChatPro (requisição externa)  → `chatpro_bot`
 *   2. redirect do formulário da Greens                 → `greens_handoff`
 *   3. link do admin em solicitação de medicação        → 🔴 só pelo `default()` da coluna
 *   4. link do ChatPro da BeHemp (sem procuração)       → `chatpro_start`
 *
 * ⚠️ A PORTA 3 AINDA NÃO EXISTE COMO TELA — medido em 13/09/2026: nenhuma tela de admin gera
 * link de cadastro. O valor `painel_admin` está no enum e no `default()`, esperando. É por isso
 * que este guarda existe **antes** dela: para que ela nasça declarando, em vez de nascer
 * acertando por omissão.
 *
 * 🔴 UMA PORTA QUE SÓ ACERTA PELO DEFAULT É UMA PORTA QUE VAI ERRAR. Se alguém mudar o default
 * amanhã — e defaults mudam, é para isso que servem —, todo link daquela porta passa a mentir
 * sobre de onde veio. E a procedência é o insumo da sentinela (D-05): errar nela erra tudo o
 * que vem depois.
 *
 * **Decisão do dono, 13/09/2026**, quando perguntei se a porta do admin devia gravar origem
 * explicitamente: _"sim, deve gravar"_.
 *
 * ⚠️ O QUE JÁ PROTEGE, e vale registrar: `origem` é **obrigatória no tipo** de entrada
 * (`lib/chatpro/solicitacao.ts`), então o TypeScript já força quem construir a porta 3 a
 * declará-la. Este guarda cobre o que o tipo não cobre: que os valores usados sejam os do enum,
 * que o enum não perca um valor em uso, e que nenhum `insert` contorne o caminho tipado.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Os valores que o enum declara — lidos do schema, nunca listados à mão. */
function origensDoEnum(): string[] {
  const fonte = ler('db/schema/enums.ts');
  const i = fonte.indexOf('solicitacaoCadastroOrigemEnum');
  expect(i, 'não achei o enum de origem').toBeGreaterThan(-1);
  const bloco = fonte.slice(i, fonte.indexOf(']', i));
  // O primeiro literal é o nome da coluna no Postgres; os demais são os valores.
  return [...bloco.matchAll(/'([^']+)'/g)].map((m) => m[1]).slice(1);
}

function arquivosTs(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(join(RAIZ, dir))) {
    if (nome === 'node_modules' || nome === '.next') continue;
    const rel = `${dir}/${nome}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) arquivosTs(rel, achados);
    else if (/\.tsx?$/.test(nome) && !rel.includes('__tests__')) achados.push(rel);
  }
  return achados;
}

const FONTES = [...arquivosTs('lib'), ...arquivosTs('app')];

/**
 * Os valores de origem de SOLICITAÇÃO que o código grava.
 *
 * ⚠️ DEFEITO MEU, achado ao rodar: a primeira versão varria todo `origem: '…'` do repositório
 * — e `consentimentos.origem` também usa esse nome de campo, com valores próprios
 * (`'teleconsulta'`). O guarda acusou `'teleconsulta' não existe no enum de origem`, e estava
 * errado: é outra tabela, outro vocabulário.
 *
 * Agora só conta o que está nos arquivos que **inserem solicitação**. Campo com o mesmo nome
 * em tabelas diferentes é exatamente o tipo de coisa que um varredor ingênuo confunde.
 */
const INSEREM_SOLICITACAO = ['lib/chatpro/solicitacao.ts', 'lib/parceiros/handoff.ts'];

function origensUsadas(): Set<string> {
  const usadas = new Set<string>();
  for (const f of INSEREM_SOLICITACAO) {
    for (const m of semComentarios(ler(f)).matchAll(/origem:\s*'([a-z_]+)'/g)) usadas.add(m[1]);
  }
  return usadas;
}

describe('toda porta declara de onde veio', () => {
  it('⚠️ VACUIDADE: o enum tem valores e o código usa alguns', () => {
    expect(origensDoEnum().length).toBeGreaterThan(3);
    expect(origensUsadas().size).toBeGreaterThan(2);
  });

  it('🔴 todo valor que o código grava EXISTE no enum', () => {
    // Gravar um valor fora do enum quebra o insert em runtime — e só em runtime.
    const declarados = new Set(origensDoEnum());
    for (const usada of origensUsadas()) {
      expect(declarados.has(usada), `'${usada}' não existe no enum de origem`).toBe(true);
    }
  });

  it('🔴 as TRÊS portas que já existem declaram a própria origem', () => {
    const usadas = origensUsadas();
    // 1 e 4 — ChatPro; 2 — Greens. A 3 (admin) ainda não existe como tela (ADR-0022 §27).
    expect(usadas.has('chatpro_bot'), 'porta 1 não declara').toBe(true);
    expect(usadas.has('chatpro_start'), 'porta 4 não declara').toBe(true);
    expect(usadas.has('greens_handoff'), 'porta 2 não declara').toBe(true);
  });

  it('🔴 `origem` é OBRIGATÓRIA no tipo — o TypeScript força a porta nova a declarar', () => {
    /**
     * É o que impede a porta 3 de nascer dependendo do `default()`. Se alguém tornar o campo
     * opcional, o compilador para de cobrar e a próxima porta nasce muda.
     */
    const nucleo = semComentarios(ler('lib/chatpro/solicitacao.ts'));
    expect(nucleo).toMatch(/\borigem:\s*Origem;/);
    expect(nucleo, 'origem virou opcional').not.toMatch(/\borigem\?:\s*Origem/);
  });

  it('⚠️ e o tipo `Origem` deriva do ENUM, não de uma lista paralela', () => {
    // Lista paralela é o que desatualiza e aprova o errado — a lição do
    // `contrato-da-ia-e-a-unica-fonte`.
    /**
     * 🔴 A LISTA PARALELA EXISTIA, e já estava desatualizada — achado por este caso em
     * 13/09/2026. O tipo `Origem` era escrito à mão com cinco valores, e **faltava
     * `greens_handoff`**, que o handoff grava desde que existe. Ninguém notou porque o handoff
     * insere por outro caminho: a divergência não quebrava nada, só mentia sobre o possível.
     */
    const nucleo = ler('lib/chatpro/solicitacao.ts');
    expect(nucleo).toMatch(/typeof solicitacaoCadastroOrigemEnum\.enumValues/);
    // E não sobrou lista à mão.
    expect(semComentarios(nucleo)).not.toMatch(/type Origem =\s*\n?\s*\|/);
  });

  it('🔴 nenhum INSERT em solicitações contorna o caminho tipado', () => {
    /**
     * O núcleo (`lib/chatpro/solicitacao.ts`) e o handoff são os dois pontos legítimos. Um
     * insert novo em outro lugar escaparia da obrigatoriedade do tipo — e nasceria mudo.
     */
    const permitidos = ['lib/chatpro/solicitacao.ts', 'lib/parceiros/handoff.ts'];
    const infratores = FONTES.filter(
      (f) =>
        !permitidos.includes(f) && semComentarios(ler(f)).includes('insert(solicitacoesCadastro)'),
    );
    expect(infratores, `insert fora do caminho tipado: ${infratores.join(', ')}`).toEqual([]);
  });

  it('⚠️ o default da coluna continua existindo — como REDE, não como caminho', () => {
    // Tirar o default quebraria qualquer insert antigo; mantê-lo é certo. O que não pode é
    // alguém DEPENDER dele, e é isso que os casos acima impedem.
    expect(ler('db/schema/solicitacoes-cadastro.ts')).toMatch(/default\('painel_admin'\)/);
  });
});
