'use server';

/**
 * QUAIS DOCUMENTOS O PACIENTE TEM, E COM QUE `id` — para a tela poder mostrá-los.
 *
 * 🔴 POR QUE ISTO EXISTE, e a alternativa que foi REJEITADA.
 *
 * O checklist da tela da ANVISA vive num JSON dentro de `autorizacoes_anvisa.documentos`, e
 * esse JSON guarda `tipo`, `enviado`, `urlBlob` e `nomeArquivo` — **não guarda o `id`** da
 * linha em `documentos`. Sem `id` não há como chamar `GET /api/documentos/{id}/arquivo`, que
 * é a única porta que autentica, confere escopo de objeto e audita.
 *
 * **Rejeitado: acrescentar o `id` ao JSON quando o checklist é montado.** Resolveria para as
 * autorizações criadas dali em diante, e deixaria **sem botão** todas as que já existem — que
 * são justamente as que alguém quer conferir hoje. Seria preciso uma migration de dado para
 * corrigir o passado, e migration de dado para resolver leitura é trabalho em cima de sintoma.
 *
 * **O que se faz aqui:** perguntar à TABELA, que é a fonte de verdade, no momento de mostrar.
 * Funciona igual para o JSON antigo e o novo, porque não depende dele. É a mesma lição que já
 * custou caro neste projeto: _o JSON diz o que foi gravado; só a tabela diz o que existe._
 *
 * ## As três perguntas do `.claude/rules/seguranca-lgpd.md`
 *
 * 1. **Quem pode ler?** Só o próprio paciente, e o vínculo é resolvido pela SESSÃO — nunca por
 *    um id que venha do cliente. Não existe parâmetro de paciente nesta action, de propósito:
 *    o que não é recebido não pode ser trocado (OWASP API1/BOLA).
 * 2. **Quanto tempo fica?** Nada é guardado. A resposta é derivada, e não carrega `urlBlob`.
 * 3. **O acesso é auditado?** Aqui não há acesso a auditar — isto devolve **metadado**
 *    (id, tipo, nome do arquivo), não bytes. A auditoria acontece quando alguém ABRE o
 *    arquivo, na rota, e é lá que ela pertence.
 *
 * ⚠️ **`urlBlob` NÃO SAI DAQUI.** Ele existe na linha e seria trivial incluir no retorno — e
 * com documento antigo (blob público) isso entregaria RG e procuração assinada a qualquer um
 * que lesse a resposta da action no navegador, sem autenticação e sem registro. O tipo de
 * retorno não tem o campo, e é essa a garantia.
 */

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { documentos, pacientes, users } from '@/db/schema';
import { obterUsuarioAtual } from '@/lib/auth';

/** O que a tela precisa para desenhar o botão — e nada além disso. */
export interface DocumentoVisivel {
  id: string;
  tipo: string;
  nomeArquivo: string | null;
}

/**
 * Os documentos do paciente da sessão.
 *
 * Devolve lista vazia quando não há sessão, quando a sessão não tem ficha de paciente, ou
 * quando não há documento nenhum — os três são "não há o que mostrar", e a tela trata igual.
 * Falha fechada: nenhum deles vira erro na cara do paciente.
 */
export async function documentosDoPacienteAtual(): Promise<DocumentoVisivel[]> {
  const sessao = await obterUsuarioAtual();
  if (!sessao.autorizado || !sessao.clerkId) return [];

  /**
   * 🔴 O PACIENTE SAI DA SESSÃO, e o caminho é `users.clerk_id` → `pacientes.user_id`.
   *
   * Não há parâmetro de paciente nesta função, e é essa a proteção: o que não é recebido não
   * pode ser trocado. Um `pacienteId` vindo do cliente é OWASP API1 (BOLA) por um caminho
   * novo, e é o risco número um deste projeto.
   */
  const linhas = await db
    .select({
      id: documentos.id,
      tipo: documentos.tipo,
      nomeArquivo: documentos.nomeArquivo,
    })
    .from(documentos)
    .innerJoin(pacientes, eq(documentos.pacienteId, pacientes.id))
    .innerJoin(users, eq(pacientes.userId, users.id))
    .where(
      and(
        eq(users.clerkId, sessao.clerkId),
        // Documento apagado não volta a aparecer por uma tela nova.
        isNull(documentos.deletedAt),
      ),
    );

  return linhas.map((l) => ({
    id: l.id,
    tipo: String(l.tipo),
    nomeArquivo: l.nomeArquivo,
  }));
}
