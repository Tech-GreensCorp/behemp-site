/**
 * Normalização de telefone vindo do WhatsApp/ChatPro.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Todo telefone que chega do ChatPro vem com o sufixo `@s.whatsapp.net` — é a armadilha nº 3
 * do dossiê de integração, e ela derruba qualquer comparação ingênua: `5562999999999` e
 * `5562999999999@s.whatsapp.net` são o mesmo número e strings diferentes.
 *
 * E a normalização brasileira não é trivial: DDI 55, DDD de dois dígitos e o nono dígito que
 * existe em celular e não em fixo. Errar aqui não é erro de formato — é o link de cadastro
 * indo para o número errado, ou a idempotência falhando e o paciente recebendo dois links.
 *
 * Por isso usamos `libphonenumber-js`, a mesma biblioteca já validada em produção no
 * greens-corp, em vez de escrever a regra à mão.
 *
 * 🔴 LGPD: telefone é dado pessoal. `mascararTelefone` existe para que nenhum log desta
 * aplicação carregue o número inteiro.
 *
 * 🛑 Módulo PURO — sem `db`, sem `auth`, sem `next/*`.
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Remove o sufixo do WhatsApp: `5562999999999@s.whatsapp.net` → `5562999999999`.
 *
 * Também serve para `@g.us` (grupo) e `@c.us`, que aparecem em outras versões da API.
 */
export function removerSufixoWhatsapp(valor: string | null | undefined): string {
  return (valor ?? '').trim().split('@')[0].trim();
}

/**
 * Normaliza para E.164 (`+5562999999999`), ou devolve `null` quando o número não é válido.
 *
 * Aceita com ou sem sufixo, com ou sem DDI, com ou sem máscara. Devolver `null` em vez de
 * um palpite é deliberado: número inválido que "quase" funciona cria solicitação órfã, e o
 * paciente nunca recebe o link.
 */
export function normalizarTelefoneWhatsapp(
  valor: string | null | undefined,
  pais: 'BR' = 'BR',
): string | null {
  const cru = removerSufixoWhatsapp(valor);
  if (!cru) return null;

  const digitos = cru.replace(/\D/g, '');
  if (!digitos) return null;

  // Já veio com `+`: o DDI é explícito, respeita.
  if (cru.startsWith('+')) {
    const analisado = parsePhoneNumberFromString(cru, pais);
    return analisado?.isValid() ? analisado.number : null;
  }

  // 🔴 SEM `+`, A ORDEM IMPORTA — e errá-la manda o link para outro país.
  //
  // Prefixar `+` aos dígitos faz o parser ler os primeiros como DDI. Para o número
  // brasileiro `(62) 99999-7197`, isso vira `+62999997197` — e **62 é a Indonésia**. O
  // paciente receberia o link num número inexistente, e a idempotência passaria a comparar
  // chaves erradas.
  //
  // Por isso tenta-se primeiro como número NACIONAL, deixando a biblioteca aplicar o DDI do
  // país. Só se isso falhar é que se tenta com `+` — o caso de quem mandou o DDI sem o sinal.
  for (const candidato of [digitos, `+${digitos}`]) {
    const analisado = parsePhoneNumberFromString(candidato, pais);
    if (analisado?.isValid()) return analisado.number;
  }

  return null;
}

/**
 * Mascara para log: `+5562999999999` → `+556****9999`.
 *
 * 🔴 Nenhum log desta aplicação deve conter telefone completo. Identificadores (protocolo,
 * id de lead, id de sessão) podem ser logados; o número não.
 */
export function mascararTelefone(valor?: string | null): string {
  const cru = removerSufixoWhatsapp(valor);
  if (!cru) return '';
  if (cru.length <= 8) return `${cru.slice(0, 2)}****`;
  return `${cru.slice(0, 4)}****${cru.slice(-4)}`;
}

/** Mesma ideia para e-mail: `maria.souza@gmail.com` → `ma***@gmail.com`. */
export function mascararEmail(valor?: string | null): string {
  const cru = (valor ?? '').trim();
  if (!cru.includes('@')) return cru ? '***' : '';
  const [usuario, dominio] = cru.split('@');
  const visivel = usuario.slice(0, 2);
  return `${visivel}***@${dominio}`;
}

/**
 * A CHAVE DE BUSCA DE UM TELEFONE — só os dígitos, e só os últimos 8.
 *
 * ⚠️ MORA AQUI, e não junto da consulta que a usa, por uma regra do projeto: helper de
 * domínio é puro — sem `db`, sem `auth`, sem `next/*`. Quando ela estava no módulo que
 * consulta o banco, o guarda que a testa arrastava a conexão do Neon no import e não
 * rodava.
 *
 * ⚠️ OITO E NÃO ONZE, de propósito: é o que sobra depois de DDI, DDD e o nono dígito —
 * as três partes que variam entre os formatos que temos gravados. Comparar os últimos 8
 * casa `+5562999997197`, `62999997197` e até `6299997197` (o antigo, sem o 9).
 *
 * O preço é o falso positivo: dois números de estados diferentes podem terminar iguais.
 * Aceitável **porque isto não decide** — apenas apresenta um candidato para conferência.
 */
export function chaveDeBusca(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  return digitos.length >= 8 ? digitos.slice(-8) : null;
}
