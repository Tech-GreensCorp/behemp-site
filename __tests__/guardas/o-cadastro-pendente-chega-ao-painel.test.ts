/**
 * O CADASTRO PELA METADE APARECE NO PAINEL — em vez de o paciente ver uma tela vazia.
 *
 * 🔴 ADR-0022. O dono percorreu o fluxo 1 da Greens e ficou com uma conta funcionando, um
 * painel vazio e nenhuma pista: _"eu entrei na conta e vim na área de meus documentos:
 * nenhum dos documentos que eu enviei chegaram na minha conta"_.
 *
 * ⚠️ E OS DOCUMENTOS ESTAVAM LÁ. Medido em produção em 12/09/2026: o link dele ainda
 * respondia `Confirme seus dados` enquanto o painel dizia "nenhum documento enviado". As duas
 * coisas eram verdade ao mesmo tempo, e nenhuma tela ligava uma à outra — `grep
 * solicitacoesCadastro` em `app/(paciente)` dava **zero**.
 *
 * 🔴 O GAP NÃO ESTAVA EM NENHUMA ETAPA, e sim ENTRE DUAS (ADR-0022 §2): a conta é um fato, a
 * ficha do cadastro é outro, e nada perguntava se havia um cadastro esperando aquela pessoa.
 *
 * ⚠️ CASA PELO E-MAIL, e é a única chave possível: a solicitação nasce ANTES da conta —
 * quando a Greens a cria, não existe `clerkId` nem `pacienteId` para amarrar.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const MODULO = semComentarios(ler('lib/parceiros/cadastro-pendente.ts'));
const ACTION = semComentarios(ler('app/_actions/dashboard-paciente.ts'));
const TELA = semComentarios(ler('app/(paciente)/paciente/page.tsx'));
const AVISO_FONTE = ler('components/paciente/AvisoDeCadastroPendente.tsx');
const AVISO = semComentarios(AVISO_FONTE);

describe('o cadastro pendente chega ao painel', () => {
  it('⚠️ VACUIDADE: o módulo consulta a tabela de solicitações', () => {
    expect(MODULO).toMatch(/from\(solicitacoesCadastro\)/);
  });

  it('🔴 casa pelo E-MAIL — a solicitação nasce antes de existir clerkId', () => {
    expect(MODULO).toMatch(/eq\(solicitacoesCadastro\.email/);
  });

  it('🔴 as TRÊS condições que fazem "pendente" significar algo', () => {
    // Sem qualquer uma, o aviso apareceria para quem não precisa — e aviso que não some
    // ninguém lê.
    expect(MODULO, 'conta cadastro já concluído').toMatch(
      /isNull\(solicitacoesCadastro\.usadoEm\)/,
    );
    expect(MODULO, 'conta link vencido').toMatch(/gt\(solicitacoesCadastro\.expiraEm/);
    expect(MODULO, 'conta ficha já vinculada').toMatch(
      /isNull\(solicitacoesCadastro\.pacienteId\)/,
    );
  });

  it('🔴 NÃO devolve o token — o banco só tem o hash, e é assim de propósito', () => {
    /**
     * ADR-0016 D-04: o token só existe em hash, para que quem lê o banco não abra o cadastro
     * de ninguém. Se alguém "melhorar" isto devolvendo um token, a mitigação inteira cai.
     */
    expect(MODULO).not.toMatch(/tokenHash/);
    expect(MODULO).not.toMatch(/\btoken\b\s*:/);
  });

  it('⚠️ e NUNCA derruba o painel — isto é um aviso, não um requisito', () => {
    expect(MODULO).toMatch(/catch \(erro\)/);
    const i = MODULO.indexOf('catch (erro)');
    expect(MODULO.slice(i, i + 320)).toMatch(/return null/);
  });

  it('⚠️ o log não carrega o e-mail — é dado pessoal', () => {
    const i = MODULO.indexOf('falha ao procurar cadastro pendente');
    expect(MODULO.slice(i, i + 260)).not.toMatch(/:\s*(alvo|email)\b/);
  });

  it('🔴 o DASHBOARD pergunta — era o que ninguém fazia', () => {
    expect(ACTION).toContain('cadastroPendenteDoEmail');
    expect(ACTION).toMatch(/cadastroPendente,/);
  });

  it('🔴 e a TELA renderiza — componente órfão não avisa ninguém', () => {
    /**
     * ⚠️ A CLASSE MAIS REPETIDA DESTE REPOSITÓRIO: o `AvisoDaProcuracao` passou quatro
     * semanas importado e nunca renderizado; `prepararTransferencia` existia com guarda e
     * ninguém a chamava — a Greens achou com `grep` antes de nós. Importar não é usar.
     */
    expect(TELA).toContain('AvisoDeCadastroPendente');
    expect(TELA).toMatch(/<AvisoDeCadastroPendente\s+cadastro=/);
  });

  it('🔴 vem ANTES da procuração — quem não concluiu o cadastro não tem o que autorizar', () => {
    const pendente = TELA.indexOf('<AvisoDeCadastroPendente');
    const procuracao = TELA.indexOf('<AvisoDaProcuracao');
    expect(pendente).toBeGreaterThan(-1);
    expect(procuracao).toBeGreaterThan(pendente);
  });

  it('⚠️ o aviso AVISA e não bloqueia — sem pendência, não renderiza nada', () => {
    expect(AVISO).toMatch(/if \(!cadastro\) return null;/);
  });

  it('🔴 e diz que os documentos estão GUARDADOS — era a dúvida que fez o dono parar', () => {
    expect(AVISO_FONTE).toMatch(/já enviou estão guardados/i);
  });

  it('⚠️ não promete um botão "continuar" que não pode existir', () => {
    // Sem o token, não há URL de cadastro a montar. Levar a lugar nenhum é pior que orientar.
    expect(AVISO).not.toMatch(/\/cadastro\/\$\{/);
    expect(AVISO).toMatch(/wa\.me/);
  });
});
