/**
 * GUARDA — o aviso da procuração é renderizado por alguma tela, e sai do estado real.
 *
 * A CLASSE DE ERRO, medida em 11/09/2026: **o componente existia e nenhuma tela o
 * renderizava.** Ficou assim desde 10/09. Um componente órfão não é código incompleto — é
 * código que *parece* entregue: aparece no checklist como P2 feita, tem teste de unidade se
 * alguém escrever, e não faz nada para nenhum paciente.
 *
 * E o preço apareceu junto. Como ninguém o renderizava, o comentário dele nunca foi
 * exercitado — e afirmava algo falso: que _"desde 10/09 o cadastro grava a declaração 'não
 * tenho ANVISA'"_. **Não grava.** `declarouTerAutorizacaoAnvisa` aparece só dentro de
 * `registrarAuditoria`, e não existe coluna para ela. O aviso teria de ler um dado que não
 * existe — e ninguém descobriria, porque ninguém o chamava.
 *
 * 🔴 A LIÇÃO QUE ESTE GUARDA FIXA: componente que ninguém renderiza não tem comentário
 * testado, não tem prop testada, e não tem entrega. Renderizar é parte de existir.
 *
 * As três coisas que não podem regredir:
 *
 *   1. **Alguma tela renderiza o aviso.**
 *   2. **A condição sai do ESTADO**, não da declaração do cadastro — `autorizacoes_anvisa`
 *      sem linha aprovada e válida. O que existe vale mais que o que ele lembrou de responder.
 *   3. **Avisa, não bloqueia** (ADR-0016 D-06). Quem não tem autorização é justamente quem
 *      veio resolver isso; barrá-lo seria barrar o motivo da visita.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function ler(caminho: string): string {
  return readFileSync(path.join(process.cwd(), caminho), 'utf8');
}

/** Menção em comentário não é uso — a décima quarta vez desta classe neste repositório. */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(linha))
    .join('\n');
}

const CAMINHOS = {
  componente: 'components/paciente/AvisoDaProcuracao.tsx',
  tela: 'app/(paciente)/paciente/page.tsx',
  dados: 'app/_actions/dashboard-paciente.ts',
};

const fontes = Object.fromEntries(Object.entries(CAMINHOS).map(([k, v]) => [k, ler(v)])) as Record<
  keyof typeof CAMINHOS,
  string
>;

const codigo = Object.fromEntries(
  Object.entries(fontes).map(([k, v]) => [k, semComentarios(v)]),
) as Record<keyof typeof CAMINHOS, string>;

// ─────────────────────────────────────────────────────────────────────────────
describe('o aviso chega a uma tela de verdade', () => {
  it('o componente é importado pela tela do paciente', () => {
    expect(codigo.tela).toContain(
      "import { AvisoDaProcuracao } from '@/components/paciente/AvisoDaProcuracao'",
    );
  });

  it('e é RENDERIZADO, não apenas importado — import órfão é o defeito de origem', () => {
    expect(codigo.tela).toMatch(/<AvisoDaProcuracao\b/);
  });

  it('recebe a condição, em vez de ser renderizado com valor fixo', () => {
    expect(codigo.tela).toMatch(/precisaDaProcuracao=\{[^}]*precisaDaProcuracao/);
    expect(codigo.tela).not.toMatch(/precisaDaProcuracao=\{true\}/);
  });

  it('o componente exporta o que a tela importa', () => {
    expect(codigo.componente).toContain('export function AvisoDaProcuracao');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a condição sai do estado real, não da declaração do cadastro', () => {
  it('o dashboard consulta autorizacoes_anvisa', () => {
    expect(codigo.dados).toContain('FROM autorizacoes_anvisa');
  });

  it('só conta autorização APROVADA', () => {
    expect(codigo.dados).toContain("a.status = 'aprovado'");
  });

  it('ignora as apagadas — soft delete é obrigatório nesta tabela', () => {
    expect(codigo.dados).toContain('a.deleted_at IS NULL');
  });

  it('e respeita a validade, sem tratar validade ausente como vencida', () => {
    expect(codigo.dados).toContain('a.data_validade IS NULL OR a.data_validade >= CURRENT_DATE');
  });

  /**
   * ⚠️ O TRECHO É O BLOCO DA QUERY, não "daqui até o fim do arquivo".
   *
   * A primeira versão fatiava do `FROM` em diante e passava verde com a query da ANVISA
   * sabotada — qualquer outra query do arquivo satisfazia a asserção. Escopo largo demais
   * transforma o guarda num detector de "existe em algum lugar", que é o que ele não pode ser.
   */
  it('o paciente da consulta vem do clerkId da sessão, não de valor fixo', () => {
    const inicio = codigo.dados.indexOf('FROM autorizacoes_anvisa');
    expect(inicio).toBeGreaterThan(0);
    const bloco = codigo.dados.slice(inicio, codigo.dados.indexOf('`)', inicio));
    expect(bloco).toContain('u.clerk_id = ${auth.clerkId}');
    expect(bloco).not.toMatch(/clerk_id = '[^$]/);
  });

  it('o campo é exposto no tipo, senão a tela não tem como lê-lo', () => {
    expect(codigo.dados).toMatch(/precisaDaProcuracao: boolean/);
  });

  it('e é devolvido nos dados, não só declarado no tipo', () => {
    const retorno = codigo.dados.slice(codigo.dados.lastIndexOf('dados: {'));
    expect(retorno).toContain('precisaDaProcuracao');
  });

  it('a condição é a NEGAÇÃO de ter autorização — não um campo solto', () => {
    expect(codigo.dados).toMatch(/const precisaDaProcuracao = !/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('avisa, não bloqueia', () => {
  it('o componente devolve null quando não se aplica — nunca uma barreira', () => {
    expect(codigo.componente).toMatch(/if \(!precisaDaProcuracao.*\) return null/);
  });

  it('ele pode ser fechado', () => {
    expect(codigo.componente).toMatch(/setFechado\(true\)/);
  });

  it('e fechar NÃO persiste: na próxima visita o aviso volta', () => {
    expect(codigo.componente).not.toMatch(/localStorage|sessionStorage|fetch\(|action/);
  });

  it('a tela não usa o aviso como condição para mostrar o resto', () => {
    const trecho = codigo.tela.slice(codigo.tela.indexOf('<AvisoDaProcuracao'));
    expect(trecho).not.toMatch(/precisaDaProcuracao \?\s*\(/);
  });

  it('o link leva à procuração em vez de abrir um formulário no meio do aviso', () => {
    expect(codigo.componente).toMatch(/destino = '\/paciente\/anvisa'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a retratação fica escrita', () => {
  /**
   * ⚠️ Este caso olha o COMENTÁRIO de propósito — é a exceção à regra de "menção vs uso".
   * A afirmação falsa ("o cadastro grava a declaração") já esteve no arquivo e orientaria a
   * próxima pessoa a ler um dado que não existe. Apagar sem registrar deixaria o mesmo erro
   * livre para voltar.
   */
  it('o componente registra que a declaração NÃO é persistida', () => {
    expect(fontes.componente).toContain('RETRATAÇÃO, 11/09/2026');
    expect(fontes.componente).toMatch(/n[ãa]o existe\*\* coluna|N[ÃA]O grava/i);
  });

  it('e o cadastro realmente não persiste a declaração — se persistir, a retratação mente', () => {
    const cadastro = ler('app/_actions/cadastro-por-link.ts');
    const schema = ler('db/schema/solicitacoes-cadastro.ts');
    const temColuna =
      /declarou_ter_autorizacao_anvisa|declarouTerAutorizacaoAnvisa:\s*(boolean|text)\(/.test(
        schema,
      );
    expect(
      temColuna,
      'a coluna passou a existir: atualize a retratação e faça o aviso ler a declaração',
    ).toBe(false);
    expect(cadastro).toContain('declarouTerAutorizacaoAnvisa');
  });
});
