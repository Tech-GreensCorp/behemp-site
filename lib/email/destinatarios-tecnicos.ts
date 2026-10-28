import type { BrevoClient } from '@getbrevo/brevo';

import { ehEmailTecnicoDeDependente } from '@/lib/dependentes/regras';

/**
 * Nenhum e-mail sai para o endereço técnico de um dependente — ADR-0033 D-04, condição 1.
 *
 * O dependente não tem e-mail (P-04 e P-09 de Dryelle), mas `users.email` é `notNull`, então ele tem um
 * endereço `@dependente.invalid` que NÃO EXISTE. Sem este filtro, o aviso de uma consulta agendada para
 * ele iria a um endereço que nunca entrega, e a falha viria do provedor, no meio do fluxo.
 *
 * ⚠️ POR QUE NO CLIENTE, E NÃO NOS ~14 PONTOS DE CHAMADA: não há um ponto único de envio. Quatro módulos
 * (`brevo`, `consultas`, `comunicados`, `notificacoes`) criam o próprio `BrevoClient`. Filtrar na criação
 * do cliente cobre todo envio, inclusive o que ainda vai ser escrito. O guarda
 * `o-dependente-nao-recebe-aviso-no-endereco-tecnico` falha se uma fábrica ficar sem o filtro.
 *
 * ⚠️ O QUE ISTO **NÃO** FAZ: não manda o aviso ao RESPONSÁVEL. Só impede o envio ao endereço que não
 * existe; o aviso do dependente hoje simplesmente não sai. Roteá-lo ao responsável (P-09: "só o
 * responsável") é o `destinatarioDoPaciente`, que ainda NÃO foi feito.
 */

type Destinatario = { email: string };

/** A lista sem os endereços técnicos. `undefined` continua `undefined`. */
export function semEnderecosTecnicos<T extends Destinatario>(
  lista: T[] | undefined,
): T[] | undefined {
  if (!lista) return lista;
  return lista.filter((d) => !ehEmailTecnicoDeDependente(d.email));
}

type CorpoComDestinatarios = {
  to?: Destinatario[];
  cc?: Destinatario[];
  bcc?: Destinatario[];
};

/**
 * Devolve o corpo sem os destinatários técnicos, ou `null` se não restou NENHUM destinatário em `to`
 * (aí não há o que enviar).
 */
export function corpoSemEnderecosTecnicos<C extends CorpoComDestinatarios>(corpo: C): C | null {
  const to = semEnderecosTecnicos(corpo.to);
  if (!to || to.length === 0) return null;
  return { ...corpo, to, cc: semEnderecosTecnicos(corpo.cc), bcc: semEnderecosTecnicos(corpo.bcc) };
}

/**
 * Embrulha o cliente do Brevo: `transactionalEmails.sendTransacEmail` passa a descartar o endereço técnico.
 * Todo o resto do cliente segue intacto.
 */
export function comFiltroDeDestinatarios<C extends BrevoClient>(cliente: C): C {
  return new Proxy(cliente, {
    get(alvo, prop, receptor) {
      const valor = Reflect.get(alvo, prop, receptor);
      if (prop !== 'transactionalEmails' || typeof valor !== 'object' || valor === null)
        return valor;
      return new Proxy(valor, {
        get(alvoTx, propTx, receptorTx) {
          const f = Reflect.get(alvoTx, propTx, receptorTx);
          if (typeof f !== 'function') return f;
          if (propTx !== 'sendTransacEmail') return f.bind(alvoTx);
          return async (corpo: CorpoComDestinatarios, ...resto: unknown[]) => {
            const limpo = corpoSemEnderecosTecnicos(corpo);
            if (!limpo) {
              // Sem PII: só o fato.
              console.warn(
                '[email] envio descartado: o único destinatário é o endereço técnico de um dependente',
              );
              return undefined;
            }
            return f.call(alvoTx, limpo, ...resto);
          };
        },
      });
    },
  });
}
