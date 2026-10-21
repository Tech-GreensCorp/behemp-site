/**
 * Cliente da CHAT API do ChatPro (`sparks.chatpro.com.br`, cabeçalho `instance-token`).
 *
 * 🔴 É O ÚNICO PONTO DO SISTEMA QUE FALA COM O CHATPRO.
 * O `instance-token` dá acesso a TODAS as conversas de pacientes da instância. Isolá-lo
 * aqui é o que torna a rotação viável e a auditoria possível — nenhum outro arquivo lê
 * essa variável.
 *
 * PARA QUE ELE SERVE: A CONFIRMAÇÃO REVERSA
 * A documentação do ChatPro não descreve assinatura de webhook, segredo compartilhado nem
 * IPs de origem. Ou seja: quem descobrir a URL do webhook pode enviar um POST falso.
 *
 * A defesa principal não é o segredo na URL — é esta classe. O que chega pelo webhook é
 * tratado como PONTEIRO, nunca como verdade: dele usamos só os identificadores, e o dado
 * real (nome, telefone) vem de uma chamada autenticada de volta ao ChatPro. Um atacante não
 * consegue forjar um `lead_id` que exista na nossa instância.
 *
 * E a segurança sai de graça, porque a chamada já era necessária para enriquecer o dado.
 *
 * RESILIÊNCIA
 * Timeout sempre (10s). Retry apenas em erro de conexão, 429 e 5xx — nunca em 4xx, porque
 * 4xx é erro nosso e repetir não resolve. Backoff exponencial com variação aleatória, para
 * que várias instâncias não tentem de novo no mesmo instante.
 *
 * 🛑 Módulo puro de integração: sem `db`, sem `auth`, sem `next/*`.
 */

import { mascararTelefone, removerSufixoWhatsapp } from './telefone';

export interface ContatoChatpro {
  id: string | null;
  nome: string | null;
  /** Sem o sufixo `@s.whatsapp.net`. */
  telefone: string | null;
  /** Resposta original, para depuração. */
  bruto: unknown;
}

/**
 * Valores que o `.env.example` e o deploy usam como preenchimento — nunca como segredo.
 *
 * ⚠️ Isto não é preciosismo: com um token falso a API responde 401, o webhook não confirma
 * o contato e descartaria eventos LEGÍTIMOS como se fossem falsos. É melhor o sistema saber
 * que não está configurado e acumular os eventos para processar depois.
 */
const VALORES_DE_PREENCHIMENTO = new Set([
  'example',
  'placeholder',
  'build-placeholder',
  'changeme',
  'todo',
  'seu-token-aqui',
]);

function ehSegredoDeVerdade(valor?: string | null): boolean {
  const normalizado = (valor ?? '').trim().toLowerCase();
  return !!normalizado && !VALORES_DE_PREENCHIMENTO.has(normalizado);
}

const STATUS_QUE_VALE_TENTAR_DE_NOVO = new Set([429, 500, 502, 503, 504]);
const MAXIMO_DE_TENTATIVAS = 4;
const TIMEOUT_MS = 10_000;
const ESPERA_BASE_MS = 500;

/** Uma linha de catálogo do ChatPro: o UUID e o nome que a operação lê. */
export interface ItemDeCatalogo {
  id: string;
  nome: string;
}

export class ClienteChatpro {
  private readonly baseUrl: string;
  private readonly instanceId: string;
  private readonly token: string;

  constructor(config?: { baseUrl?: string; instanceId?: string; token?: string }) {
    this.baseUrl =
      config?.baseUrl ?? process.env.CHATPRO_CHAT_API_URL ?? 'https://sparks.chatpro.com.br';
    this.instanceId = config?.instanceId ?? process.env.CHATPRO_INSTANCE_ID ?? '';
    this.token = config?.token ?? process.env.CHATPRO_INSTANCE_TOKEN ?? '';
  }

  /** Sem instância e token de verdade, o cliente não faz chamada nenhuma. */
  estaConfigurado(): boolean {
    return !!(
      this.baseUrl &&
      ehSegredoDeVerdade(this.instanceId) &&
      ehSegredoDeVerdade(this.token)
    );
  }

  private async esperar(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private tempoDeEspera(tentativa: number, cabecalhoRetryAfter?: string | null): number {
    const segundos = Number(cabecalhoRetryAfter);
    if (cabecalhoRetryAfter && Number.isFinite(segundos) && segundos > 0) {
      return Math.min(segundos * 1000, 30_000);
    }
    // Exponencial mais variação: 0,5s · 1s · 2s · 4s, cada um com até 0,5s de folga.
    return ESPERA_BASE_MS * 2 ** (tentativa - 1) + Math.random() * ESPERA_BASE_MS;
  }

  /**
   * POST de leitura. Todos os endpoints usados aqui são idempotentes na prática, então
   * repetir é seguro.
   *
   * Devolve `null` em qualquer falha — quem chama trata "não confirmado" e "indisponível"
   * da mesma forma, de propósito: distinguir os dois exigiria vazar detalhe do serviço
   * externo para o paciente.
   */
  private async post<T>(caminho: string, corpo: Record<string, unknown>): Promise<T | null> {
    if (!this.estaConfigurado()) {
      console.warn('[chatpro] cliente não configurado, chamada ignorada', { caminho });
      return null;
    }

    for (let tentativa = 1; tentativa <= MAXIMO_DE_TENTATIVAS; tentativa++) {
      try {
        const resposta = await fetch(`${this.baseUrl}${caminho}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'instance-token': this.token,
          },
          body: JSON.stringify({ instanceId: this.instanceId, ...corpo }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (resposta.ok) return (await resposta.json()) as T;

        // 4xx (menos 429) é erro do nosso lado: instância errada, campo faltando.
        if (!STATUS_QUE_VALE_TENTAR_DE_NOVO.has(resposta.status)) {
          console.error('[chatpro] resposta de erro não recuperável', {
            caminho,
            status: resposta.status,
          });
          return null;
        }

        if (tentativa === MAXIMO_DE_TENTATIVAS) {
          console.error('[chatpro] erro recuperável esgotou as tentativas', {
            caminho,
            status: resposta.status,
            tentativas: tentativa,
          });
          return null;
        }

        await this.esperar(this.tempoDeEspera(tentativa, resposta.headers.get('retry-after')));
      } catch (erro) {
        if (tentativa === MAXIMO_DE_TENTATIVAS) {
          console.error('[chatpro] falha de conexão esgotou as tentativas', {
            caminho,
            tentativas: tentativa,
            mensagem: erro instanceof Error ? erro.message : String(erro),
          });
          return null;
        }
        await this.esperar(this.tempoDeEspera(tentativa));
      }
    }

    return null;
  }

  /**
   * Extração defensiva de id, nome e telefone.
   *
   * ⚠️ A documentação oficial do ChatPro publica os schemas de resposta VAZIOS (`{}`). Não
   * dá para saber de antemão se o contato vem na raiz, dentro de `data`, de `lead`, ou como
   * primeiro item de um array — e os nomes dos campos variam. Por isso a busca é por
   * candidatos, e não por um caminho fixo.
   *
   * Quando as chamadas reais forem executadas contra a instância de produção, o mapeamento
   * pode ser fixado e este método simplificado.
   */
  private extrairContato(payload: unknown): ContatoChatpro | null {
    if (!payload || typeof payload !== 'object') return null;

    const candidatos: Record<string, unknown>[] = [];
    const juntar = (valor: unknown) => {
      if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        candidatos.push(valor as Record<string, unknown>);
      }
    };

    if (Array.isArray(payload)) {
      juntar(payload[0]);
    } else {
      const raiz = payload as Record<string, unknown>;
      juntar(raiz);
      juntar(raiz.data);
      juntar(raiz.lead);
      if (Array.isArray(raiz.data)) juntar(raiz.data[0]);
      if (Array.isArray(raiz.leads)) juntar(raiz.leads[0]);
    }

    const escolher = (chaves: string[]): string | null => {
      for (const candidato of candidatos) {
        for (const chave of chaves) {
          const valor = candidato[chave];
          if (typeof valor === 'string' && valor.trim()) return valor.trim();
        }
      }
      return null;
    };

    const id = escolher(['id', 'lead_id', 'leadId', 'uuid']);
    const nome = escolher(['name', 'nome', 'lead_name', 'push_name', 'pushName', 'contact_name']);
    const telefoneCru = escolher(['number', 'phone', 'phoneNumber', 'phone_number', 'telefone']);

    // Resposta 200 vazia (`{}` ou `[]`) significa "não existe" — não confirmar.
    if (!id && !nome && !telefoneCru) return null;

    return {
      id,
      nome,
      telefone: telefoneCru ? removerSufixoWhatsapp(telefoneCru) : null,
      bruto: payload,
    };
  }

  /** `POST /leads/findById` — confirmação reversa a partir do identificador do contato. */
  async buscarContatoPorId(leadId: string): Promise<ContatoChatpro | null> {
    if (!leadId?.trim()) return null;

    const contato = this.extrairContato(
      await this.post<unknown>('/leads/findById', { leadId: leadId.trim() }),
    );

    if (!contato) console.warn('[chatpro] contato não confirmado por findById', { leadId });
    return contato;
  }

  /** `POST /leads/findByPhoneNumber` — confirmação reversa a partir do telefone. */
  async buscarContatoPorTelefone(telefone: string): Promise<ContatoChatpro | null> {
    const numero = removerSufixoWhatsapp(telefone);
    if (!numero) return null;

    const contato = this.extrairContato(
      await this.post<unknown>('/leads/findByPhoneNumber', { phoneNumber: numero }),
    );

    if (!contato) {
      console.warn('[chatpro] contato não confirmado por findByPhoneNumber', {
        telefone: mascararTelefone(numero),
      });
    }
    return contato;
  }

  /**
   * `POST /sessions/getSessionById` — descobre o contato a partir do id da conversa.
   *
   * 🔴 É ESTA CHAMADA QUE SUSTENTA O CAMINHO PRINCIPAL. O bloco "Requisição externa" do
   * chatbot manda apenas o id da sessão na URL, e todo o resto — nome, telefone — vem
   * daqui, de uma consulta autenticada. Ou seja: nada da URL precisa ser confiável.
   */
  async buscarLeadIdPorSessao(sessionId: string): Promise<string | null> {
    if (!sessionId?.trim()) return null;

    const payload = await this.post<unknown>('/sessions/getSessionById', {
      sessionId: sessionId.trim(),
    });
    if (!payload || typeof payload !== 'object') return null;

    const raizes: Record<string, unknown>[] = [];
    const juntar = (valor: unknown) => {
      if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        raizes.push(valor as Record<string, unknown>);
      }
    };

    if (Array.isArray(payload)) {
      juntar(payload[0]);
    } else {
      const registro = payload as Record<string, unknown>;
      juntar(registro);
      juntar(registro.data);
      juntar(registro.session);
      if (Array.isArray(registro.data)) juntar(registro.data[0]);
    }

    for (const raiz of raizes) {
      for (const chave of ['lead_id', 'leadId', 'leadid']) {
        const valor = raiz[chave];
        if (typeof valor === 'string' && valor.trim()) return valor.trim();
      }
    }

    console.warn('[chatpro] sessão sem identificador de contato', { sessionId });
    return null;
  }

  /**
   * Lista um dos catálogos da conta: filas de atendimento ou motivos de encerramento.
   *
   * 🔴 A RESPOSTA VEM COMO ARRAY NA RAIZ, E O HTTP É 201 — em endpoint de LEITURA.
   * Medido contra a instância real e registrado no `MAPA-DE-CAMPOS.md` do greens-corp.
   * Código que verificasse `status === 200` descartaria as duas listas em silêncio; o
   * `post` acima usa `resposta.ok`, que aceita a faixa 2xx inteira.
   *
   * A extração continua defensiva porque a documentação oficial publica os schemas de
   * resposta VAZIOS — o formato só é conhecido por observação, e observação envelhece.
   */
  private async listarCatalogo(caminho: string): Promise<ItemDeCatalogo[]> {
    const payload = await this.post<unknown>(caminho, {});
    if (!payload) return [];

    const cru = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as unknown[])
        : [];

    const itens: ItemDeCatalogo[] = [];
    for (const linha of cru) {
      if (!linha || typeof linha !== 'object') continue;
      const registro = linha as Record<string, unknown>;
      const id = registro.id ?? registro.uuid;
      const nome = registro.name ?? registro.nome ?? registro.title;
      if (typeof id === 'string' && id.trim() && typeof nome === 'string' && nome.trim()) {
        itens.push({ id: id.trim(), nome: nome.trim() });
      }
    }
    return itens;
  }

  /** As filas de atendimento. O UUID delas chega em `department_id` nos webhooks. */
  async listarDepartamentos(): Promise<ItemDeCatalogo[]> {
    return this.listarCatalogo('/departments/list');
  }

  /** Os motivos de encerramento. O UUID deles chega em `close_tag` nos webhooks. */
  async listarMotivosDeEncerramento(): Promise<ItemDeCatalogo[]> {
    return this.listarCatalogo('/endings/list');
  }
}
