import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { baseColumns } from './_helpers';
import { chatproDiretorioTipoEnum } from './enums';

/**
 * DIRETÓRIO DO CHATPRO — a tradução de UUID para nome legível.
 *
 * POR QUE ESTA TABELA EXISTE
 * Os webhooks do ChatPro identificam departamento e motivo de encerramento por UUID.
 * Sem tradução, o funil registraria `d3457174-7342-46f0-9725-a8f8c9a19002` no lugar de
 * "Aguardando Autorização Anvisa" — e ninguém consegue ler um relatório assim.
 *
 * POR QUE NO BANCO, E NÃO NUMA CONSTANTE NO CÓDIGO
 * Os UUIDs são da CONTA, não do produto: mudam quando a operação cria uma fila nova ou
 * renomeia um motivo, sem deploy nenhum. Uma constante congelaria em 25/08 a lista que a
 * chefia edita no painel toda semana. A tabela é cache, não fonte: a fonte é a API.
 *
 * ⚠️ NÃO GUARDA DADO PESSOAL. São nomes de fila e de motivo — configuração da conta.
 * Por isso pode ser lida sem escopo de paciente.
 */
export const chatproDiretorio = pgTable(
  'chatpro_diretorio',
  {
    ...baseColumns,

    tipo: chatproDiretorioTipoEnum('tipo').notNull(),
    /** O UUID como o ChatPro o emite. É a chave que chega no webhook. */
    chatproId: text('chatpro_id').notNull(),
    nome: text('nome').notNull(),
    /**
     * Quando este par (uuid → nome) foi confirmado contra a API pela última vez.
     * Um nome antigo continua valendo — melhor um rótulo desatualizado que um UUID cru.
     */
    sincronizadoEm: timestamp('sincronizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('chatpro_diretorio_tipo_id_idx').on(t.tipo, t.chatproId)],
);
