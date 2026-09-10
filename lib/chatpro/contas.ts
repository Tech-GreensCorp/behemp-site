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
const CONTAS: { conta: ContaDeChatpro; variavel: string }[] = [
  {
    conta: { id: 'behemp', rotulo: 'BeHemp', urlDeRetorno: null },
    variavel: 'CHATPRO_INTAKE_SECRET',
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
  },
];

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
