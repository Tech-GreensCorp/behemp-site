/**
 * A SENTINELA RESPONDE O PONTO **E O PORQUÊ** — e nunca bloqueia quem é legado.
 *
 * 🔴 ADR-0022, D-05 a D-07, D-12 e D-16. É a peça central da Sprint 8, e o pedido do dono que
 * a originou: _"o certo é criarmos uma sentinela que é capaz de monitorar isso e entregar a
 * tela certa para cada usuário"_.
 *
 * ## O que ela existe para impedir
 *
 * A decisão sobre o que mostrar estava espalhada: `/redirect` decidia papel,
 * `destinoDepoisDoCadastro` decidia destino, o painel decidia avisos — e **nenhum via o quadro
 * inteiro**. Foi assim que a ficha casca do `/redirect` (G2) passou a mentir para todos os
 * outros: existe linha em `pacientes`, logo toda tela responde "sim, tem ficha".
 *
 * ## Os dois riscos que os casos abaixo vigiam
 *
 * 🔴 **BLOQUEAR QUEM JÁ ESTÁ EM TRATAMENTO** é o pior erro possível desta função. Ficha sem
 * procedência significa "criada antes desta mudança", **não** "origem desconhecida" — e o
 * dono foi explícito (R9): _"usuários antigos que já possuem a conta criada não terão esse
 * bloqueio"_.
 *
 * 🔴 **DEVOLVER UM PONTO SEM O PORQUÊ.** Em 12/09 o aviso de cadastro pendente sumiu da tela e
 * não havia como saber qual das três condições o barrou. Estado que depende de várias
 * condições precisa dizer **qual** decidiu — senão o diagnóstico vira adivinhação, que já
 * custou dois deploys neste projeto.
 *
 * ⚠️ E ELA SÓ LÊ. Uma sentinela que escreve vira mais um dos **sete** criadores de ficha
 * (ADR-0022 §16) — exatamente o problema que ela existe para resolver.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const SENTINELA = semComentarios(ler('lib/fluxo/sentinela.ts'));
const ROTA = semComentarios(ler('app/api/fluxo/situacao/route.ts'));

/** Os pontos que o tipo declara. */
function pontosDeclarados(): string[] {
  const i = SENTINELA.indexOf('export type PontoDoFluxo');
  expect(i, 'não achei o tipo').toBeGreaterThan(-1);
  return [...SENTINELA.slice(i, SENTINELA.indexOf(';', i)).matchAll(/'([a-z_]+)'/g)].map(
    (m) => m[1],
  );
}

describe('a sentinela responde o ponto e o porquê', () => {
  it('⚠️ VACUIDADE: o tipo declara mais de um ponto', () => {
    expect(pontosDeclarados().length).toBeGreaterThan(3);
  });

  /**
   * 🔴 COBERTURA NOS DOIS SENTIDOS — e a primeira versão só olhava um.
   *
   * Ela exigia que todo ponto do tipo fosse devolvido por algum ramo. Removendo um ponto do
   * TIPO, a lista encolhia e os que sobravam continuavam sendo devolvidos: a sabotagem
   * "tira `completo_legado` do tipo" **passou**. Um guarda que só olha de um lado aprova a
   * remoção do outro.
   *
   * Agora os dois conjuntos têm de ser IGUAIS: nenhum ponto declarado sem ramo, nenhum ramo
   * devolvendo ponto que o tipo não declara.
   */
  it('🔴 COBERTURA: os pontos do TIPO e os pontos DEVOLVIDOS são o mesmo conjunto', () => {
    const declarados = new Set(pontosDeclarados());
    const devolvidos = new Set([...SENTINELA.matchAll(/ponto:\s*'([a-z_]+)'/g)].map((m) => m[1]));

    for (const ponto of declarados) {
      expect(devolvidos.has(ponto), `o ponto '${ponto}' nunca é devolvido`).toBe(true);
    }
    for (const ponto of devolvidos) {
      expect(declarados.has(ponto), `'${ponto}' é devolvido e não está no tipo`).toBe(true);
    }
  });

  it('⚠️ e os pontos essenciais não podem sumir do tipo', () => {
    /**
     * A cobertura acima ficaria verde se alguém removesse um ponto do tipo E o seu ramo.
     * Estes quatro não são opcionais: cada um é um estado que ACONTECE, e some da tela quem
     * não é nomeado.
     */
    const declarados = pontosDeclarados();
    for (const essencial of [
      'completo',
      'completo_legado',
      'cadastro_pendente',
      'documentos_nao_materializados',
    ]) {
      expect(declarados, `o ponto '${essencial}' foi removido do tipo`).toContain(essencial);
    }
  });

  it('🔴 todo retorno traz o PORQUÊ — sem ele o G6 se repete', () => {
    /**
     * ⚠️ A primeira versão comparava CONTAGENS no arquivo inteiro, e contagem não diz QUAL
     * retorno ficou sem. Agora cada bloco de retorno é conferido: um `ponto:` sem `porque:`
     * ao lado fica vermelho nomeando o ponto.
     */
    for (const m of SENTINELA.matchAll(/ponto:\s*'([a-z_]+)'/g)) {
      const bloco = SENTINELA.slice(m.index ?? 0, (m.index ?? 0) + 260);
      expect(bloco, `o ponto '${m[1]}' é devolvido sem porquê`).toMatch(/porque:/);
    }
  });

  it('🔴 ficha SEM procedência sai por `completo_legado` — nunca bloqueia (R9)', () => {
    /**
     * `null` significa "criada antes de a procedência existir". Tratar isso como cadastro
     * incompleto bloquearia quem já está em tratamento — o pior erro possível aqui.
     */
    const i = SENTINELA.indexOf('if (!pessoa.origem)');
    expect(i, 'não achei o ramo do legado').toBeGreaterThan(-1);
    expect(SENTINELA.slice(i, i + 260)).toMatch(/ponto:\s*'completo_legado'/);
  });

  it('🔴 e o legado é decidido ANTES de cobrar documento', () => {
    // Invertido, um paciente antigo cairia em `documentos_nao_materializados` e veria uma
    // cobrança sobre um cadastro que nunca passou por aqui.
    const legado = SENTINELA.indexOf('if (!pessoa.origem)');
    const documento = SENTINELA.indexOf("ponto: 'documentos_nao_materializados'");
    expect(legado).toBeGreaterThan(-1);
    expect(documento).toBeGreaterThan(legado);
  });

  it('🔴 ela SÓ LÊ — não cria ficha, não consome link', () => {
    // Escrever a tornaria o oitavo criador de ficha, que é o problema que ela resolve.
    expect(SENTINELA).not.toMatch(/\.insert\(/);
    expect(SENTINELA).not.toMatch(/\.update\(/);
    expect(SENTINELA).not.toMatch(/marcarComoUtilizada/);
  });

  it('⚠️ ignora ficha e documento apagados — soft delete é regra do domínio', () => {
    expect(SENTINELA).toMatch(/isNull\(pacientes\.deletedAt\)/);
    expect(SENTINELA).toMatch(/isNull\(documentos\.deletedAt\)/);
    expect(SENTINELA).toMatch(/isNull\(users\.deletedAt\)/);
  });

  it('🔴 a solicitação pendente casa por E-MAIL — ela nasce antes da conta', () => {
    // Não há `clerkId` nem `pacienteId` quando a Greens cria a solicitação.
    expect(SENTINELA).toMatch(/eq\(solicitacoesCadastro\.email/);
  });

  it('⚠️ e exige as três condições de "pendente"', () => {
    expect(SENTINELA).toMatch(/isNull\(solicitacoesCadastro\.usadoEm\)/);
    expect(SENTINELA).toMatch(/gt\(solicitacoesCadastro\.expiraEm/);
    expect(SENTINELA).toMatch(/isNull\(solicitacoesCadastro\.pacienteId\)/);
  });

  it('🔴 A ROTA de diagnóstico existe e USA a sentinela — D-16', () => {
    /**
     * Sem banco nem VPS, é por ela que se descobre por que alguém travou. Reimplementar a
     * lógica aqui faria as duas divergirem — e a rota mentiria sobre o que a tela vê.
     */
    expect(ROTA).toContain('situacaoDoFluxo');
    expect(ROTA).toMatch(/porque: situacao\.porque/);
  });

  it('🔴 a rota exige SEGREDO e tem limite — descrever conta é sondagem se ficar aberto', () => {
    expect(ROTA).toMatch(/lerSegredoDoCabecalho/);
    expect(ROTA).toMatch(/identificarConta/);
    expect(ROTA).toMatch(/status: 401/);
    expect(ROTA).toMatch(/status: 429/);
  });

  it('🔴 e NÃO devolve dado pessoal — nem e-mail, nem nome, nem CPF', () => {
    /**
     * ⚠️ DEFEITO MEU, achado por sabotagem: `indexOf('return NextResponse.json(')` pegava a
     * PRIMEIRA ocorrência — a do 429 —, e o caso nunca olhava a resposta de verdade. A
     * sabotagem "a rota devolve o e-mail" passou.
     *
     * É a terceira vez que esta classe aparece hoje: `lastIndexOf` já tinha sido a correção
     * no guarda da rota de eco, pelo mesmo motivo.
     */
    const i = ROTA.lastIndexOf('return NextResponse.json(');
    expect(i, 'não achei a resposta final').toBeGreaterThan(-1);
    const corpo = ROTA.slice(i, ROTA.indexOf('headers:', i));

    // Prova que é o corpo certo: ele tem o ponto.
    expect(corpo).toMatch(/ponto: situacao\.ponto/);

    expect(corpo, 'a resposta carrega e-mail').not.toMatch(/\bemail\b/);
    expect(corpo, 'a resposta carrega dado pessoal').not.toMatch(/\bnome\b|\bcpf\b|telefone/);
  });

  it('⚠️ a rota lê a query pelo helper — o proxy percent-encoda o segundo `?`', () => {
    // Ler `searchParams` cru é o defeito que `a-query-do-painel-aguenta-o-separador-errado`
    // fecha, e que custou dois deploys.
    expect(ROTA).toContain('parametrosDoPainel');
    expect(ROTA).not.toMatch(/nextUrl\.searchParams/);
  });
});
