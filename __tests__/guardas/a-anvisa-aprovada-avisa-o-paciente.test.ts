/**
 * GUARDA — a aprovação da ANVISA chega ao paciente por canal que sobrevive à aba fechada.
 *
 * A CLASSE DE ERRO, medida em 11/09/2026: `app/api/anvisa/atualizar-status/route.ts` avisava
 * **só pelo Pusher**. Pusher é tempo real — quem não estava com a aba aberta no instante da
 * aprovação nunca soube. O passo 7 do fluxo Greens 1 pede _"notificação email, celular e no
 * sistema"_, e existia um terço disso.
 *
 * 🔴 UM AVISO QUE SÓ FUNCIONA PARA QUEM ESTÁ OLHANDO não é aviso: é confirmação. A diferença
 * aparece exatamente no caso que importa — a autorização demora semanas, e ninguém fica com a
 * aba aberta esperando.
 *
 * As quatro coisas que não podem regredir:
 *
 *   1. **A linha em `notificacoes` vem primeiro.** É o único canal que não depende de
 *      terceiro: com o Brevo fora, o paciente ainda encontra o aviso ao entrar.
 *   2. **Avisar NUNCA derruba a aprovação.** O fato já foi gravado; um provedor de e-mail
 *      fora do ar não pode desfazê-lo. É a mesma regra do aviso ao parceiro.
 *   3. **Nada clínico no e-mail.** Nem medicamento, nem dosagem, nem CID — e-mail atravessa
 *      servidores que não controlamos.
 *   4. **O e-mail do paciente não entra em log.** É dado pessoal, e log de erro é lido por
 *      muita gente.
 *
 * ⚠️ E O WHATSAPP CONTINUA FALTANDO, DE PROPÓSITO. `lib/chatpro/cliente.ts` não tem método de
 * envio, e o endpoint de envio ativo não existe em nenhum dos dois repositórios — a única
 * ocorrência é o valor de enum `v5_send_message` no `greens-corp-backend`, sem implementação.
 * Deduzir o path daria um envio que falha em silêncio, que é pior que canal ausente. Há caso
 * abaixo que fica vermelho se alguém inventar o endpoint.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function ler(c: string): string {
  return readFileSync(path.join(process.cwd(), c), 'utf8');
}
function semComentarios(f: string): string {
  return f
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
}

const aviso = semComentarios(ler('lib/anvisa/avisar-aprovacao.ts'));
const rota = semComentarios(ler('app/api/anvisa/atualizar-status/route.ts'));
const emails = semComentarios(ler('lib/email/notificacoes.ts'));

// ─────────────────────────────────────────────────────────────────────────────
describe('a rota chama o aviso quando aprova', () => {
  it('o aviso é disparado', () => {
    expect(rota).toContain('avisarAnvisaAprovada(');
  });

  it('🔴 só quando o status é "aprovado" — nem toda mudança é boa notícia', () => {
    const bloco = rota.slice(rota.indexOf("if (status === 'aprovado'"));
    expect(bloco.indexOf('avisarAnvisaAprovada(')).toBeGreaterThan(0);
    expect(bloco.indexOf('avisarAnvisaAprovada(')).toBeLessThan(
      bloco.indexOf('// Notificar paciente via Pusher') === -1
        ? bloco.length
        : bloco.indexOf('// Notificar paciente via Pusher'),
    );
  });

  it('o número do processo é repassado', () => {
    expect(rota).toMatch(/numeroProcesso: numeroProcesso/);
  });

  it('e o Pusher continua — ele é o canal imediato, não o substituto', () => {
    expect(rota).toContain('anvisa:status-atualizado');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('os canais que sobrevivem à aba fechada', () => {
  it('grava linha em notificacoes', () => {
    expect(aviso).toContain('db.insert(notificacoes)');
  });

  it('🔴 a notificação no sistema vem ANTES do e-mail', () => {
    const iSistema = aviso.indexOf('db.insert(notificacoes)');
    const iEmail = aviso.indexOf('enviarEmailAnvisaAprovada(');
    expect(iSistema).toBeGreaterThan(0);
    expect(iEmail).toBeGreaterThan(iSistema);
  });

  it('a notificação leva o caminho de ação', () => {
    expect(aviso).toMatch(/linkAcao: '\/paciente\/anvisa'/);
  });

  it('envia o e-mail', () => {
    expect(aviso).toContain('enviarEmailAnvisaAprovada(');
    expect(emails).toContain('export async function enviarEmailAnvisaAprovada');
  });

  it('sem endereço não tenta — e isso não é erro', () => {
    expect(aviso).toMatch(/if \(destinatario\.email\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('avisar nunca derruba a aprovação', () => {
  it('o módulo devolve resultado em vez de lançar', () => {
    expect(aviso).toMatch(/Promise<ResultadoDoAviso>/);
    expect(aviso).not.toMatch(/^\s*throw /m);
  });

  it('cada canal tem o próprio try — um não leva o outro', () => {
    const blocos = aviso.match(/try \{/g) ?? [];
    expect(blocos.length).toBeGreaterThanOrEqual(3);
  });

  it('🔴 a falha de um canal não impede o outro de ser tentado', () => {
    // O `catch` da notificação não pode conter `return`: isso pularia o e-mail.
    const i = aviso.indexOf('falha ao gravar notificação');
    const bloco = aviso.slice(i, i + 200);
    expect(bloco).not.toMatch(/return/);
  });

  it('e o resultado diz o que de fato saiu, em vez de afirmar sucesso', () => {
    expect(aviso).toContain('noSistema: boolean');
    expect(aviso).toContain('porEmail: boolean');
    expect(aviso).toMatch(/resultado\.noSistema = true/);
    expect(aviso).toMatch(/resultado\.porEmail = true/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o que o aviso NÃO carrega', () => {
  const corpoDoEmail = emails.slice(
    emails.indexOf('export async function enviarEmailAnvisaAprovada'),
  );

  it('🔴 nada clínico no e-mail', () => {
    for (const proibido of [
      'dosagem',
      'posologia',
      'cid',
      'diagnostic',
      'medicament',
      'canabinoide',
      'thc',
      'cbd',
    ]) {
      expect(new RegExp(proibido, 'i').test(corpoDoEmail), `${proibido} no e-mail`).toBe(false);
    }
  });

  it('🔴 o e-mail do paciente não entra em log', () => {
    const logs = aviso.match(/console\.\w+\([^;]*\)/g) ?? [];
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) {
      expect(l).not.toContain('destinatario.email');
      expect(l).not.toContain('emailPaciente');
    }
  });

  it('nem o nome do paciente', () => {
    const logs = aviso.match(/console\.\w+\([^;]*\)/g) ?? [];
    for (const l of logs) expect(l).not.toContain('destinatario.nome');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o WhatsApp fica de fora, e o motivo fica escrito', () => {
  /**
   * ⚠️ ESTE CASO OLHA O COMENTÁRIO de propósito — é a exceção à regra de "menção vs uso".
   * O que ele protege é a decisão de NÃO deduzir um endpoint, e uma decisão dessas some
   * silenciosamente se ninguém escrever por que ela existe.
   */
  it('o motivo de o WhatsApp não entrar está registrado no módulo', () => {
    const fonte = ler('lib/anvisa/avisar-aprovacao.ts');
    expect(fonte).toMatch(/v5_send_message/);
    expect(fonte).toMatch(/n[ãa]o tem m[ée]todo de envio/i);
  });

  it('🔴 e ninguém inventou o endpoint: o cliente do ChatPro continua sem envio', () => {
    const cliente = semComentarios(ler('lib/chatpro/cliente.ts'));
    // Se alguém acrescentar envio, que seja com doc — e este caso é onde a conversa começa.
    expect(cliente).not.toMatch(/send_message|sendMessage|enviarMensagem/i);
  });
});
