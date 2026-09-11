/**
 * GUARDA — o S2 tem caminho, segredo e gatilho próprios.
 *
 * AS TRÊS CLASSES DE ERRO, apontadas pela GREENS no §7 do contrato-ponte em 11/09/2026, e
 * confirmadas por mim com `grep` antes de corrigir:
 *
 * 1. 🔴 **`prepararTransferencia` não era chamada por ninguém.** Existia, era testável, tinha
 *    guarda — e nada a invocava. É a **mesma classe** do componente órfão que apareceu hoje no
 *    `AvisoDaProcuracao`: a peça parece entregue, aparece como pronta no checklist, e não
 *    acontece para paciente nenhum. Desta vez o outro lado viu antes de nós.
 *
 * 2. 🔴 **O enviador tinha UM caminho e UM segredo.** O S2 vai para outra rota, com outra
 *    chave. Poderes diferentes não dividem chave: quem tem o segredo do aviso consegue mentir
 *    que uma receita ficou pronta; quem tem o do cadastro consegue **criar solicitações lá e
 *    fazer a Greens buscar URLs que escolher**.
 *
 * 3. 🔴 **O enum não tinha valor para o cadastro** — só `receita_emitida` e `anvisa_aprovada`.
 *
 * ⚠️ E o §2 deles pediu o `idioma` no consentimento, com o argumento certo: _"a mesma frase em
 * `pt` e em `en` são consentimentos diferentes de provar"_.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CAMINHO_DO_AVISO_PADRAO,
  CAMINHO_DO_CADASTRO_PADRAO,
  destinoDoEvento,
  podeEnviar,
} from '@/lib/parceiros/destinos-do-envio';
import { IDIOMA_DO_CONSENTIMENTO } from '@/lib/parceiros/consentimento';

function ler(c: string): string {
  return readFileSync(path.join(process.cwd(), c), 'utf8');
}
function semComentarios(f: string): string {
  return f
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
}

const enviador = semComentarios(ler('lib/parceiros/enviador.ts'));
const gatilho = semComentarios(ler('lib/parceiros/enfileirar-transferencia.ts'));
const cadastro = semComentarios(ler('app/_actions/cadastro-por-link.ts'));
const painel = semComentarios(ler('app/(paciente)/_actions/consentimento.ts'));
const enums = semComentarios(ler('db/schema/enums.ts'));

const ANTES = { ...process.env };
afterEach(() => {
  process.env = { ...ANTES };
});

// ─────────────────────────────────────────────────────────────────────────────
describe('cada direção tem o seu destino e o seu segredo', () => {
  it('o cadastro vai para rota diferente da do aviso', () => {
    expect(CAMINHO_DO_CADASTRO_PADRAO).not.toBe(CAMINHO_DO_AVISO_PADRAO);
    expect(destinoDoEvento('cadastro_transferido').caminho).toBe(CAMINHO_DO_CADASTRO_PADRAO);
    expect(destinoDoEvento('receita_emitida').caminho).toBe(CAMINHO_DO_AVISO_PADRAO);
  });

  it('🔴 e com segredo diferente — poderes diferentes não dividem chave', () => {
    process.env.PARCEIRO_GREENS_SEGREDO_SAIDA = 'segredo-do-aviso';
    process.env.PARCEIRO_GREENS_SEGREDO_CADASTRO = 'segredo-do-cadastro';
    expect(destinoDoEvento('cadastro_transferido').segredo).toBe('segredo-do-cadastro');
    expect(destinoDoEvento('anvisa_aprovada').segredo).toBe('segredo-do-aviso');
  });

  it('🔴 o cadastro NÃO cai para o segredo do aviso quando o próprio falta', () => {
    process.env.PARCEIRO_GREENS_SEGREDO_SAIDA = 'segredo-do-aviso';
    delete process.env.PARCEIRO_GREENS_SEGREDO_CADASTRO;
    expect(destinoDoEvento('cadastro_transferido').segredo).toBeUndefined();
    expect(podeEnviar('cadastro_transferido')).toBe(false);
    // O aviso segue funcionando: um par faltando não derruba o outro.
    expect(podeEnviar('receita_emitida')).toBe(true);
  });

  it('os dois caminhos são configuráveis por ambiente', () => {
    process.env.PARCEIRO_GREENS_CAMINHO_CADASTRO = '/outro/cadastro';
    process.env.PARCEIRO_GREENS_CAMINHO_RETORNO = '/outro/aviso';
    expect(destinoDoEvento('cadastro_transferido').caminho).toBe('/outro/cadastro');
    expect(destinoDoEvento('receita_emitida').caminho).toBe('/outro/aviso');
  });

  it('o caminho do cadastro é o que a Greens publicou', () => {
    expect(CAMINHO_DO_CADASTRO_PADRAO).toBe('/api/v1/parceiros/behemp/cadastro');
  });

  it('o enviador usa o destino do evento, não um campo fixo', () => {
    expect(enviador).toContain('destinoDoEvento(evento.tipo)');
    expect(enviador).toContain('destino.caminho');
    expect(enviador).toContain('assinar(evento.id, timestamp, corpo, destino.segredo)');
  });

  it('🔴 e o segredo do aviso não assina mais o cadastro', () => {
    expect(enviador).not.toMatch(/assinar\([^)]*this\.segredo/);
  });

  it('sem o segredo do tipo, o evento REAGENDA em vez de falhar', () => {
    const bloco = enviador.slice(
      enviador.indexOf('const destino = destinoDoEvento'),
      enviador.indexOf('const assinatura'),
    );
    expect(bloco).toContain('this.reagendar(');
    expect(bloco).not.toContain('marcarFalha');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o enum reconhece o cadastro', () => {
  it('tem o valor', () => {
    expect(enums).toContain("'cadastro_transferido'");
  });

  it('e os dois antigos continuam — o S1 não pode quebrar', () => {
    expect(enums).toContain("'receita_emitida'");
    expect(enums).toContain("'anvisa_aprovada'");
  });

  it('a migration apenas ACRESCENTA o valor', () => {
    const sql = ler('db/migrations/0039_secret_randall.sql');
    expect(sql).toContain('ADD VALUE');
    expect(sql).not.toMatch(/DROP TYPE|DROP VALUE/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o gatilho existe — a peça deixou de ser órfã', () => {
  it('🔴 alguém chama prepararTransferencia', () => {
    expect(gatilho).toContain('await prepararTransferencia(');
  });

  it('e o gatilho é chamado de onde o consentimento acontece', () => {
    expect(cadastro).toContain('await enfileirarTransferencia(');
    expect(painel).toContain('await enfileirarDoPainel(');
  });

  it('🔴 no cadastro, DEPOIS de gravar o consentimento', () => {
    const iConceder = cadastro.indexOf('await conceder(');
    const iEnfileira = cadastro.indexOf('await enfileirarTransferencia(');
    expect(iConceder).toBeGreaterThan(0);
    expect(iEnfileira).toBeGreaterThan(iConceder);
  });

  it('🔴 no painel, só quando a finalidade que autoriza o envio foi concedida', () => {
    expect(painel).toMatch(/includes\(FINALIDADES\.retornoAoParceiro\)/);
  });

  it('enfileira, nunca envia — quem consente não espera a Greens', () => {
    expect(gatilho).toContain('insert(parceiroEventosSaida)');
    expect(gatilho).not.toMatch(/\bfetch\(/);
  });

  it('nunca lança: o cadastro de quem consentiu não cai por causa do envio', () => {
    expect(gatilho).toMatch(/catch \(erro\)/);
    expect(gatilho).not.toMatch(/^\s*throw /m);
  });

  it('recusa é caso normal, e vai como info — não como alerta', () => {
    const bloco = gatilho.slice(
      gatilho.indexOf('if (!pronta.pronta)'),
      gatilho.indexOf('await db'),
    );
    expect(bloco).toContain('console.info');
    expect(bloco).not.toContain('console.warn');
  });

  it('o mesmo cadastro não vira dois eventos', () => {
    expect(gatilho).toContain('onConflictDoNothing');
    // `DoUpdate` reescreveria um cadastro que já pode ter virado pedido do lado de lá.
    expect(gatilho).not.toContain('onConflictDoUpdate');
  });

  it('🔴 e nenhum nome de arquivo entra em log', () => {
    const logs = gatilho.match(/console\.\w+\([^;]*\)/g) ?? [];
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) expect(l).not.toContain('nomeArquivo');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o idioma do consentimento viaja', () => {
  it('existe a constante', () => {
    expect(IDIOMA_DO_CONSENTIMENTO).toBe('pt');
  });

  it('é gravado no registro', () => {
    const registro = semComentarios(ler('lib/parceiros/consentimento-registrado.ts'));
    expect(registro).toContain('idioma: IDIOMA_DO_CONSENTIMENTO');
    expect(registro).toContain('idioma: consentimentos.idioma');
  });

  it('🔴 e o que viaja sai do REGISTRO, não da constante de hoje', () => {
    const p5 = semComentarios(ler('lib/parceiros/transferencia-de-cadastro.ts'));
    expect(p5).toContain('idioma: autorizadora.idioma');
    expect(p5).not.toContain('idioma: IDIOMA_DO_CONSENTIMENTO');
  });

  it('a coluna tem default — linha antiga não fica sem idioma', () => {
    const schema = ler('db/schema/consentimentos.ts');
    expect(schema).toMatch(/idioma: text\('idioma'\)\.notNull\(\)\.default\('pt'\)/);
  });
});
