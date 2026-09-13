/**
 * A SENTINELA — em que ponto do fluxo esta pessoa está, e por quê.
 *
 * 🔴 ADR-0022, D-05 a D-07 e D-12. É a peça que serve aos quatro fluxos da Greens, e o pedido
 * do dono que a originou: _"o certo é criarmos uma sentinela que é capaz de monitorar isso e
 * entregar a tela certa para cada usuário"_.
 *
 * ## O problema que ela resolve
 *
 * A BeHemp tratava "conta criada" e "cadastro concluído" como a mesma coisa — **e não são**.
 * Entre os dois existe um vão onde o paciente cai, e ninguém olhava para dentro dele. Foi onde
 * o dono caiu em 12/09: conta funcionando, painel vazio, documentos invisíveis, e o link ainda
 * válido. As três coisas verdadeiras ao mesmo tempo, e nenhuma tela ligando uma à outra.
 *
 * ⚠️ E A DECISÃO ESTAVA ESPALHADA: `/redirect` decidia papel, `destinoDepoisDoCadastro` decidia
 * destino, o painel decidia avisos — e nenhum via o quadro inteiro. Foi assim que a ficha casca
 * do `/redirect` (G2) passou a mentir para todos os outros.
 *
 * ## O que ela NÃO é
 *
 * 🔴 **Não é um orquestrador de saga.** A primeira leitura da literatura dizia que sim; a
 * segunda mostrou que saga serve para serviços com **bancos próprios**, e dentro da BeHemp está
 * tudo num Postgres só (§15.3, D-12). Saga aqui traria a parte cara — _"falta de rollback
 * automático e de isolamento"_ — sem o problema que ela resolve.
 *
 * **É uma máquina de estados**: lê o estado consolidado e diz o ponto.
 *
 * ## Por que devolve o PORQUÊ
 *
 * ⚠️ D-06, e a razão é concreta: em 12/09 o aviso de cadastro pendente **sumiu da tela** e não
 * havia como saber qual das três condições o barrou. Um estado que depende de várias condições
 * precisa dizer **qual** decidiu — senão o diagnóstico vira adivinhação, que já custou dois
 * deploys neste projeto.
 */

import { and, desc, eq, gt, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { documentos, pacientes, solicitacoesCadastro, users } from '@/db/schema';

/**
 * Os pontos possíveis do fluxo.
 *
 * ⚠️ `completo_legado` existe por exigência do dono (R9): _"usuários antigos que já possuem a
 * conta criada não terão esse bloqueio"_. Sem esse ramo, a sentinela trataria todo paciente
 * anterior a esta mudança como cadastro pela metade — e o pior erro possível aqui seria
 * bloquear quem já está em tratamento.
 */
export type PontoDoFluxo =
  | 'completo'
  | 'completo_legado'
  | 'sem_conta'
  | 'ficha_ausente'
  | 'cadastro_pendente'
  | 'documentos_nao_materializados';

export interface Situacao {
  ponto: PontoDoFluxo;
  /** Por que este ponto, em uma frase. Sem isto, o G6 se repete. */
  porque: string;
  /** Para onde levar, quando há caminho. `null` quando não há o que fazer. */
  destino: string | null;
  /** De onde esta pessoa veio, quando se sabe. `null` = ficha anterior à procedência. */
  origem: string | null;
}

/**
 * Em que ponto do fluxo está quem tem este `clerkId`.
 *
 * ⚠️ SÓ LÊ. Não cria ficha, não consome link, não decide destino final — devolve o ponto para
 * quem chamou decidir. Uma sentinela que escreve vira mais um dos sete criadores de ficha
 * (ADR-0022 §16), que é o problema que ela existe para resolver.
 */
export async function situacaoDoFluxo(clerkId: string | null | undefined): Promise<Situacao> {
  if (!clerkId) {
    return { ponto: 'sem_conta', porque: 'não há sessão', destino: '/entrar', origem: null };
  }

  const [pessoa] = await db
    .select({
      userId: users.id,
      email: users.email,
      pacienteId: pacientes.id,
      origem: pacientes.origem,
      solicitacaoId: pacientes.solicitacaoId,
    })
    .from(users)
    .leftJoin(pacientes, and(eq(pacientes.userId, users.id), isNull(pacientes.deletedAt)))
    .where(and(eq(users.clerkId, clerkId), isNull(users.deletedAt)))
    .limit(1);

  if (!pessoa) {
    /**
     * Conta no Clerk sem linha em `users`. Acontece quando o webhook ainda não chegou — ele é
     * assíncrono. Não é erro: é cedo.
     */
    return {
      ponto: 'sem_conta',
      porque: 'a conta existe no Clerk, mas ainda não chegou ao nosso banco',
      destino: null,
      origem: null,
    };
  }

  /**
   * 🔴 A SOLICITAÇÃO ABERTA É O QUE SEPARA "CADASTRO PELA METADE" DE "CADASTRO FEITO".
   *
   * Casa pelo e-mail porque a solicitação nasce **antes** da conta: quando a Greens a cria,
   * não existe `clerkId` nem `pacienteId` para amarrar.
   */
  const [pendente] = await db
    .select({
      protocolo: solicitacoesCadastro.protocolo,
      origem: solicitacoesCadastro.origem,
    })
    .from(solicitacoesCadastro)
    .where(
      and(
        eq(solicitacoesCadastro.email, pessoa.email.toLowerCase()),
        isNull(solicitacoesCadastro.usadoEm),
        gt(solicitacoesCadastro.expiraEm, new Date()),
        isNull(solicitacoesCadastro.pacienteId),
      ),
    )
    .orderBy(desc(solicitacoesCadastro.createdAt))
    .limit(1);

  if (!pessoa.pacienteId) {
    return pendente
      ? {
          ponto: 'cadastro_pendente',
          porque: `há uma solicitação aberta (${pendente.protocolo}) e a ficha ainda não foi criada`,
          destino: null,
          origem: pendente.origem,
        }
      : {
          /**
           * Sem ficha e sem solicitação: é a casca do `/redirect` (G2), ou alguém que chegou
           * por outro caminho. Não é erro do paciente, e não se bloqueia.
           */
          ponto: 'ficha_ausente',
          porque: 'a conta existe, e não há ficha nem solicitação aberta',
          destino: '/paciente/perfil',
          origem: null,
        };
  }

  if (pendente) {
    return {
      ponto: 'cadastro_pendente',
      porque: `há uma solicitação aberta (${pendente.protocolo}) que ainda não foi concluída`,
      destino: null,
      origem: pessoa.origem ?? pendente.origem,
    };
  }

  /**
   * 🔵 FICHA SEM PROCEDÊNCIA É LEGADO — R9, D-07.
   *
   * `null` aqui significa "criada antes de a procedência existir", **não** "origem
   * desconhecida". Bloquear quem já está em tratamento seria o pior erro possível desta
   * função, e é por isso que o ramo vem antes de qualquer verificação de documento.
   */
  if (!pessoa.origem) {
    return {
      ponto: 'completo_legado',
      porque: 'ficha anterior à procedência — nada a cobrar',
      destino: null,
      origem: null,
    };
  }

  /**
   * 🔴 O QUE O PARCEIRO ENTREGOU E NÃO CHEGOU — R6.
   *
   * Se a ficha veio de uma solicitação com documentos e nenhum deles virou linha, a
   * materialização falhou em silêncio (`materializar-documentos.ts` devolve `{inseridos: 0}`).
   * O painel dizia "0 enviados", que é verdade sobre o banco e **mentira sobre o mundo**.
   */
  if (pessoa.solicitacaoId) {
    const [origemDaFicha] = await db
      .select({ documentosDoParceiro: solicitacoesCadastro.documentosDoParceiro })
      .from(solicitacoesCadastro)
      .where(eq(solicitacoesCadastro.id, pessoa.solicitacaoId))
      .limit(1);

    const manifesto = origemDaFicha?.documentosDoParceiro;
    const prometidos = Array.isArray(manifesto) ? manifesto.length : 0;

    if (prometidos > 0) {
      const chegaram = await db
        .select({ id: documentos.id })
        .from(documentos)
        .where(and(eq(documentos.pacienteId, pessoa.pacienteId), isNull(documentos.deletedAt)))
        .limit(1);

      if (chegaram.length === 0) {
        return {
          ponto: 'documentos_nao_materializados',
          porque: `o parceiro enviou ${prometidos} documento(s) e nenhum chegou à ficha`,
          destino: '/paciente/documentos',
          origem: pessoa.origem,
        };
      }
    }
  }

  return {
    ponto: 'completo',
    porque: 'conta, ficha e documentos no lugar',
    destino: null,
    origem: pessoa.origem,
  };
}
