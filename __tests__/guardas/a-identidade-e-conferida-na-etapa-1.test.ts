/**
 * GUARDA — a identidade é conferida na ETAPA 1 do cadastro, e a tela não vira oráculo.
 *
 * ADR-0028 · Item 50 · `DO-59` a `DO-63`. Pedido de 28/09/2026: conferir CPF, telefone e e-mail
 * _"logo na etapa 1 do formúlario, não dps que ele preenche tudo"_; logado em outra conta, _"o
 * botão de sair não sai da página do formúlario"_; CPF que bate vai _"para o suporte da
 * behemp"_.
 *
 * Quebra o build se:
 *   1. a DECISÃO errar algum dos casos — executada, não lida: guarda mede efeito, não forma
 *   2. a normalização deixar de casar o mesmo dado escrito de jeitos diferentes
 *   3. a tela passar a receber ou exibir o dado da OUTRA conta
 *   4. o "Continuar" da etapa 1 voltar a só avançar o passo
 *   5. algum `signOut(` voltar a navegar para fora da página, ou a derrubar todas as sessões
 *   6. o aviso de sessão alheia sair da etapa 1
 *   7. a action final deixar de conferir o CPF ANTES de escrever
 *   8. a conferência perder o token, o limite ou a auditoria, ou o limite ficar inalcançável
 *   9. a tela importar o módulo que importa o banco
 *
 * ⚠️ O caso 1 é o que importa mais, e é o que EXECUTA: a regra "CPF igual na conta do mesmo
 * e-mail é a mesma pessoa" (resposta E) se prova rodando `decidirVeredito`, não procurando a
 * palavra no arquivo. O que é estrutural (3 a 9) é o que não dá para executar sem navegador ou
 * sem banco — e a integração (`__tests__/integracao/a-identidade-e-conferida-na-etapa-1.test.ts`)
 * executa a consulta contra um Postgres real.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  VEREDITOS,
  VEREDITOS_COM_AVISO,
  TEXTO_DE_MUITAS_TENTATIVAS,
  TEXTO_DO_SUPORTE,
  TEXTO_DO_TELEFONE_EM_USO,
  cpfParaConferir,
  decidirVeredito,
  emailParaConferir,
  telefoneParaConferir,
  telefoneEmUso,
  temAviso,
  type Achados,
  type EstadoDaSessao,
  type Veredito,
} from '@/lib/cadastro/veredito-de-identidade';

import { semComentarios } from './_apoio/codigo';

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');

const TELA = semComentarios(
  ler('app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx'),
);
const AVISO = semComentarios(
  ler('app/(auth)/cadastro/[token]/_components/aviso-de-identidade.tsx'),
);
const PAGINA = semComentarios(ler('app/(auth)/cadastro/[token]/page.tsx'));
const ACTION_DA_ETAPA = semComentarios(ler('app/_actions/identidade-no-cadastro.ts'));
const ACTION_FINAL = semComentarios(ler('app/_actions/cadastro-por-link.ts'));
const CONSULTA = semComentarios(ler('lib/cadastro/conferir-identidade.ts'));
const PURO = semComentarios(ler('lib/cadastro/veredito-de-identidade.ts'));

/** O corpo de uma função nomeada — do nome até a chave que a fecha. */
function corpoDe(fonte: string, nome: string): string {
  const i = fonte.search(new RegExp(`function ${nome}\\s*\\(`));
  if (i < 0) return '';
  /**
   * ⚠️ A chave que abre o CORPO é a que termina a linha. A primeira `{` depois dos parâmetros
   * pode ser a de um tipo de retorno (`Promise<ResultadoAction<{ veredito: Veredito }>>`) — foi
   * o defeito deste guarda ao nascer: ele lia o tipo como se fosse a função.
   */
  const abre = fonte.indexOf(' {\n', fonte.indexOf(')', i)) + 1;
  let nivel = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === '{') nivel++;
    else if (fonte[j] === '}' && --nivel === 0) return fonte.slice(abre, j + 1);
  }
  return '';
}

const PESSOA = 'u_pessoa';
const OUTRA = 'u_outra';
const nada: Achados = {
  contaDoEmail: null,
  contaDoEmailDoLink: null,
  donosDoCpf: [],
  donosDoTelefone: [],
};
const semSessao: EstadoDaSessao = { estado: 'nenhuma' };
/** A pessoa do link, com conta de acesso, e o link trazendo o e-mail dela. */
const daPessoa = {
  contaDoEmail: { userId: PESSOA, temAcesso: true },
  contaDoEmailDoLink: PESSOA,
};

describe('a identidade é conferida na etapa 1 — a DECISÃO, executada', () => {
  // `esperado` é `Veredito`, não `string`: um nome errado na tabela não compila (revisão, 28/09).
  it.each<[string, Achados, EstadoDaSessao, Veredito]>([
    ['nada bateu', nada, semSessao, 'livre'],
    [
      'sessão de OUTRA pessoa vem antes de tudo, até do CPF (DO-60)',
      { ...nada, donosDoCpf: [OUTRA] },
      { estado: 'alheia' },
      'sessao_alheia',
    ],
    [
      'CPF na ficha de outra conta, sem sessão → suporte (DO-62)',
      { ...nada, donosDoCpf: [OUTRA] },
      semSessao,
      'cpf_em_outra_conta',
    ],
    [
      '🔴 CPF na conta do MESMO e-mail é a mesma pessoa voltando → login, NÃO suporte (DO-67)',
      { ...nada, ...daPessoa, donosDoCpf: [PESSOA] },
      semSessao,
      'conta_pelo_email',
    ],
    [
      '🔴 o e-mail DIGITADO não torna o CPF "da pessoa" — fecha o oráculo e-mail ↔ CPF (revisão)',
      { ...nada, contaDoEmail: { userId: PESSOA, temAcesso: true }, donosDoCpf: [PESSOA] },
      semSessao,
      'cpf_em_outra_conta',
    ],
    [
      'CPF na conta da SESSÃO dela → segue',
      { ...nada, donosDoCpf: [PESSOA] },
      { estado: 'propria', userId: PESSOA },
      'sessao_propria',
    ],
    [
      'CPF em OUTRA conta mesmo logada na própria → suporte',
      { ...nada, donosDoCpf: [PESSOA, OUTRA] },
      { estado: 'propria', userId: PESSOA },
      'cpf_em_outra_conta',
    ],
    [
      'CPF de outra conta que NÃO é a do e-mail do link → suporte',
      { ...nada, ...daPessoa, donosDoCpf: [OUTRA] },
      semSessao,
      'cpf_em_outra_conta',
    ],
    [
      '🔴 e-mail em `users` SEM conta de acesso (criado pelo admin) não manda ao login',
      {
        ...nada,
        contaDoEmail: { userId: PESSOA, temAcesso: false },
        contaDoEmailDoLink: PESSOA,
      },
      semSessao,
      'livre',
    ],
    [
      'e o CPF dessa ficha sem acesso é da mesma pessoa, não de outra',
      {
        ...nada,
        contaDoEmail: { userId: PESSOA, temAcesso: false },
        contaDoEmailDoLink: PESSOA,
        donosDoCpf: [PESSOA],
      },
      semSessao,
      'livre',
    ],
    [
      'telefone de outra conta → o campo trava (DO-68)',
      { ...nada, donosDoTelefone: [OUTRA] },
      semSessao,
      'telefone_conhecido',
    ],
    [
      'telefone da conta do e-mail do link não trava — é o login',
      { ...nada, ...daPessoa, donosDoTelefone: [PESSOA] },
      semSessao,
      'conta_pelo_email',
    ],
    [
      '🔴 logada na PRÓPRIA conta, o telefone de outra TRAVA na etapa 1 — não só no envio (revisão)',
      { ...nada, donosDoTelefone: [OUTRA] },
      { estado: 'propria', userId: PESSOA },
      'telefone_conhecido',
    ],
    [
      'logada na própria conta, com o próprio telefone → segue',
      { ...nada, donosDoTelefone: [PESSOA] },
      { estado: 'propria', userId: PESSOA },
      'sessao_propria',
    ],
    [
      'sessão própria sem linha em `users` ainda (webhook atrasado) usa a conta do e-mail do link',
      { ...nada, ...daPessoa, donosDoCpf: [PESSOA] },
      { estado: 'propria', userId: null },
      'sessao_propria',
    ],
  ])('%s', (_nome, achados, sessao, esperado) => {
    expect(VEREDITOS, `'${esperado}' não é um veredito declarado`).toContain(esperado);
    expect(decidirVeredito({ achados, sessao })).toBe(esperado);
  });

  it('🔴 `limite` NÃO para a pessoa — não responder já é a proteção (ADR-0028 D-08, retificada)', () => {
    expect(temAviso('limite')).toBe(false);
    expect(telefoneEmUso('limite')).toBe(false);
    expect(temAviso('indisponivel')).toBe(false);
    expect(temAviso('cpf_em_outra_conta')).toBe(true);
  });
});

describe('a normalização casa o mesmo dado escrito de jeitos diferentes', () => {
  it('CPF com e sem pontuação é o mesmo; CPF inválido não se confere', () => {
    expect(cpfParaConferir('529.982.247-25')).toBe('52998224725');
    expect(cpfParaConferir('52998224725')).toBe('52998224725');
    expect(cpfParaConferir('111.111.111-11')).toBeNull();
    expect(cpfParaConferir('123')).toBeNull();
  });

  it('e-mail ignora caixa e espaço', () => {
    expect(emailParaConferir('  Fulano@Exemplo.COM ')).toBe('fulano@exemplo.com');
    expect(emailParaConferir('sem-arroba')).toBeNull();
  });

  it('🔴 os QUATRO formatos de telefone do banco (Item 26) dão a mesma chave', () => {
    const chave = telefoneParaConferir('(11) 98765-4321');
    expect(chave).toBe('11987654321');
    for (const formato of ['+5511987654321', '5511987654321', '11987654321', '11 98765 4321']) {
      expect(telefoneParaConferir(formato), formato).toBe(chave);
    }
  });

  it('⚠️ fixo de 10 dígitos não se confere — falso negativo aceito, a pessoa segue', () => {
    expect(telefoneParaConferir('(11) 3333-4444')).toBeNull();
  });

  it('🔴 a CONSULTA normaliza o lado do banco, e só lê linha viva', () => {
    expect(CONSULTA).toMatch(/regexp_replace\(coalesce\(\$\{pacientes\.cpf\}/);
    expect(CONSULTA).toMatch(/lower\(\$\{users\.email\}\)/);
    // A conta do e-mail DO LINK é buscada à parte: é ela que diz de quem são CPF e telefone.
    expect(CONSULTA).toMatch(/contaDoEmailDoLink: contaDoLink\?\.userId/);
    // O DDI sai dos DOIS lados pela mesma regra — senão o mesmo número casa ou não conforme o
    // formato em que foi gravado.
    expect(CONSULTA).toMatch(
      /regexp_replace\(regexp_replace\(coalesce\(\$\{users\.telefone\}[^`]*'\^55\(\[0-9\]\{10,11\}\)\$'/,
    );
    expect(CONSULTA).toMatch(/isNull\(pacientes\.deletedAt\)/);
    expect(CONSULTA).toMatch(/isNull\(users\.deletedAt\)/);
    // A conta de acesso é o `clerkId`: é o que separa "entre" de "a mesma pessoa, sem conta".
    expect(CONSULTA).toMatch(/temAcesso:\s*Boolean\(contaDoEmail\.clerkId\)/);
  });
});

describe('a tela não vira oráculo', () => {
  it('🔴 a action da etapa 1 devolve SÓ o veredito', () => {
    const devolvidos = [...ACTION_DA_ETAPA.matchAll(/\bok\(\s*(\{[^}]*\})\s*\)/g)].map((m) => m[1]);
    expect(devolvidos.length, 'a action não devolve nada?').toBeGreaterThan(0);
    for (const d of devolvidos) {
      expect(d, `devolve mais que o veredito: ${d}`).toMatch(/^\{\s*veredito(: '[a-z_]+')?\s*\}$/);
    }
  });

  it('🔴 o aviso não recebe dado nenhum da conta encontrada', () => {
    const props = AVISO.slice(
      AVISO.indexOf('interface Props'),
      AVISO.indexOf('}', AVISO.indexOf('interface Props')),
    );
    for (const proibido of ['cpf', 'email', 'telefone', 'nome', 'userId']) {
      expect(
        new RegExp(`\\b${proibido}\\b`, 'i').test(props),
        `${proibido} nas props do aviso`,
      ).toBe(false);
    }
  });

  it('🔴 nenhum texto que a pessoa lê diz QUAL dado bateu', () => {
    const textos = [
      TEXTO_DO_SUPORTE,
      ...[...AVISO.matchAll(/>\s*([^<>{}]*[A-Za-zÀ-ú][^<>{}]*)\s*</g)].map((m) => m[1]),
    ];
    expect(textos.length).toBeGreaterThan(3);
    for (const t of textos) {
      expect(
        /\bcpf\b|\btelefone\b|j[áa] (est[áa] )?cadastrad|j[áa] existe/i.test(t),
        `o texto revela: "${t}"`,
      ).toBe(false);
    }
  });

  it('⚠️ o aviso sabe exibir todo veredito que tem aviso', () => {
    // `===` ou `!==` — o último ramo é exaustivo (`never`), então um veredito novo sem tela não
    // compila. O guarda confere que cada um é tratado pelo NOME.
    for (const v of VEREDITOS_COM_AVISO) {
      expect(AVISO, `o aviso não trata '${v}'`).toMatch(new RegExp(`veredito [!=]== '${v}'`));
    }
    expect(AVISO, 'o ramo final deixou de ser exaustivo').toMatch(/: never = veredito/);
  });

  it('🔴 a tela importa só o módulo PURO — o que importa `db` não vai para o navegador', () => {
    for (const [nome, fonte] of [
      ['formulário', TELA],
      ['aviso', AVISO],
    ] as const) {
      expect(fonte, `${nome} importa o módulo com banco`).not.toMatch(
        /lib\/cadastro\/conferir-identidade/,
      );
    }
    expect(PURO).not.toMatch(/from '@\/lib\/db'|from 'next\/|@clerk\//);
  });
});

const RECONCILIAR = semComentarios(ler('lib/fluxo/reconciliar.ts'));

/** A etapa 1 do formulário: do bloco `subEtapa === 0` até o da etapa 2. */
const ETAPA1 = TELA.slice(
  TELA.indexOf('{subEtapa === 0 && ('),
  TELA.indexOf('{subEtapa === 1 && ('),
);

/** O atributo JSX `nome={…}` de um trecho, com as chaves balanceadas. */
function atributo(trecho: string, nome: string): string {
  const i = trecho.indexOf(`${nome}={`);
  if (i < 0) return '';
  let nivel = 0;
  for (let j = i + nome.length + 1; j < trecho.length; j++) {
    if (trecho[j] === '{') nivel++;
    else if (trecho[j] === '}' && --nivel === 0) return trecho.slice(i, j + 1);
  }
  return '';
}

describe('o "Continuar" da etapa 1 pergunta ao servidor', () => {
  it('🔴 a etapa 1 não avança por conta própria — só pela conferência', () => {
    /**
     * Retificado na revisão de qualidade de 28/09/2026: a versão anterior proibia o literal
     * `onClick={() => setSubEtapa(1)}` e ficava VERDE com `onClick={() => { setSubEtapa(1); }}`.
     * Agora a etapa 1 inteira não pode conter `setSubEtapa(1)` — quem avança é `continuarDaEtapa1`.
     */
    expect(ETAPA1.length).toBeGreaterThan(0);
    expect(ETAPA1).toMatch(/onClick=\{continuarDaEtapa1\}/);
    expect(ETAPA1, 'a etapa 1 voltou a avançar sem conferir').not.toMatch(/setSubEtapa\(1\)/);
  });

  it('🔴 e a conferência vem ANTES do avanço', () => {
    const corpo = corpoDe(TELA, 'continuarDaEtapa1');
    const conferir = corpo.indexOf('conferirIdentidadeNaEtapa1(');
    const avancar = corpo.indexOf('setSubEtapa(1)');
    expect(conferir, 'continuarDaEtapa1 não confere').toBeGreaterThan(-1);
    expect(avancar).toBeGreaterThan(conferir);
  });

  it('⚠️ o foco vai para o que o veredito mudou — o campo do telefone ou o aviso', () => {
    const corpo = corpoDe(TELA, 'continuarDaEtapa1');
    expect(corpo).toMatch(/flushSync\(/);
    expect(corpo).toMatch(/getElementById\('telefone'\)\?\.focus\(\)/);
    expect(corpo).toMatch(/getElementById\('aviso-de-identidade'\)\?\.focus\(\)/);
    expect(AVISO).toMatch(/id="aviso-de-identidade"/);
  });

  it('🔴 o aviso de sessão alheia abre a etapa 1 (DO-60)', () => {
    expect(ETAPA1).toMatch(/\{sessaoEDeOutraPessoa && \(\s*<AvisoDeSessaoAlheia/);
  });
});

describe('o telefone de outra conta trava o campo (DO-68)', () => {
  /**
   * 🔴 EXCEÇÃO DECLARADA à regra de não dizer o que bateu. Decisão de 28/09/2026: _"deve-se ficar
   * bloqueado com aviso na caixa de texto informando que este numero está em uso"_. O CPF continua
   * sem ser revelado; o telefone é revelado **de propósito**, e é isto que este bloco trava — que
   * a exceção fique restrita ao telefone e ao campo dele.
   */
  it('o veredito do telefone é bloqueio, não aviso', () => {
    expect(telefoneEmUso('telefone_conhecido')).toBe(true);
    expect(temAviso('telefone_conhecido')).toBe(false);
    expect(telefoneEmUso('cpf_em_outra_conta')).toBe(false);
  });

  it('🔴 o aviso mora NA caixa do telefone, e o "Continuar" espera a troca do número', () => {
    const campo = TELA.slice(
      TELA.indexOf('id="telefone"'),
      TELA.indexOf('/>', TELA.indexOf('id="telefone"')),
    );
    // A variável na expressão, não a expressão inteira — refactor que não quebra nada não acusa.
    expect(atributo(campo, 'valido')).toMatch(/!telefoneBloqueado/);
    expect(atributo(campo, 'dica')).toMatch(/telefoneBloqueado[\s\S]*TEXTO_DO_TELEFONE_EM_USO/);
    const continuar = ETAPA1.slice(ETAPA1.indexOf('onClick={continuarDaEtapa1}'));
    expect(atributo(continuar, 'disabled')).toMatch(/telefoneBloqueado/);
    // O avanço também recusa — o botão desabilitado não é a única trava.
    expect(corpoDe(TELA, 'continuarDaEtapa1')).toMatch(/!telefoneEmUso\(veredito\)/);
  });

  it('🔴 e quem é dono do número tem SAÍDA: entrar na conta ou falar com o suporte (revisões)', () => {
    const saida = TELA.slice(TELA.indexOf('{telefoneBloqueado && ('));
    const bloco = saida.slice(0, saida.search(/\n\s*\)\}/));
    expect(bloco, 'sumiu a saída do número travado').not.toBe('');
    expect(bloco).toMatch(/\/entrar\?redirect_url=/);
    expect(bloco).toMatch(/linkDoSuporteComProtocolo\(linkDoSuporte, protocolo\)/);
  });

  it('⚠️ a confirmação da Greens abre os campos quando o número precisa ser trocado', () => {
    expect(TELA).toMatch(/\{confirmandoDados && !telefoneBloqueado \? \(/);
  });

  it('⚠️ o aviso do campo chega ao leitor de tela, não é só cor', () => {
    expect(TELA).toMatch(/aria-describedby=\{dica \? `\$\{id\}-dica` : undefined\}/);
    expect(TELA).toMatch(/id=\{`\$\{id\}-dica`\}/);
  });

  it('🔴 a exceção é SÓ do telefone: o texto dele fala de número, e o do CPF continua sem revelar', () => {
    expect(TEXTO_DO_TELEFONE_EM_USO).toMatch(/número está em uso/);
    expect(/\bcpf\b/i.test(TEXTO_DO_TELEFONE_EM_USO)).toBe(false);
    for (const t of [TEXTO_DO_SUPORTE, TEXTO_DE_MUITAS_TENTATIVAS]) {
      expect(/\bcpf\b|em uso|cadastrad/i.test(t), t).toBe(false);
    }
  });
});

describe('com um aviso na tela, a senha não é pedida', () => {
  it('🔴 CPF em outra conta ou e-mail com conta: pedir senha seria pedir dado que não se usa', () => {
    expect(TELA).toMatch(/\) : avisoDaEtapa1 \? null : \(\s*<Secao titulo="Crie sua senha"/);
  });
});

describe('sair da conta não sai da página', () => {
  it('🔴 existe UM `signOut(` na tela, e ele fica na página e sai só da sessão ativa', () => {
    const chamadas = [...TELA.matchAll(/signOut\(/g)];
    expect(chamadas.length, 'mais de um jeito de sair — um deles vai navegar').toBe(1);
    expect(TELA).toMatch(/signOut\(FICAR_NESTA_PAGINA, sessionId \? \{ sessionId \} : undefined\)/);
    // O callback é o que impede a navegação: tem de ser uma FUNÇÃO que não navega.
    expect(TELA).toMatch(/const FICAR_NESTA_PAGINA = \(\) => \{\};/);
  });

  it('🔴 e todo lugar que sai usa esse caminho', () => {
    for (const funcao of ['criarConta', 'confirmarCodigo']) {
      expect(corpoDe(TELA, funcao), `${funcao} não sai pelo caminho da página`).toMatch(
        /await sairDaSessao\(\)/,
      );
    }
  });
});

describe('o servidor confere de novo, e a conferência tem trava', () => {
  it('🔴 a action final confere CPF e depois telefone, ANTES de qualquer escrita', () => {
    const cpf = ACTION_FINAL.indexOf('cpfEstaEmOutraConta(');
    const fone = ACTION_FINAL.indexOf('telefoneEstaEmOutraConta(');
    expect(cpf, 'a action final não confere o CPF').toBeGreaterThan(-1);
    expect(fone, 'a action final não confere o telefone depois do CPF').toBeGreaterThan(cpf);
    for (const escrita of ['.update(solicitacoesCadastro)', 'dbTransacional().transaction(']) {
      expect(ACTION_FINAL.indexOf(escrita), `${escrita} vem antes da conferência`).toBeGreaterThan(
        fone,
      );
    }
    const recusa = ACTION_FINAL.slice(fone, ACTION_FINAL.indexOf('dbTransacional().transaction('));
    expect(recusa).toMatch(/TEXTO_DO_SUPORTE/);
    expect(recusa).toMatch(/TEXTO_DO_TELEFONE_EM_USO/);
  });

  it('🔴 e as RECUSAS da action final têm limite — senão ela é oráculo sem teto (revisão de segurança)', () => {
    const recusa = ACTION_FINAL.slice(ACTION_FINAL.indexOf('if (recusa) {'));
    // Regex e não literal: a formatação quebra a chamada em linhas, e o guarda media a quebra.
    const limite = recusa.search(/dentroDoLimiteDaConferencia\(\s*'identidade-envio'/);
    const muitas = recusa.indexOf('if (!dentro) return falha(TEXTO_DE_MUITAS_TENTATIVAS)');
    const especifica = recusa.indexOf('TEXTO_DO_SUPORTE');
    expect(limite, 'a recusa não consome o limite').toBeGreaterThan(-1);
    expect(muitas, 'estourado, a recusa continua dizendo o motivo').toBeGreaterThan(limite);
    expect(especifica, 'o motivo aparece antes de conferir o limite').toBeGreaterThan(muitas);
  });

  it('🔴 a transação acha o e-mail sem diferenciar maiúsculas — a mesma regra da conferência', () => {
    const transacao = ACTION_FINAL.slice(ACTION_FINAL.indexOf('dbTransacional().transaction('));
    expect(transacao).toMatch(/lower\(\$\{users\.email\}\) = \$\{emailConfirmado\}/);
    expect(transacao, 'voltou a busca exata').not.toMatch(/eq\(users\.email, emailConfirmado\)/);
  });

  it('🔴 o LOGIN não recria a ficha duplicada: a reconciliação confere o CPF antes de gravar (revisão de backend)', () => {
    const corpo = corpoDe(RECONCILIAR, 'reconciliarPelaSessao');
    const confere = corpo.indexOf('cpfEstaEmOutraConta(');
    expect(confere, 'a reconciliação não confere o CPF').toBeGreaterThan(-1);
    for (const escrita of ['db.update(pacientes)', 'materializarDocumentosDoParceiro(']) {
      expect(corpo.indexOf(escrita), `${escrita} vem antes da conferência`).toBeGreaterThan(
        confere,
      );
    }
    expect(corpo.slice(confere, confere + 200)).toMatch(/porque: 'cpf_em_outra_conta'/);
  });

  it('🔴 a referência do CPF e do telefone é o e-mail do LINK, nunca o digitado', () => {
    for (const [nome, fonte] of [
      ['página', PAGINA],
      ['action da etapa 1', ACTION_DA_ETAPA],
    ] as const) {
      expect(fonte, `${nome} não passa o e-mail do link`).toMatch(
        /emailDoLink: (resultado|solicitacao)\.email/,
      );
    }
    expect(PURO).toMatch(/achados\.contaDoEmailDoLink/);
  });

  it('🔴 a action da etapa 1: token, depois limite, depois a consulta', () => {
    const corpo = corpoDe(ACTION_DA_ETAPA, 'conferirIdentidadeNaEtapa1');
    const token = corpo.indexOf('validarTokenDeCadastro(');
    const limite = corpo.indexOf('dentroDoLimiteDaConferencia(');
    const consulta = corpo.indexOf('conferirIdentidade(');
    expect(token).toBeGreaterThan(-1);
    expect(limite).toBeGreaterThan(token);
    expect(consulta).toBeGreaterThan(limite);
    expect(corpo, 'o que não é livre deixou de ser auditado').toMatch(
      /if \(veredito !== 'livre'\)[\s\S]*auditar\(/,
    );
  });

  it('🔴 o limite é ALCANÇÁVEL: duas janelas com teto finito, e consumidas de fato', () => {
    const porSolicitacao = Number(PURO.match(/LIMITE_POR_SOLICITACAO = (\d+)/)?.[1]);
    const porIp = Number(PURO.match(/LIMITE_POR_IP = (\d+)/)?.[1]);
    expect(porSolicitacao).toBeGreaterThan(0);
    expect(porSolicitacao).toBeLessThanOrEqual(10);
    expect(porIp).toBeGreaterThan(porSolicitacao);
    const corpo = corpoDe(CONSULTA, 'dentroDoLimiteDaConferencia');
    expect(corpo).toMatch(/consumir\([\s\S]*LIMITE_POR_SOLICITACAO/);
    expect(corpo).toMatch(/consumir\([\s\S]*LIMITE_POR_IP/);
    expect(corpo).toMatch(/return porSolicitacao\.permitido && porIp\.permitido/);
  });

  it("🔴 o arquivo 'use server' exporta SÓ função assíncrona — o build recusa o resto", () => {
    /**
     * Achado pelo `pnpm build` em 28/09/2026: a action exportava `LIMITE_POR_SOLICITACAO`, e o
     * Turbopack respondeu _"Only async functions are allowed to be exported in a 'use server'
     * file"_. Type-check e testes passavam — só o build acusava. As constantes moram no módulo
     * puro desde então. E a função de limite mora no `lib`: exportada daqui, viraria endpoint.
     */
    expect(ACTION_DA_ETAPA).toMatch(/^'use server';/);
    const exportados = [...ACTION_DA_ETAPA.matchAll(/^export\s+(.*)$/gm)].map((m) => m[1]);
    expect(exportados.length).toBeGreaterThan(0);
    for (const e of exportados)
      expect(e, `export que não é função assíncrona: ${e}`).toMatch(/^async function /);
  });

  it('⚠️ a chave do limite é o id da solicitação, nunca dado pessoal', () => {
    expect(CONSULTA).toMatch(/`\$\{prefixo\}:sol:\$\{solicitacaoId\}`/);
  });

  it('🔴 a página confere ao abrir, passa só o veredito, e audita só o que a tela mostra', () => {
    expect(PAGINA).toMatch(/const vereditoInicial = await conferirIdentidade\(/);
    expect(PAGINA).toMatch(/vereditoInicial=\{vereditoInicial\}/);
    expect(PAGINA).toMatch(
      /if \(temAviso\(vereditoInicial\) \|\| telefoneEmUso\(vereditoInicial\)\)/,
    );
  });
});
