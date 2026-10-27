/**
 * GUARDA — o paciente cadastrado pela equipe tem login, e a entrada sem código é individual e não vaza.
 *
 * 🔴 DOIS DEFEITOS, UMA FAMÍLIA (27/10/2026)
 *
 * 1. `criarPaciente` gravava `users` sem `clerk_id` e nunca chamava o Clerk. O paciente aparecia na
 *    tela de usuários e, ao entrar, recebia "não foi possível encontrar o usuário". O banco estava
 *    certo; quem autentica é o Clerk. E o e-mail era gravado como digitado: o Clerk guarda em
 *    minúsculas e o webhook `user.created` procura por igualdade exata — "Maria@x.com" viraria um
 *    SEGUNDO usuário e uma SEGUNDA ficha no primeiro login.
 * 2. Pacientes idosos não conseguem digitar o código do e-mail. O Clerk só desliga isso para a
 *    instância inteira, então a exceção é nossa — e uma exceção de autenticação feita à mão é
 *    exatamente onde se erra: flag que um usuário consegue escrever, mensagem que revela quem tem a
 *    exceção, senha em log, limite esquecido.
 *
 * Estes casos derivam do CÓDIGO (não de listas), e a integração
 * `__tests__/integracao/o-paciente-cadastrado-pela-equipe-entra.test.ts` executa o comportamento.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ALFABETO_DA_SENHA,
  CHAVE_LOGIN_SIMPLIFICADO,
  gerarSenhaLegivel,
  senhaDoPacienteSchema,
  temLoginSimplificado,
} from '@/lib/auth/login-simplificado';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

/** Remove comentários: um guarda que lê comentário aprova o que o código não faz. */
const semComentarios = (codigo: string) =>
  codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** Os argumentos de um console.*, sem o texto da mensagem (o texto é livre; o que vaza são os valores). */
const argumentosDoLog = (log: string) =>
  log.replace(/^console\.\w+\(\s*(['"`])(?:\\.|(?!\1)[\s\S])*\1\s*,?/, '');

const ENTRADA = 'app/_actions/entrar-so-com-senha.ts';
const ACOES = 'app/_actions/acesso-do-paciente.ts';
const CONTA = 'lib/pacientes/conta-de-acesso.ts';
const PACIENTES = 'app/_actions/pacientes.ts';
const FORMULARIO = 'components/auth/formulario-de-entrada.tsx';
const PAGINA_DE_LOGIN = 'app/(auth)/entrar/[[...sign-in]]/page.tsx';

const entrada = semComentarios(ler(ENTRADA));
const acoes = semComentarios(ler(ACOES));
const conta = semComentarios(ler(CONTA));

/** O corpo de cada `export async function` de um arquivo, por nome. */
function funcoesExportadas(codigo: string): Map<string, string> {
  const achados = [...codigo.matchAll(/export async function (\w+)\s*\(/g)];
  const mapa = new Map<string, string>();
  achados.forEach((m, i) => {
    mapa.set(m[1], codigo.slice(m.index!, achados[i + 1]?.index ?? codigo.length));
  });
  return mapa;
}

describe('1. o paciente cadastrado pela equipe ganha login (a causa do "usuário não encontrado")', () => {
  const pacientes = semComentarios(ler(PACIENTES));
  const criar = pacientes.slice(
    pacientes.indexOf('export async function criarPaciente('),
    pacientes.indexOf('export async function atualizarPaciente('),
  );

  it('vacuidade: o trecho de criarPaciente foi achado', () => {
    expect(criar.length).toBeGreaterThan(500);
  });

  it('criarPaciente garante a conta de acesso e não depende dela para gravar a ficha', () => {
    expect(criar).toContain('garantirContaDeAcesso(');
    // a ficha é gravada ANTES: a falha do Clerk não pode desfazer o cadastro
    expect(criar.indexOf('insert(pacientes)')).toBeLessThan(
      criar.indexOf('garantirContaDeAcesso('),
    );
    expect(criar).toMatch(/garantirContaDeAcesso\([^)]*\)\s*\.catch\(/);
  });

  it('criarPaciente grava e procura o e-mail normalizado (o webhook casa por igualdade exata)', () => {
    expect(criar).toContain('normalizarEmail(d.email)');
    expect(criar).toMatch(/lower\(\$\{users\.email\}\) = \$\{email\}/);
    expect(criar).not.toMatch(/email:\s*d\.email/);
    expect(criar).not.toMatch(/eq\(users\.email,\s*d\.email\)/);
  });

  it('a conta é criada SEM senha e a ordem evita duplicar: minúsculas → Clerk → vínculo condicional', () => {
    const createUser = conta.slice(
      conta.indexOf('createUser({'),
      conta.indexOf('createUser({') + 400,
    );
    expect(createUser).toContain('skipPasswordRequirement: true');
    expect(createUser).not.toMatch(/password\s*:/);

    const iMinusculas = conta.indexOf('.set({ email })');
    const iClerk = conta.indexOf('clerkClient()');
    const iVinculo = conta.indexOf('.set({ clerkId: criado.id })');
    expect(iMinusculas).toBeGreaterThan(-1);
    expect(iMinusculas).toBeLessThan(iClerk);
    expect(iClerk).toBeLessThan(iVinculo);
  });

  it('todo UPDATE de clerk_id é condicionado a clerk_id IS NULL (o webhook pode chegar primeiro)', () => {
    const updates = [...conta.matchAll(/\.set\(\{ clerkId: [^}]+\}\)[\s\S]{0,120}?\.returning/g)];
    expect(updates.length).toBe(2); // religar e criar
    for (const u of updates) expect(u[0]).toContain('isNull(users.clerkId)');
  });

  it('se o banco falhar depois de criar o login, o login é desfeito (sem órfão no Clerk)', () => {
    expect(conta).toMatch(/deleteUser\(criado\.id\)/);
  });

  it('só PACIENTE com ficha ATIVA ganha acesso; login de outro papel não é tocado', () => {
    expect(conta).toContain("u.role !== 'paciente'");
    expect(conta).toMatch(/isNull\(pacientes\.deletedAt\)/);
    expect(conta).toContain("papelNoClerk !== 'paciente'");
  });

  it('nenhum log da conta carrega e-mail', () => {
    const logs = [...conta.matchAll(/console\.(?:error|warn|log)\([\s\S]*?\);/g)].map((m) => m[0]);
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) expect(argumentosDoLog(l)).not.toMatch(/\bemail\b/);
  });
});

describe('2. as ações do admin', () => {
  const fns = funcoesExportadas(acoes);

  it('vacuidade: as cinco ações existem', () => {
    expect([...fns.keys()].sort()).toEqual(
      [
        'alterarLoginSimplificado',
        'consultarAcessoDoUsuario',
        'contarAcessosPendentes',
        'criarAcessoDoUsuario',
        'criarAcessosPendentes',
        'definirSenhaDoPaciente',
      ].sort(),
    );
  });

  it.each([...fns.entries()])(
    '%s confere ADMIN no servidor antes de qualquer coisa',
    (_nome, corpo) => {
      expect(corpo).toContain('verificarAdmin()');
      // antes do primeiro efeito: banco, o auxiliar que lê o banco, ou o Clerk
      const primeiroEfeito = corpo.search(
        /\bdb\b|alvoPaciente\(|garantirContaDeAcesso\(|clerkClient\(/,
      );
      expect(primeiroEfeito).toBeGreaterThan(-1);
      expect(corpo.indexOf('verificarAdmin()')).toBeLessThan(primeiroEfeito);
    },
  );

  it('a senha: validada pelo schema, sem pular a política do Clerk, derrubando outras sessões', () => {
    expect(acoes).toContain('senhaDoPacienteSchema.safeParse(senha)');
    expect(acoes).not.toContain('skipPasswordChecks');
    expect(acoes).toContain('signOutOfOtherSessions: true');
  });

  it('a senha nunca entra em auditoria, log ou resposta', () => {
    for (const bloco of acoes.matchAll(/dadosDepois[^}]*}|auditar\([^;]*\);/g)) {
      expect(bloco[0]).not.toMatch(/\bsenha\s*[:,}]/);
    }
    for (const log of acoes.matchAll(/console\.(?:error|warn|log)\([\s\S]*?\);/g)) {
      expect(argumentosDoLog(log[0])).not.toMatch(/\b(senha|password|email)\b/i);
    }
    // nenhum objeto devolvido tem uma CHAVE `senha`/`password` (o texto de uma mensagem pode citar a palavra)
    expect(acoes).not.toMatch(/return\s*\{[^}]*\b(senha|password)\s*:/);
  });

  it('o flag mora em privateMetadata (nunca no que o cliente lê) e só em paciente', () => {
    expect(acoes).toContain('privateMetadata: { [CHAVE_LOGIN_SIMPLIFICADO]');
    expect(acoes).not.toMatch(
      /publicMetadata:\s*\{\s*\[?CHAVE_LOGIN_SIMPLIFICADO|publicMetadata:\s*\{\s*loginSimplificado/,
    );
    const flag = fns.get('alterarLoginSimplificado')!;
    expect(flag).toContain("u.role !== 'paciente'");
    expect(flag).toContain('passwordEnabled'); // só liga com senha definida
  });

  it('o lote é limitado (cada paciente custa chamadas ao Clerk)', () => {
    expect(acoes).toMatch(/TAMANHO_DO_LOTE\s*=\s*\d+/);
    expect(acoes).toContain('.limit(TAMANHO_DO_LOTE)');
  });
});

describe('3. a entrada sem código', () => {
  const ordem = (...trechos: string[]) => {
    const posicoes = trechos.map((t) => entrada.indexOf(t));
    posicoes.forEach((p, i) => expect(p, `falta: ${trechos[i]}`).toBeGreaterThan(-1));
    for (let i = 1; i < posicoes.length; i++) {
      expect(posicoes[i], `${trechos[i]} deveria vir depois de ${trechos[i - 1]}`).toBeGreaterThan(
        posicoes[i - 1],
      );
    }
  };

  it('a ordem de defesa: entrada válida → limite → banco → Clerk (flag) → senha → ticket', () => {
    ordem(
      'entradaSemCodigoSchema.safeParse',
      'consumir(',
      'db\n      .select',
      'clerkClient()',
      'temLoginSimplificado(c.privateMetadata)',
      'verifyPassword(',
      'createSignInToken(',
    );
  });

  it('há limite por ORIGEM e por E-MAIL, e a chave não guarda o e-mail', () => {
    expect([...entrada.matchAll(/consumir\(/g)]).toHaveLength(2);
    // as constantes são USADAS como argumento, não só citadas...
    expect(entrada).toMatch(
      /consumir\(\s*chaveDoEmail\(email\),\s*LIMITE_POR_EMAIL\.tentativas,\s*LIMITE_POR_EMAIL\.janelaEmSegundos\s*,?\s*\)/,
    );
    expect(entrada).toMatch(
      /consumir\(\s*identificarChamador\([\s\S]*?\),\s*LIMITE_POR_ORIGEM\.tentativas,\s*LIMITE_POR_ORIGEM\.janelaEmSegundos\s*,?\s*\)/,
    );
    expect(entrada).toContain("createHash('sha256')");
    // ...e valem pouco: um teto alto desfaz o limite (força bruta de uma senha que é o ÚNICO fator)
    const lib = ler('lib/auth/login-simplificado.ts');
    const teto = (nome: string) =>
      Number(lib.match(new RegExp(`${nome}\\s*=\\s*\\{\\s*tentativas:\\s*(\\d+)`))?.[1]);
    expect(teto('LIMITE_POR_EMAIL')).toBeGreaterThan(0);
    expect(teto('LIMITE_POR_EMAIL')).toBeLessThanOrEqual(10);
    expect(teto('LIMITE_POR_ORIGEM')).toBeGreaterThan(0);
    expect(teto('LIMITE_POR_ORIGEM')).toBeLessThanOrEqual(50);
  });

  it('o ticket vive 60 s (a constante, não um número solto)', () => {
    expect(entrada).toContain('expiresInSeconds: VALIDADE_DO_TICKET_EM_SEGUNDOS');
    const m = ler('lib/auth/login-simplificado.ts').match(
      /VALIDADE_DO_TICKET_EM_SEGUNDOS\s*=\s*(\d+)/,
    );
    expect(Number(m?.[1])).toBeLessThanOrEqual(60);
  });

  it('TODA recusa usa a MESMA mensagem: não há outro texto de erro (sem oráculo de quem tem a exceção)', () => {
    const erros = entrada
      .split('\n')
      .filter((l) => l.includes('sucesso: false,'))
      .flatMap((l) => [...l.matchAll(/erro:\s*([^}\n,]+)/g)].map((m) => m[1].trim()));
    expect(erros.length).toBeGreaterThan(0);
    for (const e of erros)
      expect(e).toMatch(/^(MENSAGEM_MUITAS_TENTATIVAS|MENSAGEM_ENTRADA_RECUSADA)$/);
    // `recusada` é o único retorno de falha fora do limite
    expect(entrada).toMatch(
      /const recusada[^=]*=\s*\{\s*sucesso:\s*false,\s*erro:\s*MENSAGEM_ENTRADA_RECUSADA/,
    );
  });

  it('só PACIENTE sem banimento nem bloqueio, com senha e o flag LITERAL true', () => {
    expect(entrada).toContain("u.role !== 'paciente'");
    expect(entrada).toContain('c.banned');
    expect(entrada).toContain('c.locked');
    expect(entrada).toContain('!c.passwordEnabled');
    expect(entrada).toContain("papelNoClerk !== 'paciente'");
    expect(entrada).toMatch(/isNull\(users\.deletedAt\)/);
  });

  it('nenhum log carrega e-mail, senha ou o erro inteiro do Clerk', () => {
    const logs = [...entrada.matchAll(/console\.(?:error|warn|log)\([\s\S]*?\);/g)].map(
      (m) => m[0],
    );
    expect(logs.length).toBeGreaterThan(3);
    for (const l of logs) {
      expect(argumentosDoLog(l)).not.toMatch(/\b(email|senha|password)\b/i);
      expect(l).not.toMatch(/,\s*(error|erro|e)\s*\)/); // `console.error('…', error)` despeja o erro todo
    }
  });

  it('a rota é pública no middleware (quem entra ainda não tem sessão)', () => {
    expect(semComentarios(ler('middleware.ts'))).toContain("'/entrar(.*)'");
  });

  it('o formulário troca o ticket por sessão e a senha não fica no estado depois de entrar', () => {
    const form = semComentarios(ler(FORMULARIO));
    expect(form).toContain("strategy: 'ticket'");
    expect(form).toContain('entrarSemCodigo(');
    expect(form).toMatch(/setSenha\(''\)/);
  });

  it('é a tela OFICIAL (/entrar) que decide: o formulário nosso na raiz, o widget do Clerk nas etapas dele', () => {
    const pagina = semComentarios(ler(PAGINA_DE_LOGIN));
    // o formulário é RENDERIZADO (não só importado) e recebe o destino já filtrado
    expect(pagina).toMatch(/<FormularioDeEntrada\b[\s\S]*?destino=\{redirectUrl\}/);
    expect(pagina).toContain('destinoInternoSeguro(');
    // subcaminho do Clerk (factor-two, sso-callback, reset-password) segue com o widget
    expect(pagina).toMatch(/useParams/);
    expect(pagina).toMatch(/<SignIn\b/);
    // não nasce uma segunda tela de login
    expect(existsSync(path.join(raiz, 'app/(auth)/entrar/senha'))).toBe(false);
  });

  it('quem não foi liberado segue o fluxo NORMAL do Clerk: a recusa não bloqueia nem muda a mensagem', () => {
    const form = semComentarios(ler(FORMULARIO));
    const iTicket = form.indexOf("strategy: 'ticket'");
    const iNormal = form.indexOf('password: senha');
    expect(iTicket).toBeGreaterThan(-1);
    // o ticket vem ANTES, e a senha vai ao Clerk logo depois da recusa
    expect(iNormal).toBeGreaterThan(iTicket);
    // o código por e-mail continua existindo para quem o Clerk exige (dispositivo novo)
    expect(form).toContain("strategy: 'email_code'");
    expect(form).toContain('needs_client_trust');
    expect(form).toContain('needs_second_factor');
    // o ticket só vale com sessão completa: nunca se "assume" sucesso
    expect(form).toMatch(/status === 'complete'/);
  });

  it('o reenvio do código dá retorno e limpa o campo (a-confirmacao-do-email-nao-e-beco)', () => {
    const form = semComentarios(ler(FORMULARIO));
    const inicio = form.indexOf('async function reenviar');
    expect(inicio).toBeGreaterThan(-1);
    // só o corpo do reenvio: até a próxima função, senão um `setAviso('')` de outra a satisfaz
    const reenviar = form.slice(inicio, form.indexOf('function voltar', inicio));
    expect(reenviar).toContain('setCodigo(');
    // o retorno tem TEXTO: `setAviso('')` limpa, não avisa
    expect(reenviar).toMatch(/setAviso\(\s*(['"`])[^'"`]+\1/);
  });
});

describe('4. as regras puras', () => {
  it('só o literal true libera: string, número e objeto vazio não', () => {
    expect(temLoginSimplificado({ [CHAVE_LOGIN_SIMPLIFICADO]: true })).toBe(true);
    for (const v of ['true', 1, 'sim', {}, [], null, undefined]) {
      expect(temLoginSimplificado({ [CHAVE_LOGIN_SIMPLIFICADO]: v })).toBe(false);
    }
    expect(temLoginSimplificado(undefined)).toBe(false);
    expect(temLoginSimplificado(null)).toBe(false);
    expect(temLoginSimplificado('loginSimplificado')).toBe(false);
  });

  it('a política recusa o que é fraco e aceita o que a tela gera', () => {
    for (const fraca of ['', 'curta1', 'semnumeroaqui', '1234567890', 'a'.repeat(73) + '1']) {
      expect(senhaDoPacienteSchema.safeParse(fraca).success, fraca).toBe(false);
    }
    expect(senhaDoPacienteSchema.safeParse('Segura1234x').success).toBe(true);
  });

  const deBytes = (...sequencia: number[]) => {
    let i = 0;
    return (n: number) => Uint8Array.from({ length: n }, () => sequencia[i++ % sequencia.length]);
  };

  it('a senha gerada tem o tamanho, o alfabeto sem ambiguidade e sempre passa na política', () => {
    // 2.000 senhas com bytes pseudoaleatórios determinísticos (LCG)
    let x = 12345;
    const lcg = (n: number) =>
      Uint8Array.from({ length: n }, () => {
        x = (x * 1664525 + 1013904223) >>> 0;
        return x >>> 24;
      });
    for (let i = 0; i < 2000; i++) {
      const s = gerarSenhaLegivel(lcg);
      expect(s).toHaveLength(10);
      expect([...s].every((c) => ALFABETO_DA_SENHA.includes(c))).toBe(true);
      expect(senhaDoPacienteSchema.safeParse(s).success, s).toBe(true);
    }
    expect(ALFABETO_DA_SENHA).not.toMatch(/[01ilo]/);
  });

  it('mesmo com bytes que dariam só letras, ou só dígitos, a senha sai com letra E número', () => {
    // byte 0 → 'a' (só letras); byte 23 → '2' (só dígitos): a correção troca uma posição
    const soLetras = gerarSenhaLegivel(deBytes(0));
    expect(soLetras).toMatch(/[0-9]/);
    expect(soLetras).toMatch(/[a-z]/);
    const soDigitos = gerarSenhaLegivel(deBytes(23, 24, 25, 26, 27, 28, 29, 30));
    expect(soDigitos).toMatch(/[0-9]/);
    expect(soDigitos).toMatch(/[a-z]/);
  });

  it('amostragem por rejeição: bytes acima do teto são descartados, não dobrados (sem viés)', () => {
    // teto = 256 - (256 % 31) = 248. O byte 255 NÃO pode virar símbolo; sem ele, só sobra o 0.
    // Sem a rejeição, 255 % 31 = 7 viraria 'h'. Com ela, só o byte 0 ('a') é usado.
    const s = gerarSenhaLegivel(deBytes(255, 255, 0));
    expect(s.length).toBe(10);
    expect([...s].every((c) => ALFABETO_DA_SENHA.includes(c))).toBe(true);
    expect(s).not.toContain('h');
    expect(ALFABETO_DA_SENHA[255 % ALFABETO_DA_SENHA.length]).toBe('h'); // a premissa do caso
  });
});
