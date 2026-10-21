/**
 * O TEXTO QUE O PACIENTE LÊ NO WHATSAPP.
 *
 * 🔴 ISTO NÃO É PAYLOAD — É A MENSAGEM.
 * O bloco "Requisição externa" do painel do ChatPro entrega **o corpo da resposta HTTP**
 * diretamente na conversa. Não há template no painel, não há markdown: cada linha escrita
 * aqui aparece literalmente na tela do paciente.
 *
 * Por isso o texto mora numa função pura, fora do serviço: mudar uma frase não deveria
 * exigir banco, sessão do ChatPro nem simulação de chamada externa — só um teste de string.
 *
 * ⚠️ A MENSAGEM SÓ PROMETE O QUE O SISTEMA CUMPRE.
 * É promessa feita a um paciente, não texto de campanha. Antes de acrescentar qualquer
 * frase aqui, confira se o sistema faz aquilo. Prometer "você receberá avisos no WhatsApp"
 * quando o sistema apenas RECEBE mensagens é o tipo de erro que gera atendimento — e este
 * link existe justamente para evitar atendimento.
 *
 * 🛑 Módulo PURO — sem `db`, sem `auth`, sem `next/*`.
 */

export interface DadosDaMensagem {
  /** Primeiro nome, para a saudação. `null` cai numa saudação sem nome. */
  primeiroNome: string | null;
  linkDeAcesso: string;
  protocolo: string;
  /** Validade do link em horas. */
  validadeEmHoras: number;
  /** `true` quando a solicitação já existia — o protocolo é o mesmo de antes. */
  reaproveitou: boolean;
}

/**
 * `"7 dias"`, `"1 dia"`, `"12 horas"`, `"1 hora"`.
 *
 * ⚠️ Nada de `dia(s)`. O plural do programador não aparece na tela do paciente.
 */
export function descreverValidade(horas: number): string {
  if (horas <= 0) return 'algumas horas';

  if (horas % 24 === 0) {
    const dias = horas / 24;
    return dias === 1 ? '1 dia' : `${dias} dias`;
  }

  return horas === 1 ? '1 hora' : `${horas} horas`;
}

/** `"Maria Aparecida Souza"` → `"Maria"`. */
export function primeiroNomeDe(nomeCompleto: string | null | undefined): string | null {
  const limpo = nomeCompleto?.trim();
  if (!limpo) return null;
  return limpo.split(/\s+/)[0] ?? null;
}

/**
 * Monta a mensagem completa.
 *
 * A abertura muda quando a solicitação foi reaproveitada: pedir o link duas vezes é comum, e
 * receber exatamente a mesma frase faz o paciente achar que abriu uma segunda solicitação.
 * Dizer que o protocolo é o mesmo evita esse atendimento.
 */
export function montarMensagemDoLink(dados: DadosDaMensagem): string {
  const { primeiroNome, linkDeAcesso, protocolo, validadeEmHoras, reaproveitou } = dados;
  const vocativo = primeiroNome ? `, ${primeiroNome}` : '';

  const abertura = reaproveitou
    ? `Você já tem um cadastro em andamento${vocativo} — mantivemos o mesmo protocolo e preparei um link novo para você concluir:`
    : `Perfeito${vocativo}! Este é o seu link para concluir o cadastro:`;

  return [
    abertura,
    '',
    linkDeAcesso,
    '',
    'Deixe à mão antes de abrir:',
    '• CPF e data de nascimento',
    '• Documento de identidade (RG ou CNH)',
    '• Comprovante de residência',
    '',
    'Se você já tem receita médica ou laudo, pode enviar também — ajuda a agilizar a sua avaliação.',
    '',
    'Depois do envio, a nossa equipe confere os dados e a confirmação chega no e-mail que você informou. Qualquer dúvida, é só falar aqui.',
    '',
    `Protocolo: ${protocolo}`,
    `O link é de uso único e vale ${descreverValidade(validadeEmHoras)}. Se pedir outro, vale sempre o mais recente.`,
  ].join('\n');
}
