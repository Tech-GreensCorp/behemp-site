import type { SituacaoDoContato } from './triagem';

/**
 * O QUE O PACIENTE LÊ — e o que ele nunca lê (ADR-0017 D-03).
 *
 * 🔴 A REGRA DE NEGÓCIO E A LINGUAGEM DA TELA SÃO COISAS DIFERENTES.
 *
 * A regra, dita pelo dono: só serve receita do nosso receituário. Ela é **interna**, e
 * este arquivo existe para que ela não escape para a conversa.
 *
 * O motivo não é só comercial. **Receita de outro médico é LEGALMENTE VÁLIDA.** Ela não
 * serve ao nosso fluxo, que é outra coisa. Uma mensagem dizendo "sua receita é inválida"
 * faz **afirmação falsa sobre o ato de outro profissional** — risco jurídico, não
 * discrição.
 *
 * ❌ "sua receita é inválida"          ✅ "seu documento está em análise"
 * ❌ "não aceitamos receita de fora"   ✅ "você precisa de uma avaliação com um médico
 * ❌ "este médico não é credenciado"       parceiro"
 *
 * ⚠️ UMA EXCEÇÃO, E SÓ UMA: o **vencimento** pode e deve ser dito. "Sua receita está
 * vencida" é fato objetivo, é regra pública (RDC 1.015/2026, 30 dias) e **não julga quem
 * a emitiu**. Esconder isso tiraria do paciente uma informação que o ajuda e que ele pode
 * conferir sozinho no próprio documento.
 */
const ABERTURAS: Record<SituacaoDoContato['motivo'], string> = {
  sem_cadastro:
    'Para seguir com o seu tratamento, você precisa de uma avaliação com um médico parceiro.',
  falta_receita:
    'Para seguir com o seu tratamento, você precisa de uma avaliação com um médico parceiro.',
  // 🔴 A única que nomeia o motivo — porque este motivo é verdadeiro e verificável.
  receita_vencida:
    'Sua receita está vencida. Receitas de canabidiol valem 30 dias, e para renovar você passa por uma consulta rápida com um médico parceiro.',
  falta_anvisa:
    'Falta a sua autorização da ANVISA — e nós cuidamos dela com você. O primeiro passo é uma avaliação com um médico parceiro.',
  tem_tudo: '',
  paciente_disse_que_tem: '',
};

export function textoDaTriagem(situacao: SituacaoDoContato, primeiroNome?: string | null): string {
  const saudacao = primeiroNome?.trim() ? `Oi, ${primeiroNome.trim()}! ` : 'Oi! ';
  const abertura = ABERTURAS[situacao.motivo];

  if (!situacao.deveOferecerLink) {
    // Ele já tem tudo: não há nada a oferecer, e inventar oferta seria empurrar consulta
    // a quem não precisa.
    return `${saudacao}Vi aqui que o seu cadastro está completo. Vou te encaminhar para o atendimento.`;
  }

  return `${saudacao}${abertura}`;
}

/**
 * A pergunta que o bot faz, e cuja resposta ROTEIA (nunca conclui).
 *
 * Formulada para não induzir: "você já tem receita?" e não "você não tem receita, certo?".
 * E sem mencionar de quem a receita precisa ser — isso é a regra interna.
 */
export const PERGUNTA_DA_TRIAGEM =
  'Antes de continuar: você já tem uma receita médica para canabidiol em mãos?';
