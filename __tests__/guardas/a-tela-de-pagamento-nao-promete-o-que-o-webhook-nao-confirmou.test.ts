/**
 * GUARDA — a tela de pagamento (Parte 2, Fase 5) não promete o que o servidor não garantiu.
 *
 * Quatro classes de defeito, cada uma com um jeito de voltar em uma linha:
 *
 *   1. "APROVADO" VIRAR "CONFIRMADO". A resposta do `POST /v1/payments` não confirma nada — quem
 *      confirma é o webhook, relendo a API (Fase 3). Uma tela que dissesse "consulta agendada"
 *      a partir da resposta diria isso a quem o webhook depois recusa
 *   2. O PRAZO DA RESERVA EXPULSAR QUEM ESTÁ PAGANDO. A reserva dura 30 min e o PIX 31; o banco
 *      protege a reserva com pagamento em curso (Fase 4, `semPagamentoEmCurso`). A tela que
 *      voltasse ao começo aos 30 min desmentiria o banco para quem acabou de pagar
 *   3. A PUBLIC KEY NO BUNDLE, ou o meio errado no Brick. A chave vem do servidor por prop
 *      (`lib/env.ts`); boleto fica fora (vencimento mínimo de 3 dias contra reserva de 30 min)
 *   4. PII NO AVISO. O corpo do Pusher leva só id e estado
 *
 * A integração `a-tela-de-pagamento-segue-o-que-o-servidor-diz` executa o caminho com a action
 * real; este guarda fica no portão, sem banco.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PainelDoPagamento } from '@/components/shared/agendamento-pagamento-painel';
import {
  combinarComSituacao,
  entradaDoBrick,
  estadoDaSituacao,
  estadoDoResultado,
  haPagamentoEmCurso,
  mensagemDeRecusa,
  podeEnviar,
  type EstadoDoPagamento,
} from '@/lib/agendamento/pagamento-na-tela';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

const AGORA = Date.parse('2026-09-28T12:00:00Z');
const EM_10_MIN = new Date(AGORA + 10 * 60 * 1000).toISOString();
const HA_1_MIN = new Date(AGORA - 60 * 1000).toISOString();

const html = (estado: EstadoDoPagamento, reservaNoPrazo = true) =>
  renderToStaticMarkup(createElement(PainelDoPagamento, { estado, agora: AGORA, reservaNoPrazo }));

// ─────────────────────────────────────────────────────────────────────────────
describe('o envio do Brick vira a entrada da action', () => {
  it('PIX (`bank_transfer`) não leva nada do formulário — o pagador sai do cadastro', () => {
    expect(
      entradaDoBrick('c1', {
        selectedPaymentMethod: 'bank_transfer',
        formData: { payer: { email: 'digitado@x.com' } },
      }),
    ).toEqual({ consultaId: 'c1', metodo: 'pix' });
  });

  it('cartão: snake_case do Brick → camelCase da action, só o token', () => {
    expect(
      entradaDoBrick('c1', {
        selectedPaymentMethod: 'creditCard',
        formData: {
          token: 't',
          issuer_id: 25,
          payment_method_id: 'visa',
          installments: '2',
          payer: { email: 'a@b.com', identification: { type: 'CPF', number: '1' } },
        },
      }),
    ).toEqual({
      consultaId: 'c1',
      metodo: 'cartao',
      dadosCartao: {
        token: 't',
        paymentMethodId: 'visa',
        issuerId: '25',
        installments: 2,
        payer: { email: 'a@b.com', identification: { type: 'CPF', number: '1' } },
      },
    });
  });

  it.each([
    ['boleto', { selectedPaymentMethod: 'ticket', formData: {} }],
    ['débito', { selectedPaymentMethod: 'debitCard', formData: { token: 't' } }],
    [
      'cartão sem token',
      { selectedPaymentMethod: 'creditCard', formData: { payment_method_id: 'visa' } },
    ],
  ])('%s não vira cobrança', (_n, envio) => {
    expect(entradaDoBrick('c1', envio)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 1. "aprovado" nunca vira "confirmado" pela resposta da cobrança', () => {
  const sucesso = (statusMp: string, status = 'em_processamento', detalhe: string | null = null) =>
    estadoDoResultado({ sucesso: true, dados: { status, statusMp, statusDetailMp: detalhe } });

  it.each(['approved', 'authorized', 'pending', 'in_process', 'in_mediation', ''])(
    'statusMp %s não devolve "confirmado"',
    (statusMp) => {
      expect(sucesso(statusMp).tipo).not.toBe('confirmado');
    },
  );

  it('aprovado → "aprovado"; em análise → "em_analise"', () => {
    expect(sucesso('approved')).toEqual({ tipo: 'aprovado' });
    expect(sucesso('in_process')).toEqual({ tipo: 'em_analise' });
  });

  it('o painel de "aprovado" não diz que a consulta está agendada', () => {
    const texto = html({ tipo: 'aprovado' });
    expect(texto).toContain('confirmando sua consulta');
    expect(texto).not.toMatch(/está agendada|consulta confirmada/i);
  });

  it('só o estado lido do banco, depois do webhook, diz "agendada"', () => {
    expect(
      estadoDaSituacao({
        statusConsulta: 'agendada',
        statusPagamento: 'pago',
        emCurso: null,
        pixValidoAte: null,
      }),
    ).toEqual({ tipo: 'confirmado' });
    expect(html({ tipo: 'confirmado' })).toContain('sua consulta está agendada');
  });

  it('a releitura não "promove" um aprovado para confirmado enquanto o banco diz reservada', () => {
    expect(
      combinarComSituacao(
        { tipo: 'aprovado' },
        {
          statusConsulta: 'reservada',
          statusPagamento: 'em_processamento',
          emCurso: 'cartao',
          pixValidoAte: null,
        },
      ),
    ).toEqual({ tipo: 'aprovado' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a recusa diz o porquê, e nunca o código cru', () => {
  it('CVV, limite e o desconhecido', () => {
    expect(mensagemDeRecusa('cc_rejected_bad_filled_security_code')).toMatch(/CVV/);
    expect(mensagemDeRecusa('cc_rejected_insufficient_amount')).toMatch(/limite/);
    expect(mensagemDeRecusa('cc_rejected_codigo_inventado')).not.toContain('cc_rejected');
    expect(mensagemDeRecusa(null)).toMatch(/recusado/);
  });

  it('o painel da recusa mostra a mensagem e o "tentar de novo" só com a reserva no prazo', () => {
    const recusa: EstadoDoPagamento = { tipo: 'recusado', mensagem: 'Confira o CVV.' };
    const comAcao = renderToStaticMarkup(
      createElement(PainelDoPagamento, {
        estado: recusa,
        agora: AGORA,
        reservaNoPrazo: true,
        onTentarDeNovo: () => {},
      }),
    );
    expect(comAcao).toContain('Confira o CVV.');
    expect(comAcao).toContain('Tentar de novo');
    const semAcao = renderToStaticMarkup(
      createElement(PainelDoPagamento, {
        estado: recusa,
        agora: AGORA,
        reservaNoPrazo: false,
        onTentarDeNovo: () => {},
      }),
    );
    expect(semAcao).not.toContain('Tentar de novo');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o PIX mostra o QR e a validade REAL', () => {
  const pix: EstadoDoPagamento = {
    tipo: 'pix',
    qrCode: '000201-codigo',
    qrCodeBase64: 'iVBORw0',
    ticketUrl: 'https://mp/ticket',
    validoAte: EM_10_MIN,
  };

  it('QR em data URI, copia-e-cola e o cronômetro da validade do PIX', () => {
    const texto = html(pix);
    expect(texto).toContain('src="data:image/png;base64,iVBORw0"');
    expect(texto).toContain('value="000201-codigo"');
    expect(texto).toContain('O PIX vale por mais 10:00');
  });

  it('PIX vencido não mostra o código como pagável', () => {
    const texto = html({ ...pix, validoAte: HA_1_MIN });
    expect(texto).toContain('O PIX venceu sem pagamento');
    expect(texto).not.toContain('000201-codigo');
  });

  it('a releitura não apaga o QR que a tela já tem', () => {
    expect(
      combinarComSituacao(pix, {
        statusConsulta: 'reservada',
        statusPagamento: 'em_processamento',
        emCurso: 'pix',
        pixValidoAte: EM_10_MIN,
      }),
    ).toBe(pix);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 2. o prazo da reserva não expulsa quem está pagando', () => {
  it.each<[string, EstadoDoPagamento, boolean]>([
    [
      'PIX pagável',
      { tipo: 'pix', qrCode: 'q', qrCodeBase64: 'b', ticketUrl: null, validoAte: EM_10_MIN },
      true,
    ],
    [
      'PIX vencido',
      { tipo: 'pix', qrCode: 'q', qrCodeBase64: 'b', ticketUrl: null, validoAte: HA_1_MIN },
      false,
    ],
    ['cartão aprovado', { tipo: 'aprovado' }, true],
    ['cartão em análise', { tipo: 'em_analise' }, true],
    ['pago sem horário', { tipo: 'pago_sem_horario' }, true],
    ['ainda escolhendo', { tipo: 'escolhendo' }, false],
    ['recusado', { tipo: 'recusado', mensagem: 'x' }, false],
  ])('%s → pagamento em curso: %s', (_n, estado, esperado) => {
    expect(haPagamentoEmCurso(estado, AGORA)).toBe(esperado);
  });

  it('reserva vencida não deixa o Brick aparecer', () => {
    expect(podeEnviar({ tipo: 'escolhendo' }, HA_1_MIN, AGORA)).toBe(false);
    expect(podeEnviar({ tipo: 'escolhendo' }, EM_10_MIN, AGORA)).toBe(true);
    expect(podeEnviar({ tipo: 'aprovado' }, EM_10_MIN, AGORA)).toBe(false);
  });

  it('a tela só chama `onExpirar` sem pagamento em curso', () => {
    const passo = ler('components/shared/agendamento-pagamento-step.tsx');
    expect(passo).toMatch(/const expirado = !reservaNoPrazo && !emCurso && !lendo;/);
    expect(passo).toMatch(/if \(expirado && !expirarAvisadoRef\.current\)/);
    expect(passo.match(/onExpirar\?\.\(\)/g)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 3. a chave vem do servidor, e o Brick só oferece crédito e PIX', () => {
  it('nenhuma public key no código nem como NEXT_PUBLIC_', () => {
    for (const arquivo of [
      'components/shared/agendamento-pagamento-brick.tsx',
      'components/shared/agendamento-pagamento-step.tsx',
      'components/shared/agendamento-wizard.tsx',
      'app/(paciente)/paciente/agendamento/page.tsx',
    ]) {
      const codigo = ler(arquivo);
      expect(codigo, arquivo).not.toMatch(/\b(APP_USR|TEST)-[0-9a-f]{8}-/);
      expect(codigo, arquivo).not.toContain('NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY');
    }
    expect(ler('.github/workflows/deploy.yml')).not.toMatch(
      /^\s*NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY/m,
    );
  });

  it('a página lê a chave no servidor e a passa por prop', () => {
    const pagina = ler('app/(paciente)/paciente/agendamento/page.tsx');
    expect(pagina).not.toMatch(/^'use client'/);
    expect(pagina).toContain('publicKeyMercadoPago={publicKeyDoBrick()}');
    const chave = ler('lib/mercadopago/public-key.ts');
    expect(chave).toContain("env.MERCADOPAGO_AMBIENTE === 'producao'");
  });

  it('o Brick: crédito e PIX, sem boleto, carregado só no navegador', () => {
    const brick = ler('components/shared/agendamento-pagamento-brick.tsx');
    expect(brick).toMatch(/creditCard: 'all'/);
    expect(brick).toMatch(/bankTransfer: 'all'/);
    expect(brick).not.toMatch(/\bticket\s*:/);
    expect(brick).not.toMatch(/\bdebitCard\s*:/);
    const passo = ler('components/shared/agendamento-pagamento-step.tsx');
    expect(passo).toMatch(
      /dynamic\(\(\) => import\('@\/components\/shared\/agendamento-pagamento-brick'\), \{\s*ssr: false/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 4. o aviso em tempo real não leva PII e não derruba a fila', () => {
  const aviso = ler('lib/mercadopago/aviso-ao-paciente.ts');

  it('o corpo é só { consultaId, estado }, no canal pessoal', () => {
    expect(aviso).toMatch(
      /trigger\(canalUsuario\(dono\.userId\), EVENTO_PAGAMENTO_ATUALIZADO, \{\s*consultaId,\s*estado,\s*\}\)/,
    );
  });

  it('nunca lança: o trigger está dentro do try', () => {
    const corpo = aviso.slice(aviso.indexOf('export async function avisarPacienteDoPagamento'));
    expect(corpo.indexOf('try {')).toBeGreaterThan(-1);
    expect(corpo.indexOf('try {')).toBeLessThan(corpo.indexOf('.trigger('));
    expect(corpo).toMatch(/\} catch \(erro\) \{/);
  });

  it('o processamento avisa nos desfechos finais, e a tela escuta o MESMO evento', () => {
    const fila = ler('lib/mercadopago/notificacoes.ts');
    expect(fila).toContain("avisarPacienteDoPagamento(linha.consultaId, 'confirmado')");
    expect(fila).toContain('avisarPacienteDoPagamento(linha.consultaId, status)');
    expect(aviso).toContain("EVENTO_PAGAMENTO_ATUALIZADO = 'pagamento:atualizado'");
    expect(ler('components/shared/agendamento-pagamento-step.tsx')).toContain(
      "EVENTO_PAGAMENTO_ATUALIZADO = 'pagamento:atualizado'",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 5. só à vista, e o SERVIDOR decide', () => {
  it('o Brick oferece só 1 parcela', () => {
    const brick = ler('components/shared/agendamento-pagamento-brick.tsx');
    expect(brick).toMatch(/minInstallments: 1,/);
    expect(brick).toMatch(/maxInstallments: 1,/);
  });

  it('a action recusa mais de 1 parcela — o cliente não decide', () => {
    const action = ler('app/(public)/_actions/pagamento.ts');
    expect(action).toMatch(/installments: z\.number\(\)\.int\(\)\.min\(1\)\.max\(1\),/);
    expect(action).not.toMatch(/installments: z\.number\(\)\.int\(\)\.min\(1\)\.max\((?!1\))\d+\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 6. médico sem conta não recebe oferta de pagamento', () => {
  it('a lista de médicos traz `agendavel` de `podeAgendarCom`, e o card desabilita', () => {
    const acoes = ler('app/(public)/_actions/agendamento.ts');
    expect(acoes).toMatch(/resultado\.map\(\(m\) => podeAgendarCom\(m\.id\)\)/);
    expect(acoes).toMatch(/agendavel: permissoes\[i\]\.permitido,/);
    const wizard = ler('components/shared/agendamento-wizard.tsx');
    // `(?<!aria-)`: sem ele, o `aria-disabled` casava sozinho e a remoção do `disabled` real
    // passava verde — a sabotagem M2 mostrou, em 28/09/2026.
    expect(wizard).toMatch(/(?<!aria-)disabled=\{!m\.agendavel\}/);
    expect(wizard).toMatch(/if \(!medico\.agendavel\) return;/);
  });

  it('o Brick só aparece com o médico CONECTADO — com o interruptor desligado ele chega até aqui', () => {
    const passo = ler('components/shared/agendamento-pagamento-step.tsx');
    expect(passo).toMatch(/medicoConectado === true &&/);
    expect(ler('app/(public)/_actions/agendamento.ts')).toMatch(
      /medicoConectado: await estaConectado\(linha\.medicoId\),/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * 🔴 7. O BRICK NÃO SE RECRIA A CADA RENDER — o defeito de 28/09/2026, em produção.
 *
 * O `<Payment>` do SDK recria o Brick (unmount + `initBrick`) quando muda a identidade de
 * `[initialization, customization, onReady, onError, onSubmit, onBinChange]`. Com `onSubmit` e
 * `onError` inline e a etapa re-renderizando a cada segundo (o cronômetro), o Brick era recriado
 * a cada segundo: os meios sumiam e voltavam, e o que o paciente digitava se perdia.
 *
 * ⚠️ O guarda lê a DEPENDÊNCIA do próprio SDK: se uma versão nova passar a observar outra prop,
 * o caso de cobertura fica vermelho e nomeia a prop — em vez de o Brick voltar a piscar.
 */
describe('🔴 7. o Brick não se recria a cada render', () => {
  const brick = ler('components/shared/agendamento-pagamento-brick.tsx');
  const passo = ler('components/shared/agendamento-pagamento-step.tsx');
  const sdk = ler('node_modules/@mercadopago/sdk-react/esm/bricks/payment/index.js');

  const depsDoSdk = (sdk.match(/\}, \[([^\]]+)\]\);\s*return React\.createElement/)?.[1] ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  it('o SDK observa as props que este guarda conhece (vacuidade e cobertura)', () => {
    expect(
      depsDoSdk.length,
      'não extraí as dependências do useEffect do <Payment>',
    ).toBeGreaterThan(0);
    const conhecidas = [
      'initialization',
      'customization',
      'onReady',
      'onError',
      'onSubmit',
      'onBinChange',
    ];
    expect(depsDoSdk.filter((d) => !conhecidas.includes(d))).toEqual([]);
  });

  it.each(['onSubmit', 'onError', 'onReady', 'onBinChange'])(
    '`%s` do <Payment> nunca é função inline',
    (prop) => {
      expect(brick).not.toMatch(
        new RegExp(`${prop}=\\{\\s*(async\\s*)?(\\(|function|[a-zA-Z_$][\\w$]*\\s*=>)`),
      );
    },
  );

  /**
   * O array de dependências que FECHA o `useCallback` da constante — o primeiro `}, [` depois
   * dela. ⚠️ Um `[\s\S]*?\}, \[\]\)` atravessava blocos: pulava o `}, [onEnviar]);` do
   * `onSubmit` e casava o `}, []);` do `onError`. A sabotagem R4 mostrou, em 28/09/2026.
   */
  const depsDoCallback = (nome: string) => {
    const inicio = brick.indexOf(`const ${nome} = useCallback(`);
    if (inicio < 0) return null;
    return brick.slice(inicio).match(/\n  \}, \[([^\]]*)\]\);/)?.[1] ?? null;
  };

  it.each(['onSubmit', 'onError'])('`%s` é useCallback SEM dependências', (nome) => {
    expect(depsDoCallback(nome), `${nome}: não achei o useCallback`).not.toBeNull();
    expect(depsDoCallback(nome)?.trim()).toBe('');
  });

  it('as callbacks leem as props por ref, e são as que vão ao <Payment>', () => {
    expect(brick).toMatch(/onEnviarRef\.current\(/);
    expect(brick).toMatch(/onFalhaRef\.current\(/);
    expect(brick).toMatch(/onSubmit=\{onSubmit\}/);
    expect(brick).toMatch(/onError=\{onError\}/);
  });

  it('`initialization` e `customization` são useMemo', () => {
    expect(brick).toMatch(/const initialization = useMemo\(/);
    expect(brick).toMatch(/const customization = useMemo\(/);
  });

  it('o componente é `memo`, e a etapa lhe passa só props estáveis', () => {
    expect(brick).toMatch(/export default memo\(PagamentoBrick\);/);
    expect(passo).toMatch(/const aoEnviarDoBrick = useCallback\(/);
    expect(passo).toMatch(/const aoFalharOBrick = useCallback\(/);
    expect(passo).toMatch(/onEnviar=\{aoEnviarDoBrick\}/);
    expect(passo).toMatch(/onFalhaDoBrick=\{aoFalharOBrick\}/);
  });
});
