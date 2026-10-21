/**
 * CIFRA EM REPOUSO — AES-256-GCM. É a PRIMEIRA deste repositório.
 *
 * 🔴 NÃO HAVIA PADRÃO, e isto não é suposição: medido em 22/09/2026, `grep -rniE
 * "encrypt|decrypt|cipher|AES|pgcrypto"` em `db/` e `lib/` devolve **zero linhas**, e a única
 * dependência de cripto no `package.json` é o `jose`, usado só para assinar o JWT do DocuSign.
 * O que existe de `node:crypto` é HMAC e hash — `lib/parceiros/assinatura.ts`,
 * `lib/chatpro/segredo.ts` —, que provam origem e integridade e **não escondem conteúdo**.
 *
 * ⚠️ E existe uma afirmação falsa no schema que este módulo NÃO corrige:
 * `db/schema/medicos.ts:27` guarda o refresh token do Google com o comentário
 * `// Criptografado em produção`, e os 13 pontos que leem ou escrevem essa coluna passam o
 * valor cru. Corrigir aquilo é trabalho próprio, em commit próprio, como manda a seção
 * "Achado de segurança em código existente" de `.claude/rules/seguranca-lgpd.md`.
 *
 * ## Por que GCM, e não CBC
 *
 * GCM é cifra **autenticada** (AEAD): além de esconder, ele prova que o texto cifrado não foi
 * alterado. Com CBC, quem tem acesso de escrita ao banco pode alterar bytes do cifrado e o
 * `decifrar` devolve lixo **sem erro** — e lixo silencioso num token é pior que erro, porque
 * vira falha na integração com o Mercado Pago sem ninguém saber por quê. Aqui, um byte trocado
 * faz o `decipher.final()` LANÇAR, que é o comportamento que se quer.
 *
 * ## Por que um IV novo a cada operação
 *
 * O NIST SP 800-38D é explícito: reusar par (chave, IV) em GCM **destrói a segurança** do
 * modo — dois textos cifrados com o mesmo par vazam o XOR dos claros, e a chave de
 * autenticação fica recuperável. Por isso o IV é sorteado a cada `cifrar()` e viaja junto do
 * resultado; ele não é segredo, é um número que não se repete.
 *
 * 12 bytes (96 bits) é o tamanho que a mesma especificação recomenda para GCM — é o que o
 * modo usa direto, sem a derivação extra que outros tamanhos exigem.
 *
 * ## O formato do que sai
 *
 *     v1.<base64url(iv ‖ authTag ‖ cifrado)>
 *
 * O prefixo de versão existe para o dia da rotação: quando `v2` precisar de outro algoritmo ou
 * de outra chave, `decifrar` sabe qual caminho seguir e as linhas antigas continuam legíveis.
 * Sem prefixo, migrar exigiria adivinhar pelo tamanho — e adivinhar formato é como se perde
 * dado cifrado.
 *
 * ## Falha FECHADA, sempre
 *
 * Sem `MERCADOPAGO_TOKEN_ENCRYPTION_KEY` no ambiente, `cifrar` LANÇA. Nunca devolve o texto
 * claro, nunca cai num padrão. É o mesmo desenho de `lib/documentos/store-privado.ts`, e pelo
 * mesmo motivo: credencial não degrada para "sem proteção" porque faltou configuração.
 *
 * ## Como gerar a chave
 *
 *     openssl rand -hex 32 > ~/.mp-token-key && chmod 600 ~/.mp-token-key
 *     tr -d '\n' < ~/.mp-token-key | gh secret set MERCADOPAGO_TOKEN_ENCRYPTION_KEY --repo Tech-GreensCorp/behemp-site
 *
 * O `tr -d '\n'` não é detalhe: sem ele o segredo cadastrado tem uma quebra de linha a mais, e
 * a chave deixa de ter 32 bytes. É o mesmo cuidado que o `CLAUDE.md` documenta para os HMACs.
 *
 * 🔴 PERDER A CHAVE É PERDER OS DADOS. Não há recuperação — cada médico precisaria reconectar
 * a conta do Mercado Pago. Rotacionar exige decifrar com a antiga e recifrar com a nova, e é
 * por isso que o formato carrega versão desde o primeiro dia.
 *
 * 🛑 Módulo PURO — sem `db`, sem `auth`, sem `next/*`. Convenção de `lib/<dominio>/`.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** O algoritmo, num lugar só. Muda junto com a versão do formato, nunca sozinho. */
const ALGORITMO = 'aes-256-gcm';

/** Prefixo de versão do formato. Ver "O formato do que sai" acima. */
const VERSAO = 'v1';

/** 96 bits — o tamanho recomendado pelo NIST SP 800-38D para GCM. */
const TAMANHO_IV = 12;

/** 128 bits — o tamanho padrão da etiqueta de autenticação do GCM. */
const TAMANHO_TAG = 16;

/** AES-256 exige exatamente 32 bytes de chave. */
const TAMANHO_CHAVE = 32;

/** Lançada quando a chave não está no ambiente, ou não serve. */
export class CifraNaoConfigurada extends Error {
  constructor(detalhe: string) {
    super(
      `MERCADOPAGO_TOKEN_ENCRYPTION_KEY ${detalhe} — nada foi cifrado nem decifrado. ` +
        'Credencial de terceiro não é gravada em texto puro; ver lib/seguranca/cifra.ts',
    );
    this.name = 'CifraNaoConfigurada';
  }
}

/** Lançada quando o texto cifrado não tem o formato esperado, ou foi adulterado. */
export class TextoCifradoInvalido extends Error {
  constructor(motivo: string) {
    super(`Texto cifrado inválido: ${motivo}. Ver lib/seguranca/cifra.ts`);
    this.name = 'TextoCifradoInvalido';
  }
}

/**
 * A chave, validada.
 *
 * ⚠️ Lida a cada chamada, de propósito: assim rotacionar o secret e reiniciar o processo basta,
 * sem um módulo guardando o valor antigo numa constante de topo. É também o que permite
 * testar sem recarregar o módulo.
 */
function chave(): Buffer {
  const bruto = process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY?.trim();
  if (!bruto) throw new CifraNaoConfigurada('ausente');

  if (!/^[0-9a-fA-F]{64}$/.test(bruto)) {
    // A mensagem diz o TAMANHO recebido, nunca o valor — erro de configuração não vira vazamento.
    throw new CifraNaoConfigurada(
      `não é hexadecimal de 64 caracteres (recebi ${bruto.length}); gere com \`openssl rand -hex 32\``,
    );
  }

  const chaveBin = Buffer.from(bruto, 'hex');
  if (chaveBin.length !== TAMANHO_CHAVE) {
    throw new CifraNaoConfigurada(`decodifica para ${chaveBin.length} bytes, e AES-256 exige 32`);
  }
  return chaveBin;
}

/**
 * Cifra um texto. O resultado é seguro para guardar em coluna `text`.
 *
 * Cada chamada sorteia um IV novo — cifrar o MESMO texto duas vezes devolve resultados
 * diferentes, e isso é correto: resultado igual revelaria que os dois valores são iguais.
 */
export function cifrar(texto: string): string {
  if (typeof texto !== 'string' || texto.length === 0) {
    throw new TextoCifradoInvalido('nada a cifrar — texto vazio');
  }

  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, chave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${VERSAO}.${Buffer.concat([iv, tag, cifrado]).toString('base64url')}`;
}

/**
 * Decifra o que `cifrar` produziu.
 *
 * 🔴 LANÇA quando o conteúdo foi adulterado — é o GCM conferindo a etiqueta de autenticação, e
 * é a razão de o modo ser este. Nunca devolve texto parcial ou lixo.
 */
export function decifrar(textoCifrado: string): string {
  if (typeof textoCifrado !== 'string' || textoCifrado.length === 0) {
    throw new TextoCifradoInvalido('nada a decifrar — texto vazio');
  }

  const separador = textoCifrado.indexOf('.');
  if (separador === -1) throw new TextoCifradoInvalido('sem prefixo de versão');

  const versao = textoCifrado.slice(0, separador);
  if (versao !== VERSAO) throw new TextoCifradoInvalido(`versão desconhecida "${versao}"`);

  const corpo = Buffer.from(textoCifrado.slice(separador + 1), 'base64url');
  if (corpo.length <= TAMANHO_IV + TAMANHO_TAG) {
    throw new TextoCifradoInvalido('curto demais para conter IV, etiqueta e conteúdo');
  }

  const iv = corpo.subarray(0, TAMANHO_IV);
  const tag = corpo.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG);
  const cifrado = corpo.subarray(TAMANHO_IV + TAMANHO_TAG);

  const decipher = createDecipheriv(ALGORITMO, chave(), iv);
  decipher.setAuthTag(tag);

  // `final()` lança "Unsupported state or unable to authenticate data" se a etiqueta não bater.
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
}

/** `true` quando a chave está configurada — para uma tela dizer "não configurado" sem lançar. */
export function cifraConfigurada(): boolean {
  try {
    chave();
    return true;
  } catch {
    return false;
  }
}
