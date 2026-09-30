/**
 * GUARDA — a chamada de atendimento não grava, não vaza e só tem duas pessoas (ADR-0029 §10).
 *
 * Quebra o build se:
 *   1. aparecer gravação (`MediaRecorder`) ou transcrição no código da chamada (D-19);
 *   2. uma porta da chamada (rota, action) agir ANTES de conferir quem está na sala (D-14);
 *   3. o limite de requisição sair de antes do escopo nas rotas;
 *   4. o print deixar de ir ao store privado, deixar de conferir tipo e assinatura, ou a URL do blob
 *      passar a sair do servidor — na resposta ou no evento do Pusher (D-18);
 *   5. a entrega do print perder o 404 uniforme, a auditoria antes de entregar, ou o `no-store`;
 *   6. a imagem do print passar a carregar sozinha (auditoria falsa de "visualizou");
 *   7. a sala voltar a ser previsível (`Math.random`), ou o prefixo do canal ser escrito fora do
 *      módulo único (o `/api/pusher/auth` nega o que não reconhece, e prefixo duplicado diverge);
 *   8. o botão de mostrar a tela aparecer onde o navegador não deixa (D-16).
 *
 * O que ele NÃO prova: que o fluxo roda. Isso é a integração
 * `a-chamada-de-atendimento-so-tem-duas-pessoas` (banco real) e a prova no Chromium da negociação
 * (`scripts/provar-chamada-no-navegador/`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { semComentarios } from './_apoio/codigo';

const RAIZ = process.cwd();
const ler = (p: string) => semComentarios(readFileSync(join(RAIZ, p), 'utf8'));

function arquivos(dir: string): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(RAIZ, p)).isDirectory() ? arquivos(p) : [p];
  });
}

const CODIGO_DA_CHAMADA = [
  ...arquivos('components/atendimento'),
  ...arquivos('lib/atendimento'),
  ...arquivos('app/api/atendimento'),
  'app/_actions/chamada-de-atendimento.ts',
  'lib/auth/escopo-chamada.ts',
];

const ACTIONS = ler('app/_actions/chamada-de-atendimento.ts');
const SINALIZAR = ler('app/api/atendimento/sinalizar/route.ts');
const ICE = ler('app/api/atendimento/ice-servers/route.ts');
const PRINT = ler('app/api/atendimento/print/[mensagemId]/route.ts');
const CHAT = ler('components/atendimento/ChatDoAtendimento.tsx');
const TELA = ler('components/atendimento/ChamadaDeAtendimento.tsx');
const PUSHER_AUTH = ler('app/api/pusher/auth/route.ts');

function corpoDe(fonte: string, nome: string): string {
  const i = fonte.search(new RegExp(`function ${nome}\\s*\\(`));
  if (i < 0) return '';
  const abre = fonte.indexOf(' {\n', fonte.indexOf(')', i)) + 1;
  let nivel = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === '{') nivel++;
    else if (fonte[j] === '}' && --nivel === 0) return fonte.slice(abre, j + 1);
  }
  return '';
}

describe('nada é gravado (D-19)', () => {
  it('vacuidade: a varredura acha o código da chamada', () => {
    expect(CODIGO_DA_CHAMADA.length).toBeGreaterThanOrEqual(8);
  });

  it.each(CODIGO_DA_CHAMADA)('%s não grava nem transcreve', (arquivo) => {
    const fonte = ler(arquivo);
    expect(fonte).not.toMatch(/\bMediaRecorder\b/);
    expect(fonte).not.toMatch(/transcrev/i);
  });
});

describe('o escopo vem antes de qualquer efeito (D-14)', () => {
  it.each<[string, string, RegExp]>([
    ['sinalizar', SINALIZAR, /\.trigger\(/],
    ['TURN', ICE, /gerarCredencialTurn\(\)/],
    ['print', PRINT, /lerDocumentoPrivado\(/],
  ])('rota %s: limite, depois escopo, depois o efeito', (_n, fonte, efeito) => {
    const limite = fonte.search(/consumir\(/);
    const escopo = fonte.search(/garantirParticipanteDaChamada\(/);
    const acao = fonte.search(efeito);
    expect(limite).toBeGreaterThanOrEqual(0);
    expect(escopo).toBeGreaterThan(limite);
    expect(acao).toBeGreaterThan(escopo);
  });

  it.each([
    'entrarNoAtendimento',
    'enviarMensagemNoAtendimento',
    'enviarPrintNoAtendimento',
    'encerrarAtendimento',
  ])('action %s confere o escopo antes de tocar o banco', (nome) => {
    const corpo = corpoDe(ACTIONS, nome);
    expect(corpo.length).toBeGreaterThan(0);
    const escopo = corpo.search(/garantir(AcessoAoPedido|ParticipanteDaChamada)\(/);
    const banco = corpo.search(/\bdb\s*\.\s*(insert|update|delete)\(/);
    expect(escopo).toBeGreaterThanOrEqual(0);
    if (banco >= 0) expect(banco).toBeGreaterThan(escopo);
  });

  it('encerrar é do admin', () => {
    expect(corpoDe(ACTIONS, 'encerrarAtendimento')).toMatch(/escopo\.papel !== 'admin'/);
  });

  it('o canal Pusher da chamada autoriza pela mesma função de escopo, e sem dado pessoal', () => {
    const ramo = PUSHER_AUTH.slice(PUSHER_AUTH.indexOf('canal.startsWith(PREFIXO_DO_CANAL)'));
    expect(ramo.slice(0, 900)).toMatch(/garantirParticipanteDaChamada\(\{ sala \}\)/);
    expect(ramo.slice(0, 900)).toMatch(/user_info: \{ papel: escopo\.papel \}/);
  });
});

describe('o print (D-18)', () => {
  const enviar = corpoDe(ACTIONS, 'enviarPrintNoAtendimento');

  it('vai ao store privado, nunca por put direto', () => {
    expect(enviar).toMatch(/guardarDocumentoPrivado\(/);
    expect(ACTIONS).not.toMatch(/\bput\(|access:\s*'public'|@vercel\/blob/);
  });

  it('confere tipo, tamanho e a assinatura do arquivo, antes de subir', () => {
    const subir = enviar.search(/guardarDocumentoPrivado\(/);
    for (const conferencia of [
      /TIPOS_DE_PRINT\[/,
      /TAMANHO_MAXIMO_DO_PRINT/,
      /assinaturaConfere\(/,
    ]) {
      const i = enviar.search(conferencia);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(subir);
    }
  });

  it('a mensagem que sai do servidor não tem a URL: paraTela não a copia', () => {
    const paraTela = corpoDe(ACTIONS, 'paraTela');
    expect(paraTela).toMatch(/temPrint: m\.printUrl !== null/);
    expect(paraTela).not.toMatch(/printUrl:/);
    expect(ACTIONS).toMatch(/avisarNaSala\([^)]*'chat:mensagem', \{ \.\.\.naTela \}\)/);
  });

  it('a entrega: 404 uniforme, auditoria ANTES de ler, só store privado, sem cache', () => {
    const audita = PRINT.search(/acao: 'visualizar'/);
    const le = PRINT.search(/lerDocumentoPrivado\(/);
    expect(audita).toBeGreaterThanOrEqual(0);
    expect(le).toBeGreaterThan(audita);
    expect(PRINT).toMatch(/ehDoStorePrivado\(/);
    expect(PRINT).toMatch(/'cache-control': 'private, no-store'/);
    expect(PRINT).not.toMatch(/status: 403/);
  });

  it('a imagem só é buscada quando alguém clica para ver', () => {
    const print = corpoDe(CHAT, 'Print');
    const fechado = print.indexOf('if (!aberto)');
    const imagem = print.indexOf('/api/atendimento/print/');
    expect(fechado).toBeGreaterThanOrEqual(0);
    expect(imagem).toBeGreaterThan(fechado);
  });
});

describe('a sala e o canal (D-13, D-14)', () => {
  it('a sala sai do gerador criptográfico, nunca de Math.random', () => {
    expect(corpoDe(ACTIONS, 'entrarNoAtendimento')).toMatch(/crypto\.randomUUID\(\)/);
    for (const arquivo of CODIGO_DA_CHAMADA) expect(ler(arquivo)).not.toMatch(/Math\.random/);
  });

  it('o prefixo do canal é escrito num lugar só', () => {
    const comLiteral = CODIGO_DA_CHAMADA.filter(
      (a) => a !== 'lib/atendimento/canal.ts' && /presence-atendimento-/.test(ler(a)),
    );
    expect({ comLiteral }).toEqual({ comLiteral: [] });
    expect(PUSHER_AUTH).not.toMatch(/'presence-atendimento-'/);
  });
});

describe('a tela (D-16, D-19)', () => {
  it('o botão de mostrar a tela depende do navegador deixar', () => {
    expect(TELA).toMatch(/podeCompartilharTela\(\)/);
    expect(TELA).toMatch(/\{podeMostrarTela &&/);
  });

  it('o aviso vem antes do compartilhamento, e diz que nada é gravado', () => {
    expect(TELA).toMatch(/setAvisoDeTela\(true\)/);
    expect(TELA).toMatch(/Nada é gravado/);
    expect(TELA).toMatch(/Não mostre\s+senhas/);
  });
});

describe('a revisão de 30/09/2026 — o que ela achou não volta', () => {
  const ENCERRAR_PEDIDO = ler('lib/anvisa/encerrar-pedido-de-atendimento.ts');

  it('resposta e candidato de OUTRA negociação são ignorados, e a resposta fora de hora não derruba', () => {
    expect(TELA).toMatch(
      /dados\.negociacao !== negociacao \|\| pc\.current\.signalingState !== 'have-local-offer'/,
    );
    expect(TELA).toMatch(/!dados\.candidato \|\| dados\.negociacao !== negociacao/);
    expect(TELA).toMatch(/sinalizar\('offer', \{ \.\.\.oferta, negociacao \}\)/);
  });

  it('a aba repetida (mesmo papel já presente) não oferece nem responde', () => {
    expect(TELA).toMatch(
      /m\.id !== membros\.me\?\.id && m\.info\?\.papel === papelAtual\) repetida = true/,
    );
    expect(TELA).toMatch(/if \(repetida\) return;/);
  });

  it('o microfone é parado se a pessoa saiu durante a permissão, e ao encerrar', () => {
    expect(TELA).toMatch(
      /if \(!ativo\) \{\s*fluxo\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/,
    );
    const encerrada = TELA.slice(TELA.indexOf("ch.bind('chamada:encerrada'"));
    expect(encerrada.slice(0, 300)).toMatch(/microfone\.current\?\.stop\(\)/);
  });

  it('canal recusado vira erro visível, não "Entrando…" para sempre', () => {
    expect(TELA).toMatch(/ch\.bind\('pusher:subscription_error'/);
  });

  it('o canal não leva o id interno: user_id opaco e por aba', () => {
    const ramo = PUSHER_AUTH.slice(PUSHER_AUTH.indexOf('canal.startsWith(PREFIXO_DO_CANAL)'));
    expect(ramo.slice(0, 1200)).toMatch(/user_id: createHash\('sha256'\)/);
    expect(ramo.slice(0, 1200)).not.toMatch(/user_id: user\.id/);
  });

  it('fechar a chamada pelo pedido AVISA as telas', () => {
    expect(ENCERRAR_PEDIDO).toMatch(/\.trigger\(canalDoAtendimento\(sala\), 'chamada:encerrada'/);
  });
});
