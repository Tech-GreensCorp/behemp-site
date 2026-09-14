import { segredosConferem } from './segredo';

/**
 * AS CONTAS DE CHATPRO QUE FALAM COM ESTE ENDPOINT (ADR-0018).
 *
 * O mesmo `/api/chatpro/bot-link` atende duas contas: a da BeHemp e a da Greens. É um
 * endpoint só de propósito (ADR-0018 D-01) — duplicar a rota duplicaria normalização de
 * telefone, idempotência e montagem de mensagem, e no dia de corrigir um defeito alguém
 * corrigiria um lado só.
 *
 * 🔴 O QUE SEPARA AS CONTAS É O SEGREDO, E CADA UMA TEM O SEU.
 *
 * Não é zelo: um segredo compartilhado significaria que rotacionar exige mexer nos DOIS
 * painéis ao mesmo tempo, e que vazar um comprometeria os dois canais. Como o segredo é
 * por conta, ele também **identifica** quem está chamando — sem precisar de um parâmetro
 * na URL, que o painel poderia preencher errado.
 *
 * ⚠️ E A CONTA DECIDE PARA ONDE O PACIENTE VOLTA. Quem veio pelo WhatsApp da Greens
 * termina lá, porque a compra acontece lá (ADR-0018 D-03).
 */
export interface ContaDeChatpro {
  /** Identificador interno. Vai para `solicitacoes_cadastro.parceiro`. */
  id: 'behemp' | 'greens';
  rotulo: string;
  /** `null` quando o paciente fica aqui — é o caso da conta da BeHemp. */
  urlDeRetorno: string | null;
}

/**
 * As contas conhecidas, com o nome da variável que guarda o segredo de cada uma.
 *
 * ⚠️ A conta da BeHemp usa `CHATPRO_INTAKE_SECRET` — o nome que já existia. Renomeá-la
 * para ficar simétrica com a nova quebraria o painel já configurado em produção, e
 * simetria de nome não vale um incidente.
 */
const CONTAS: {
  conta: ContaDeChatpro;
  variavel: string;
  /**
   * 🔴 AS CREDENCIAIS DA INSTÂNCIA DE CHATPRO DESTA CONTA — 14/09/2026.
   *
   * Cada conta é uma instância DIFERENTE do ChatPro. O `leadId` e o `sessionId` que chegam
   * numa chamada só existem na instância de quem chamou: perguntar por um lead da Greens na
   * instância da BeHemp devolve nada, e `buscarContatoPorId` responde `null`.
   *
   * ⚠️ E `null` ali não é "não achei": é `throw ErroDeContatoNaoConfirmado`, ANTES do insert.
   * A solicitação nunca nasce, o `/bot-link` responde 422, e o painel do ChatPro transfere o
   * paciente para um atendente. Foi o que travou o Fluxo 2 — dezenas de
   * `[chatpro] contato não confirmado por findById` no log de produção, com leadIds
   * diferentes, todos da instância da Greens.
   *
   * 🔴 E a medição enganou: `select count(chatpro_lead_id)` devolvia **0**, o que parecia
   * provar que ninguém mandava `leadId`. Provava o contrário — as que mandavam morriam antes
   * de virar linha. **Contar o que sobreviveu não mede o que chegou.**
   */
  instancia: {
    id: string;
    token: string;
    /**
     * 🔴 O HOST TAMBÉM É POR CONTA — 14/09/2026.
     *
     * O ChatPro não tem host único: cada conta responde num subdomínio próprio, e `sparks` é o
     * da GREENS, não uma palavra do produto. Token válido no host errado devolve **401**, não
     * 404 — e 401 se lê como "credencial errada", que foi exatamente o diagnóstico errado que
     * isso produziu por semanas.
     *
     * ⚠️ E o default de `CHATPRO_CHAT_API_URL` aponta para `sparks`. Para a conta da Greens
     * isso é correto por acaso; para a da BeHemp, faz toda chamada ir ao servidor deles, que
     * responde `"Token inválido"` — corretamente, porque não conhece o nosso token.
     */
    host: string;
  };
}[] = [
  {
    conta: { id: 'behemp', rotulo: 'BeHemp', urlDeRetorno: null },
    variavel: 'CHATPRO_INTAKE_SECRET',
    instancia: {
      id: 'CHATPRO_INSTANCE_ID',
      token: 'CHATPRO_INSTANCE_TOKEN',
      host: 'CHATPRO_CHAT_API_URL',
    },
  },
  {
    conta: {
      id: 'greens',
      rotulo: 'Greens',
      // Preenchida na identificação — depende de env, e ler env aqui congelaria o valor
      // no import.
      urlDeRetorno: null,
    },
    variavel: 'CHATPRO_INTAKE_SECRET_GREENS',
    instancia: {
      id: 'CHATPRO_INSTANCE_ID_GREENS',
      token: 'CHATPRO_INSTANCE_TOKEN_GREENS',
      host: 'CHATPRO_CHAT_API_URL_GREENS',
    },
  },
];

/**
 * As credenciais da instância de ChatPro de uma conta, lidas do ambiente na hora.
 *
 * ⚠️ Lidas na CHAMADA, nunca no import: o mesmo motivo pelo qual `urlDeRetorno` é preenchida
 * na identificação. Ler env no topo do módulo congela o valor de quando o arquivo carregou.
 *
 * Devolve `null` quando a conta não tem credencial configurada — e quem chama deve tratar isso
 * como "não dá para confirmar", não como erro: o segredo do cabeçalho já autenticou a origem.
 */
export function instanciaDaConta(
  id: ContaDeChatpro['id'],
): { instanceId: string; token: string; baseUrl?: string } | null {
  const entrada = CONTAS.find((c) => c.conta.id === id);
  if (!entrada) return null;
  const instanceId = process.env[entrada.instancia.id]?.trim();
  const token = process.env[entrada.instancia.token]?.trim();
  if (!instanceId || !token) return null;

  /**
   * ⚠️ O host é OPCIONAL de propósito, e a assimetria é deliberada.
   *
   * Sem ele, o cliente cai no default — que hoje é `sparks`, o subdomínio da Greens. Para a
   * conta `greens` isso acerta; para a `behemp`, erra. Exigir o host quebraria a conta que
   * funciona para consertar a que não funciona, e nenhuma das duas ficaria de pé.
   *
   * O caminho certo é cadastrar `CHATPRO_CHAT_API_URL` com o nosso subdomínio real — está
   * catalogado. Até lá, quem tem host próprio usa o seu, e quem não tem usa o default.
   */
  const baseUrl = process.env[entrada.instancia.host]?.trim();
  return baseUrl ? { instanceId, token, baseUrl } : { instanceId, token };
}

/**
 * Descobre de qual conta veio a chamada, pelo segredo.
 *
 * 🔴 COMPARA CONTRA TODAS AS CONTAS, SEM PARAR NA PRIMEIRA QUE CASA.
 *
 * Um `for` com `break` responderia mais rápido quando o segredo é da primeira conta da
 * lista — e essa diferença de tempo diz a quem tenta **qual** conta ele acertou. É a mesma
 * família do ataque que `segredosConferem` evita, um nível acima: lá se descobre o valor,
 * aqui se descobriria qual dos valores.
 */
export function identificarConta(
  segredoRecebido: string | null | undefined,
): ContaDeChatpro | null {
  let encontrada: ContaDeChatpro | null = null;

  for (const { conta, variavel } of CONTAS) {
    const esperado = process.env[variavel]?.trim();
    // Sem `break`, e a atribuição acontece dentro do `if` para o custo ser o mesmo
    // independentemente de qual conta casou.
    if (segredosConferem(segredoRecebido, esperado)) {
      encontrada = { ...conta, urlDeRetorno: urlDeRetornoDaConta(conta.id) };
    }
  }

  return encontrada;
}

/**
 * Para onde devolver o paciente ao fim do cadastro.
 *
 * A conta da BeHemp devolve `null`: ele já está em casa. A da Greens devolve o endereço
 * configurado — e ele passa pela MESMA validação de origem do handoff
 * (`lib/parceiros/retorno.ts`) antes de virar link, porque um destino que não está na
 * lista de permitidas é redirecionamento aberto, venha de onde vier.
 */
function urlDeRetornoDaConta(id: ContaDeChatpro['id']): string | null {
  if (id !== 'greens') return null;
  return process.env.CHATPRO_GREENS_URL_DE_RETORNO?.trim() || null;
}

/** Quantas contas estão de fato configuradas. Para o diagnóstico. */
export function contasConfiguradas(): string[] {
  return CONTAS.filter(({ variavel }) => Boolean(process.env[variavel]?.trim())).map(
    ({ conta }) => conta.id,
  );
}
