/**
 * GUARDA — existe uma tela onde o paciente consente, o registro é lido do banco, e revogar
 * tem efeito.
 *
 * A CLASSE DE ERRO, medida em 11/09/2026: **a P5 lia um consentimento que nenhuma tela
 * colhia**. A regra existia (`podeTransferir`), o formato do registro existia
 * (`consentimento.ts`), e o ato não acontecia em lugar nenhum. Pior que a ausência: o sistema
 * *parecia* pronto — havia módulo, havia tipo, havia comentário citando o art. 11.
 *
 * E a peça que faltava era também a mais perigosa. Enquanto `prepararTransferencia` recebia
 * `finalidadesConsentidas` por **parâmetro**, qualquer chamador podia passar
 * `[retorno_ao_parceiro]` e o envio saía. Um consentimento alegado por quem envia não é
 * consentimento — é a palavra do remetente sobre a vontade de outra pessoa.
 *
 * As cinco coisas que este guarda não deixa regredir:
 *
 *   1. **O consentimento é LIDO do banco**, nunca recebido de quem chama (LGPD art. 11, I).
 *   2. **`revogadoEm IS NULL` está na leitura.** Sem ele, revogar não tem efeito nenhum sobre
 *      o envio, e o botão da tela é decorativo — art. 8º §5º viraria letra.
 *   3. **Revogar MARCA, não apaga.** Proibição nº 4 do `CLAUDE.md`: registro de ato preserva o
 *      anterior. O histórico de ter consentido é o que explica um envio já feito.
 *   4. **As caixas nascem desmarcadas e não travam o cadastro.** Caixa pré-marcada não é
 *      manifestação (art. 8º §4º; Recital 32 do GDPR, _"pre-ticked boxes… should not
 *      constitute consent"_), e aceite obtido como pedágio é viciado (art. 8º §3º) — a mesma
 *      lição já escrita no guarda `consentimento-governa-a-ia-nao-a-consulta`.
 *   5. **O texto e a versão vêm do REGISTRO**, não das constantes de hoje. Mandar a versão
 *      gravada com a redação atual afirmaria que a pessoa leu algo que ela nunca viu
 *      (art. 8º §6º).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FINALIDADES,
  ROTULOS_DAS_FINALIDADES,
  TEXTO_DO_CONSENTIMENTO,
  VERSAO_DO_CONSENTIMENTO,
  type Finalidade,
} from '@/lib/parceiros/consentimento';

function ler(caminho: string): string {
  return readFileSync(path.join(process.cwd(), caminho), 'utf8');
}

/**
 * Tira comentários antes de procurar.
 *
 * ⚠️ Todos os módulos aqui EXPLICAM nos comentários por que não fazem o que não devem — e
 * devem continuar explicando. Procurar a palavra crua acusaria a própria justificativa da
 * decisão. É "menção vs uso", a décima terceira vez desta classe neste repositório.
 */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\/\*|\*)/.test(linha))
    .join('\n');
}

const CAMINHOS = {
  transferencia: 'lib/parceiros/transferencia-de-cadastro.ts',
  registro: 'lib/parceiros/consentimento-registrado.ts',
  action: 'app/(paciente)/_actions/consentimento.ts',
  formulario: 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx',
  cadastro: 'app/_actions/cadastro-por-link.ts',
  componente: 'components/paciente/ConsentimentoDoCompartilhamento.tsx',
  tela: 'app/(paciente)/paciente/privacidade/page.tsx',
  painel: 'app/(paciente)/paciente/privacidade/_components/painel-do-consentimento.tsx',
  schema: 'db/schema/consentimentos.ts',
};

const fontes = Object.fromEntries(Object.entries(CAMINHOS).map(([k, v]) => [k, ler(v)])) as Record<
  keyof typeof CAMINHOS,
  string
>;

const codigo = Object.fromEntries(
  Object.entries(fontes).map(([k, v]) => [k, semComentarios(v)]),
) as Record<keyof typeof CAMINHOS, string>;

// ─────────────────────────────────────────────────────────────────────────────
describe('o consentimento é lido do banco, nunca recebido de quem chama', () => {
  it('prepararTransferencia não aceita finalidades por parâmetro', () => {
    const assinatura = codigo.transferencia.slice(
      codigo.transferencia.indexOf('export async function prepararTransferencia'),
      codigo.transferencia.indexOf('}): Promise<'),
    );
    expect(assinatura).not.toContain('finalidadesConsentidas');
    expect(assinatura).not.toContain('concedidoEm');
  });

  it('e o único parâmetro que sobra é o id da solicitação', () => {
    const assinatura = codigo.transferencia.slice(
      codigo.transferencia.indexOf('export async function prepararTransferencia'),
      codigo.transferencia.indexOf('}): Promise<'),
    );
    expect(assinatura).toContain('solicitacaoId: string');
  });

  it('a P5 chama a leitura do registro', () => {
    expect(codigo.transferencia).toContain('await consentimentosVigentes(');
  });

  it('e passa o que leu para a regra, em vez de decidir por conta própria', () => {
    expect(codigo.transferencia).toMatch(/podeTransferir\(\s*vigentes\.map\(/);
  });

  it('o pacienteId da leitura vem da solicitação, não de parâmetro', () => {
    expect(codigo.transferencia).toContain('consentimentosVigentes(solicitacao.pacienteId)');
  });

  it('solicitação sem paciente não transfere', () => {
    expect(codigo.transferencia).toMatch(
      /if \(!solicitacao\.pacienteId\) return \{ pronta: false, motivo: 'sem_consentimento' \}/,
    );
  });

  it('a trava do ambiente é conferida antes de qualquer consulta ao banco', () => {
    const posTrava = codigo.transferencia.indexOf('transferenciaAtiva()');
    const posSelect = codigo.transferencia.indexOf('db\n    .select');
    const posSelect2 = codigo.transferencia.indexOf('await db');
    expect(posTrava).toBeGreaterThan(0);
    expect(posTrava).toBeLessThan(posSelect === -1 ? posSelect2 : posSelect);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('revogar tem efeito — o filtro que sustenta o art. 8º §5º', () => {
  it('a leitura exclui o que foi revogado', () => {
    expect(codigo.registro).toContain('isNull(consentimentos.revogadoEm)');
  });

  it('e o filtro está na consulta que a P5 usa, não em outra função qualquer', () => {
    const fn = codigo.registro.slice(
      codigo.registro.indexOf('export async function consentimentosVigentes'),
      codigo.registro.indexOf('export async function finalidadesVigentes'),
    );
    expect(fn).toContain('isNull(consentimentos.revogadoEm)');
    expect(fn).toContain('eq(consentimentos.pacienteId, pacienteId)');
  });

  it('revogar marca a data em vez de apagar a linha', () => {
    const fn = codigo.registro.slice(codigo.registro.indexOf('export async function revogar'));
    expect(fn).toContain('.set({ revogadoEm:');
    expect(fn).not.toContain('.delete(');
  });

  it('e revoga só as linhas do paciente, e só as que ainda valem', () => {
    const fn = codigo.registro.slice(codigo.registro.indexOf('export async function revogar'));
    expect(fn).toContain('eq(consentimentos.pacienteId, params.pacienteId)');
    expect(fn).toContain('eq(consentimentos.finalidade, params.finalidade)');
    expect(fn).toContain('isNull(consentimentos.revogadoEm)');
  });

  it('nenhum módulo do consentimento apaga linha da tabela', () => {
    for (const chave of ['registro', 'action', 'cadastro'] as const) {
      expect(codigo[chave]).not.toMatch(/\.delete\(\s*consentimentos\s*\)/);
    }
  });

  it('o schema tem a coluna que a revogação escreve', () => {
    expect(codigo.schema).toContain("revogadoEm: timestamp('revogado_em'");
  });

  it('e revogadoEm é anulável — uma coluna NOT NULL impediria o consentimento vigente', () => {
    const linha = codigo.schema.split('\n').find((l) => l.includes("timestamp('revogado_em'"));
    expect(linha).toBeDefined();
    expect(linha).not.toContain('notNull()');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('existe onde revogar, e é tão fácil quanto consentir', () => {
  it('a tela de privacidade existe e lê o que está gravado', () => {
    expect(codigo.tela).toContain('meusConsentimentos()');
  });

  it('o painel chama a revogação de verdade', () => {
    expect(codigo.painel).toContain('await revogarConsentimento(');
  });

  it('e o mesmo botão concede e revoga — sem caminho separado para desistir', () => {
    expect(codigo.painel).toContain('await registrarConsentimento(');
    expect(codigo.painel).toMatch(/aRevogar/);
  });

  it('a revogação acontece antes da concessão, para a falha parar no estado mais restritivo', () => {
    const iRevoga = codigo.painel.indexOf('await revogarConsentimento(');
    const iConcede = codigo.painel.indexOf('await registrarConsentimento(');
    expect(iRevoga).toBeGreaterThan(0);
    expect(iRevoga).toBeLessThan(iConcede);
  });

  it('a action de revogar existe e é exportada', () => {
    expect(codigo.action).toContain('export async function revogarConsentimento');
  });

  /**
   * ⚠️ MEDE TODAS AS CHAMADAS, não a presença de uma.
   *
   * A primeira versão deste caso procurava a string e passava verde com uma das duas chamadas
   * sabotada — a outra satisfazia o `toContain`. É a mesma classe de defeito que já apareceu
   * em `o-deploy-entrega-o-que-buildou` (o passo tinha dois `exit 1`): presença não é
   * cobertura.
   */
  it('TODA revalidação do painel alcança as rotas filhas de /paciente', () => {
    const chamadas = codigo.action.match(/revalidatePath\([^)]*\)/g) ?? [];
    expect(chamadas.length).toBeGreaterThanOrEqual(2);
    for (const chamada of chamadas) {
      expect(chamada, chamada).toContain("'layout'");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a escolha é da pessoa — não vem marcada, nem vira pedágio', () => {
  it('o formulário inicia a lista vazia', () => {
    expect(codigo.formulario).toMatch(/useState<Finalidade\[\]>\(\[\]\)/);
  });

  it('o consentimento NÃO entra na condição que libera o envio do cadastro', () => {
    const bloco = codigo.formulario.slice(
      codigo.formulario.indexOf('const podeEnviar ='),
      codigo.formulario.indexOf('const forcaDaSenha'),
    );
    expect(bloco.length).toBeGreaterThan(0);
    expect(bloco).not.toContain('finalidadesConsentidas');
    expect(bloco).not.toContain('consentiu');
  });

  it('e o botão de enviar não é desabilitado pelo consentimento', () => {
    expect(codigo.formulario).not.toMatch(/disabled=\{[^}]*finalidadesConsentidas/);
  });

  it('o componente não pré-marca nenhuma finalidade', () => {
    expect(codigo.componente).not.toMatch(
      /selecionadas\s*=\s*\[\s*FINALIDADES|defaultChecked|checked\s*=\s*\{?\s*true/,
    );
  });

  it('cada finalidade mostra o efeito de recusar — informação clara é requisito de validade', () => {
    expect(codigo.componente).toContain('rotulo.efeitoSeRecusar');
  });

  it('e todas as finalidades têm rótulo e efeito declarados', () => {
    for (const finalidade of Object.values(FINALIDADES) as Finalidade[]) {
      const r = ROTULOS_DAS_FINALIDADES[finalidade];
      expect(r, `finalidade sem rótulo: ${finalidade}`).toBeDefined();
      expect(r.titulo.length).toBeGreaterThan(10);
      expect(r.efeitoSeRecusar.length).toBeGreaterThan(10);
    }
  });

  it('o texto integral aparece na tela — não escondido atrás de link', () => {
    expect(codigo.componente).toContain('{TEXTO_DO_CONSENTIMENTO}');
  });

  it('e a versão fica visível, porque é ela que diz a que texto ele disse sim', () => {
    expect(codigo.componente).toContain('{VERSAO_DO_CONSENTIMENTO}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o que se grava não vem do cliente', () => {
  it('o texto e a versão saem das constantes, dentro de conceder()', () => {
    const fn = codigo.registro.slice(
      codigo.registro.indexOf('export async function conceder'),
      codigo.registro.indexOf('export async function revogar'),
    );
    expect(fn).toContain('versao: VERSAO_DO_CONSENTIMENTO');
    expect(fn).toContain('textoApresentado: TEXTO_DO_CONSENTIMENTO');
  });

  it('conceder não aceita texto nem versão por parâmetro', () => {
    const assinatura = codigo.registro.slice(
      codigo.registro.indexOf('export async function conceder'),
      codigo.registro.indexOf('}): Promise<void>'),
    );
    expect(assinatura).not.toContain('texto');
    expect(assinatura).not.toContain('versao');
  });

  it('a action resolve o paciente pela SESSÃO, não por id do formulário', () => {
    expect(codigo.action).toContain('obterUsuarioAtual()');
    expect(codigo.action).toContain('eq(users.clerkId, perm.clerkId)');
  });

  it('e nenhuma action exportada recebe pacienteId', () => {
    const exportadas = codigo.action.match(/export async function \w+\([^)]*\)/g) ?? [];
    expect(exportadas.length).toBeGreaterThan(0);
    for (const assinatura of exportadas) {
      expect(assinatura, assinatura).not.toContain('pacienteId');
    }
  });

  it('a finalidade é validada contra a lista fechada, não por formato', () => {
    expect(codigo.action).toMatch(/z\.enum\(\[\s*FINALIDADES\./);
  });

  it('o cadastro por link também fecha a lista', () => {
    expect(codigo.cadastro).toMatch(/z\.enum\(\[\s*FINALIDADES\./);
  });

  it('e o cadastro grava pelo mesmo caminho, sem insert próprio', () => {
    expect(codigo.cadastro).toContain('await conceder(');
    expect(codigo.cadastro).not.toMatch(/insert\(consentimentos\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o que viaja para a Greens é o que ele leu', () => {
  it('a versão sai do registro, não da constante do módulo', () => {
    expect(codigo.transferencia).toContain('versao: autorizadora.versao');
    expect(codigo.transferencia).not.toContain('versao: VERSAO_DO_CONSENTIMENTO');
  });

  it('o texto também — versão gravada com redação nova afirmaria o que ele não leu', () => {
    expect(codigo.transferencia).toContain('texto: autorizadora.textoApresentado');
    expect(codigo.transferencia).not.toContain('texto: TEXTO_DO_CONSENTIMENTO');
  });

  it('a data é a do consentimento, não a do envio', () => {
    expect(codigo.transferencia).toContain('autorizadora.concedidoEm.toISOString()');
    expect(codigo.transferencia).not.toMatch(/concedidoEm: new Date\(\)/);
  });

  it('a linha que autoriza é a da finalidade específica do compartilhamento', () => {
    expect(codigo.transferencia).toContain('FINALIDADES.retornoAoParceiro');
  });

  it('e a ausência dela não estoura — devolve motivo', () => {
    expect(codigo.transferencia).toMatch(/if \(!autorizadora\) return \{ pronta: false/);
    expect(codigo.transferencia).not.toMatch(/retornoAoParceiro\)!/);
  });

  it('o registro devolve o texto apresentado, senão a P5 não teria de onde tirá-lo', () => {
    expect(codigo.registro).toContain('textoApresentado: consentimentos.textoApresentado');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('as constantes que tudo isto pressupõe continuam de pé', () => {
  it('a versão existe e tem forma de versão', () => {
    expect(VERSAO_DO_CONSENTIMENTO).toMatch(/^\d{4}-\d{2}-\d{2}\.v\d+$/);
  });

  it('o texto nomeia as finalidades em vez de pedir autorização genérica', () => {
    expect(TEXTO_DO_CONSENTIMENTO).toContain('avaliação');
    expect(TEXTO_DO_CONSENTIMENTO).toContain('Anvisa');
    expect(TEXTO_DO_CONSENTIMENTO).toContain('Greens Corp');
    expect(TEXTO_DO_CONSENTIMENTO.length).toBeGreaterThan(200);
  });

  it('as três finalidades seguem separadas — um bloco só destruiria a escolha', () => {
    expect(Object.keys(FINALIDADES)).toHaveLength(3);
    expect(new Set(Object.values(FINALIDADES)).size).toBe(3);
  });

  it('o guarda cobre todos os módulos do fluxo, e nenhum caminho sumiu', () => {
    for (const [nome, caminho] of Object.entries(CAMINHOS)) {
      expect(fontes[nome as keyof typeof CAMINHOS].length, caminho).toBeGreaterThan(200);
    }
  });
});
