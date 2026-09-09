import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { chatproDiretorio } from '@/db/schema';

import { ClienteChatpro } from './cliente';

type TipoDeDiretorio = 'departamento' | 'motivo_encerramento';

/**
 * TRADUÇÃO DE UUID PARA NOME LEGÍVEL.
 *
 * O webhook do ChatPro nunca manda o rótulo, só o identificador: `department_id` e
 * `close_tag` chegam como UUID. Sem este serviço, o histórico do funil registraria
 * `d3457174-7342-46f0-9725-a8f8c9a19002` — que é, na conta do greens-corp,
 * "Aguardando Autorização Anvisa". Um relatório assim não se lê.
 *
 * 🔴 A TRADUÇÃO NUNCA BLOQUEIA O PROCESSAMENTO.
 * Se o nome não estiver no cache e a API estiver fora do ar, o evento é processado
 * mesmo assim, guardando o UUID como rótulo. Perder o nome de uma fila é um defeito
 * de leitura; perder o evento é um defeito de dado. O primeiro se conserta na próxima
 * sincronização, o segundo não se conserta nunca.
 */
export class ServicoDeDiretorio {
  constructor(private cliente = new ClienteChatpro()) {}

  /**
   * Puxa os dois catálogos da API e grava o que veio.
   *
   * Idempotente por `(tipo, chatproId)`: rodar duas vezes seguidas só atualiza o nome e o
   * carimbo. Devolve quantos itens de cada tipo foram vistos — é o número que prova, no
   * diagnóstico, que este servidor ALCANÇA a API do ChatPro (um catálogo cheio é
   * evidência de rede e de token válido ao mesmo tempo).
   */
  async sincronizar(): Promise<{ departamentos: number; motivos: number; configurado: boolean }> {
    if (!this.cliente.estaConfigurado()) {
      return { departamentos: 0, motivos: 0, configurado: false };
    }

    const [departamentos, motivos] = await Promise.all([
      this.cliente.listarDepartamentos(),
      this.cliente.listarMotivosDeEncerramento(),
    ]);

    const linhas = [
      ...departamentos.map((d) => ({ tipo: 'departamento' as const, ...d })),
      ...motivos.map((m) => ({ tipo: 'motivo_encerramento' as const, ...m })),
    ];

    for (const linha of linhas) {
      await db
        .insert(chatproDiretorio)
        .values({
          tipo: linha.tipo,
          chatproId: linha.id,
          nome: linha.nome,
          sincronizadoEm: new Date(),
        })
        .onConflictDoUpdate({
          target: [chatproDiretorio.tipo, chatproDiretorio.chatproId],
          set: { nome: linha.nome, sincronizadoEm: new Date() },
        });
    }

    return { departamentos: departamentos.length, motivos: motivos.length, configurado: true };
  }

  /**
   * Traduz um UUID. Devolve o PRÓPRIO UUID quando não sabe — nunca `null`, nunca vazio.
   *
   * Devolver o identificador cru é deliberado: um rótulo feio ainda permite procurar no
   * painel qual é a fila. Um campo vazio faz o relatório parecer que o evento não tinha
   * departamento, o que é uma afirmação diferente e falsa.
   */
  async nomeDe(
    tipo: TipoDeDiretorio,
    chatproId: string | null | undefined,
  ): Promise<string | null> {
    const id = chatproId?.trim();
    if (!id) return null;

    const [linha] = await db
      .select({ nome: chatproDiretorio.nome })
      .from(chatproDiretorio)
      .where(and(eq(chatproDiretorio.tipo, tipo), eq(chatproDiretorio.chatproId, id)))
      .limit(1);

    return linha?.nome ?? id;
  }
}
