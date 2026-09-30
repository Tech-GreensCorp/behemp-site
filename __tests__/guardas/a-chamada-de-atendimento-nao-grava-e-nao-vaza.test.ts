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
 *   8. o botão de mostrar a tela aparecer onde o navegador não deixa (D-16);
 *   9. a câmera nascer ligada, ou ficar acesa depois de desligar, sair ou encerrar; a tela do admin
 *      perder o aviso sobre dado de OUTROS pacientes; o sinal `midia` passar sem conferir o formato;
 *      o quadro vazio voltar a ser um preto que parece câmera quebrada; ou o print perder o modal com
 *      zoom (D-21 a D-23, `DO-79` a `DO-82`).
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

/** O corpo de `const nome = async (…) => { … }`: as funções da tela são setas, não `function`. */
function corpoDaSeta(fonte: string, nome: string): string {
  const i = fonte.search(new RegExp(`const ${nome} = (async )?\\(`));
  if (i < 0) return '';
  const abre = fonte.indexOf('{', fonte.indexOf('=>', i));
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

  // Retificado em 30/09/2026: exigia `if (!aberto)`, a FORMA de 29/09. Com o modal (D-23), a proteção
  // passou a ser `{aberto && (` em volta da imagem. A regra é a mesma: nada busca a imagem fechada.
  it('a imagem só é buscada quando alguém clica para ver', () => {
    const print = corpoDe(CHAT, 'Print');
    const aberto = print.indexOf('{aberto && (');
    const imagem = print.indexOf('/api/atendimento/print/');
    expect(aberto).toBeGreaterThanOrEqual(0);
    expect(imagem).toBeGreaterThan(aberto);
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

describe('a câmera, a tela dos dois lados e o print (D-21 a D-23)', () => {
  const LIGAR = corpoDaSeta(TELA, 'ligarCamera');
  const DESLIGAR = corpoDaSeta(TELA, 'desligarCamera');
  const ENCERRAR = corpoDaSeta(TELA, 'encerrar');
  const SAIR = TELA.slice(TELA.lastIndexOf('return () => {'));
  const ENCERRADA = TELA.slice(TELA.indexOf("ch.bind('chamada:encerrada'"));

  it('vacuidade: as funções da câmera existem', () => {
    expect(LIGAR.length).toBeGreaterThan(0);
    expect(DESLIGAR.length).toBeGreaterThan(0);
    expect(ENCERRAR.length).toBeGreaterThan(0);
  });

  it('a câmera nasce DESLIGADA: só o clique pede vídeo ao navegador', () => {
    const pedidos = TELA.match(/getUserMedia\(\{[\s\S]*?\}\)/g) ?? [];
    const comVideo = pedidos.filter((x) => /video:/.test(x));
    expect(comVideo).toHaveLength(1);
    expect(LIGAR).toContain(comVideo[0]);
  });

  it('desligar, sair, encerrar e o pedido encerrado PARAM a câmera (apaga a luz)', () => {
    expect(DESLIGAR).toMatch(/camera\.current\?\.stop\(\)/);
    expect(DESLIGAR).toMatch(/trocarCamera\(pc\.current, null\)/);
    expect(SAIR.slice(0, 400)).toMatch(/camera\.current\?\.stop\(\)/);
    expect(ENCERRAR).toMatch(/camera\.current\?\.stop\(\)/);
    expect(ENCERRADA.slice(0, 400)).toMatch(/camera\.current\?\.stop\(\)/);
  });

  it('encerrar também para a captura de tela de quem encerra', () => {
    expect(ENCERRAR).toMatch(/faixaDeTela\.current\?\.stop\(\)/);
  });

  it('a câmera já ligada vai junto na oferta e na resposta', () => {
    expect(TELA).toMatch(/criarOfertaDoAdmin\(conexao, microfone\.current, camera\.current\)/);
    expect(TELA).toMatch(/microfone\.current,\s*camera\.current,\s*\)/);
  });

  it('mostrar a tela depende do navegador, não do papel', () => {
    expect(TELA).toMatch(/setPodeMostrarTela\(podeCompartilharTela\(\)\)/);
    expect(TELA).not.toMatch(/papel === 'paciente' && podeCompartilharTela/);
  });

  it('o aviso do admin fala de dado de OUTROS pacientes, e o do paciente continua', () => {
    expect(TELA).toMatch(/dado de outros pacientes/);
    expect(TELA.match(/Nada é gravado: nem a voz, nem a tela\./g) ?? []).toHaveLength(2);
  });

  it('sem vídeo do outro lado, a tela diz isso em vez de mostrar um quadro preto', () => {
    expect(TELA).toMatch(/está sem câmera e não está mostrando a tela\./);
    expect(TELA).not.toMatch(/rounded-2xl border bg-black/);
  });

  it('o sinal `midia` é conferido por inteiro no servidor, e lido como booleano na tela', () => {
    expect(SINALIZAR).toMatch(/'midia'\] as const/);
    expect(SINALIZAR).toMatch(
      /z\.object\(\{ camera: z\.boolean\(\), tela: z\.boolean\(\) \}\)\.strict\(\)/,
    );
    const confere = SINALIZAR.indexOf(
      "tipo === 'midia' && !midiaSchema.safeParse(payload).success",
    );
    expect(confere).toBeGreaterThanOrEqual(0);
    expect(SINALIZAR.indexOf('.trigger(')).toBeGreaterThan(confere);
    expect(TELA).toMatch(/camera: dados\.camera === true, tela: dados\.tela === true/);
  });

  it('o print abre num modal com zoom, e a imagem só monta com ele aberto', () => {
    const print = corpoDe(CHAT, 'Print');
    expect(print).toMatch(/<Dialog open=\{aberto\}/);
    expect(print).toMatch(/aria-label="Ampliar"/);
    expect(print).toMatch(/aria-label="Diminuir"/);
    const condicao = print.indexOf('{aberto && (');
    expect(condicao).toBeGreaterThanOrEqual(0);
    expect(print.indexOf('/api/atendimento/print/')).toBeGreaterThan(condicao);
  });
});

describe('a revisão da Fase 2.1 (30/09/2026) — o que ela achou não volta', () => {
  const LIGAR = corpoDaSeta(TELA, 'ligarCamera');
  const DESLIGAR = corpoDaSeta(TELA, 'desligarCamera');
  const MOSTRAR = corpoDaSeta(TELA, 'mostrarTela');
  const PARAR = corpoDaSeta(TELA, 'pararTela');
  const OFERTA = TELA.slice(TELA.indexOf("'webrtc:offer'"), TELA.indexOf("'webrtc:answer'"));

  it('câmera liberada depois de sair ou encerrar é parada, não fica acesa', () => {
    const confere = LIGAR.indexOf('if (!viva.current)');
    expect(confere).toBeGreaterThanOrEqual(0);
    expect(LIGAR.slice(confere, confere + 120)).toMatch(
      /fluxo\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/,
    );
    expect(LIGAR.indexOf('camera.current = faixa')).toBeGreaterThan(confere);
    for (const saida of ['return () => {', "ch.bind('chamada:encerrada'"])
      expect(TELA.slice(TELA.indexOf(saida), TELA.indexOf(saida) + 200)).toMatch(
        /viva\.current = false/,
      );
    expect(corpoDaSeta(TELA, 'encerrar')).toMatch(/viva\.current = false/);
  });

  it('a câmera entra no ref ANTES de esperar a troca, e a resposta em curso a reconcilia', () => {
    expect(LIGAR.indexOf('camera.current = faixa')).toBeLessThan(
      LIGAR.indexOf('await trocarCamera'),
    );
    expect(OFERTA).toMatch(/if \(camera\.current\) await trocarCamera\(conexao, camera\.current\)/);
  });

  it('desligar a câmera e parar a tela param a faixa ANTES da troca que pode falhar', () => {
    expect(DESLIGAR.indexOf('camera.current?.stop()')).toBeLessThan(
      DESLIGAR.indexOf('trocarCamera('),
    );
    expect(PARAR.indexOf('faixaDeTela.current?.stop()')).toBeLessThan(PARAR.indexOf('trocarTela('));
  });

  it('a tela escolhida depois de a conexão cair é parada, não fica capturando', () => {
    expect(MOSTRAR).toMatch(/const conexao = viva\.current \? pc\.current : null;/);
    expect(MOSTRAR).toMatch(/if \(!trocou\) \{\s*faixa\.stop\(\)/);
    expect(MOSTRAR).not.toMatch(/trocarTela\(pc\.current, faixa\)/);
  });

  it('os avisos de mídia saem em fila, e a conexão caída zera o estado remoto', () => {
    expect(corpoDaSeta(TELA, 'avisarMidia')).toMatch(
      /filaDeAvisos\.current = filaDeAvisos\.current\.then\(/,
    );
    const falhou = TELA.indexOf("conexao.connectionState === 'failed'");
    expect(TELA.slice(falhou, falhou + 300)).toMatch(
      /setMidiaRemota\(\{ camera: false, tela: false \}\)/,
    );
  });
});
