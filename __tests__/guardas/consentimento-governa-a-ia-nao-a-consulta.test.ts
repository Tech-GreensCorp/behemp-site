/**
 * Guarda: o consentimento governa a IA, e NÃO a videochamada.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Até 20/08/2026 o consentimento da teleconsulta era `const [consentimentoTranscricao] =
 * useState(true)` — uma flag fixa, sem setter e sem tela. Ninguém consentia nada, e o banco
 * registrava aceite de todo mundo. Item 11 de `docs/04-LISTA-DE-AFAZERES.md`.
 *
 * A decisão mudou DUAS vezes no mesmo dia (ADR-0007 D-03) e terminou em `DO-23`:
 *   · a **videochamada** não depende de aceite — base legal própria, LGPD art. 11, II, "f"
 *     (tutela da saúde em procedimento de profissional de saúde);
 *   · a **transcrição por IA** depende, e dos DOIS lados.
 *
 * 🔴 POR QUE UM CASO PROTEGE A CONSULTA DE SER BLOQUEADA
 * O caminho natural de quem "reforça o compliance" é bloquear a consulta — foi a segunda
 * versão da decisão, e foi abandonada porque consentimento obtido sob pena de perder o
 * atendimento **não é livre**, e consentimento não-livre é **nulo** (art. 8º, §3º). Bloquear a
 * consulta produziria um registro de aceite sem valor: o oposto do objetivo. Este guarda
 * existe para que essa reversão não aconteça sem alguém decidir de novo, por escrito.
 *
 * 🔴 O QUE A SABOTAGEM ENCONTROU (20/08/2026)
 * Das 7 mutações, **3 sobreviveram** na primeira rodada: remover o aceite do médico da
 * decisão, ignorar a revogação, e trocar a checagem de papel por `true` no registro.
 *
 * Todas pela mesma causa: os casos procuravam o nome do campo em QUALQUER lugar do arquivo —
 * e os mesmos nomes aparecem no `select` e nas outras funções. Passar sobre a presença da
 * string não é passar sobre a decisão. Corrigido fatiando na unidade onde o defeito acontece:
 * a **expressão** `const consentimentoIaLiberado = …` e a **função** `registrarConsentimentoIa`.
 * Com isso as 7 morrem. É a terceira vez nesta sessão que o mesmo erro de granularidade
 * aparece — buscar num escopo maior que o do defeito, Regra 2 de docs/TECNICA-DOS-GUARDAS.md.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (arquivo: string) => readFileSync(join(RAIZ, arquivo), 'utf8');

const TRANSCREVER = 'app/api/teleconsulta/transcrever/route.ts';
const ESCOPO = 'lib/auth/escopo-sala.ts';
const TEXTO = 'lib/lgpd/consentimento.ts';
const ACTION = 'app/_actions/consentimento-teleconsulta.ts';
const HOST = 'components/teleconsulta/GlobalTeleconsultaHost.tsx';
const PACIENTE = 'app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx';
const COMPONENTE = 'components/teleconsulta/Consentimento.tsx';

describe('o consentimento bloqueia a transcrição', () => {
  it('o guarda enxerga os arquivos que precisa proteger', () => {
    for (const a of [TRANSCREVER, ESCOPO, TEXTO, ACTION, HOST, PACIENTE, COMPONENTE]) {
      expect(() => fonte(a), `${a} não existe`).not.toThrow();
    }
  });

  it('o envio ao Google/Gemini exige os DOIS aceites, verificados no servidor', () => {
    const t = fonte(TRANSCREVER);
    expect(
      /consentimentoIaLiberado/.test(t),
      'o handler de transcrição não confere o consentimento dos dois lados',
    ).toBe(true);
    // A verificação tem de vir ANTES de qualquer envio externo.
    const ondeVerifica = t.indexOf('consentimentoIaLiberado');
    const ondeEnvia = t.indexOf('speech.googleapis.com');
    expect(
      ondeEnvia === -1 || ondeVerifica < ondeEnvia,
      'a verificação vem DEPOIS do envio ao Google — verificar depois de enviar não protege',
    ).toBe(true);
  });

  // 🔴 A EXPRESSÃO DE DECISÃO, NÃO O ARQUIVO.
  // A primeira versão destes casos procurava os nomes dos campos em QUALQUER lugar de
  // `escopo-sala.ts` — e eles aparecem também no `select`. Resultado: remover uma condição da
  // decisão mantinha o guarda VERDE, porque o nome seguia presente. Três mutantes sobreviveram
  // à sabotagem assim. Agora o trecho examinado é só a atribuição de `consentimentoIaLiberado`,
  // que é a unidade onde o defeito acontece — Regra 2 de docs/TECNICA-DOS-GUARDAS.md.
  const decisao = (() => {
    const t = fonte(ESCOPO);
    const i = t.indexOf('const consentimentoIaLiberado =');
    if (i < 0) return '';
    return t.slice(i, t.indexOf(';', i));
  })();

  it('a decisão de liberar a IA existe', () => {
    expect(decisao.length, 'não há expressão que decide liberar a IA').toBeGreaterThan(40);
  });

  it('a decisão exige o aceite do PACIENTE', () => {
    expect(
      /consentimentoPacienteEm/.test(decisao),
      'o aceite do paciente saiu da expressão que libera a IA',
    ).toBe(true);
  });

  it('a decisão exige o aceite do MÉDICO', () => {
    expect(
      /consentimentoMedicoEm/.test(decisao),
      'o aceite do médico saiu da expressão que libera a IA — a voz dele está no áudio',
    ).toBe(true);
  });

  it('a decisão compara a versão aceita com a atual', () => {
    expect(
      /consentimentoVersaoTexto\s*===\s*VERSAO_CONSENTIMENTO/.test(decisao),
      'aceite de texto antigo passou a valer — a pessoa consentiu com outro texto',
    ).toBe(true);
  });

  it('a decisão respeita a revogação', () => {
    expect(
      /!\s*sala\.consentimentoRevogadoEm/.test(decisao),
      'revogação deixou de derrubar o consentimento — revogação sem efeito é de fachada',
    ).toBe(true);
  });

  it('a decisão respeita o portão de texto revisado', () => {
    expect(
      /consentimentoPodeSerColetado\(\)/.test(decisao),
      'a decisão ignora o portão de produção',
    ).toBe(true);
  });

  it('o aceite é gravado com QUEM e com a VERSÃO do texto', () => {
    const t = fonte(ACTION);
    expect(/consentimentoVersaoTexto:\s*VERSAO_CONSENTIMENTO/.test(t)).toBe(true);
    expect(
      /consentimento(Paciente|Medico)Por:\s*escopo\.sala\.userId/.test(t),
      'o aceite não registra quem manifestou — registro sem autor não prova nada',
    ).toBe(true);
  });

  it('o papel de quem consente vem do SERVIDOR, não do cliente', () => {
    const t = fonte(ACTION);
    expect(/garantirDonoDaSala/.test(t), 'a action não prova escopo de objeto sobre a sala').toBe(
      true,
    );
    // Fatiado na FUNÇÃO que registra, não no arquivo: `escopo.sala.papel` aparece também em
    // `revogar` e em `buscar`, então procurar no arquivo deixava passar a sabotagem que
    // trocava a comparação por `true` apenas no registro. Um mutante sobreviveu assim.
    const i = t.indexOf('export async function registrarConsentimentoIa');
    const registrar = t.slice(i, t.indexOf('export async function revogar', i));
    expect(
      /escopo\.sala\.papel\s*!==\s*'paciente'/.test(registrar) &&
        /escopo\.sala\.papel\s*!==\s*'medico'/.test(registrar),
      'o registro não recusa quem não é paciente nem médico da sala — foi assim que a tela do ' +
        'médico "consentia" pelo paciente',
    ).toBe(true);
    expect(
      /papel === 'paciente'\s*\?/.test(registrar),
      'o campo gravado não deriva do papel decidido no servidor',
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A outra metade da decisão, e a que é mais fácil de perder de vista.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// 🔄 RETIFICADO em 20/08/2026, depois de transcrever a CFM 2.314/2022.
//
// A versão anterior deste describe cobrava que **nada** bloqueasse a consulta, com base na
// LGPD art. 11, II, "f". Faltava a outra norma: o CFM 2.314 Art. 15 (`CFM-01`) diz que o
// paciente *"deverá autorizar o atendimento por telemedicina"*. São DOIS consentimentos, e só
// um bloqueia (ADR-0007 D-08).
//
// 🔴 E este guarda tinha um furo: o caso procurava a palavra `consentimento` perto do
// `disabled`. Quando a entrada passou a ser bloqueada por `consentTeleconsultaOk`, o regex não
// casou e o guarda ficou VERDE sobre uma mudança que ele existia para ver. Agora cobra os dois
// eixos pelo NOME de cada consentimento.
// ─────────────────────────────────────────────────────────────────────────────
describe('o consentimento certo bloqueia a coisa certa', () => {
  /** O trecho do `disabled` do botão de entrar na sala, no lado do paciente. */
  function disabledDoBotaoEntrar(): string {
    const t = fonte(PACIENTE);
    const i = t.indexOf('Entrar na Consulta');
    expect(i, 'o botão de entrar na sala desapareceu').toBeGreaterThan(-1);
    const trecho = t.slice(Math.max(0, i - 800), i);
    const d = trecho.lastIndexOf('disabled=');
    expect(d, 'o botão de entrar não tem `disabled`').toBeGreaterThan(-1);
    return trecho.slice(d, trecho.indexOf('>', d) + 1);
  }

  it('a entrada na sala É bloqueada pelo consentimento de TELECONSULTA (CFM Art. 15)', () => {
    expect(
      /consentTeleconsulta/i.test(disabledDoBotaoEntrar()),
      'a entrada na sala não depende do consentimento de teleconsulta — a CFM 2.314 Art. 15 ' +
        'exige que o paciente autorize o atendimento por telemedicina',
    ).toBe(true);
  });

  it('a entrada na sala NÃO é bloqueada pelo consentimento de IA', () => {
    // Se a IA bloqueasse a consulta, o aceite dela deixaria de ser livre — e consentimento
    // não-livre é nulo (LGPD art. 8º, §3º). É a metade da decisão que continua valendo.
    const d = disabledDoBotaoEntrar();
    expect(
      /consentimentoIa|liberado|transcricao/i.test(d),
      'a entrada passou a depender do consentimento de IA — isso torna aquele aceite nulo. ' +
        'Ver ADR-0007 D-03 e D-08 antes de mudar.',
    ).toBe(false);
  });

  it('o médico não autoriza a teleconsulta pelo paciente', () => {
    // A norma nomeia o titular. Um médico "autorizando" pelo paciente inverte o sujeito do
    // consentimento — era o defeito original de todo o módulo.
    const t = fonte(ACTION);
    const i = t.indexOf('export async function registrarConsentimentoTeleconsulta');
    expect(i, 'a action do consentimento de teleconsulta não existe').toBeGreaterThan(-1);
    const corpo = t.slice(i, t.indexOf('export async function declararEmergencia', i));
    expect(
      /papel !== 'paciente'/.test(corpo),
      'a action aceita que outro papel autorize a teleconsulta',
    ).toBe(true);
  });

  it('a emergência médica dispensa o aceite, mas NÃO o registro do motivo', () => {
    // CFM 2.314 Art. 15 § único admite a exceção. Dispensar o registro junto tornaria
    // "emergência" o caminho de menor resistência para pular o consentimento.
    const t = fonte(ACTION);
    const i = t.indexOf('export async function declararEmergenciaMedica');
    expect(i, 'a exceção de emergência não existe').toBeGreaterThan(-1);
    const corpo = t.slice(i);
    expect(/motivo\.trim\(\)\.length < 10/.test(corpo), 'o motivo não é exigido').toBe(true);
    expect(/papel !== 'medico'/.test(corpo), 'qualquer papel declara emergência').toBe(true);
  });

  it('a tela diz o que acontece se a pessoa recusar — nos DOIS consentimentos', () => {
    const texto = fonte(TEXTO);
    expect(/seRecusar/.test(texto), 'falta o efeito da recusa no texto da IA').toBe(true);
    expect(
      /direitoDeNegar/.test(texto),
      'falta o direito de negar no texto da teleconsulta — CFM Art. 15 § único o nomeia',
    ).toBe(true);
    const comp = fonte(COMPONENTE);
    expect(
      /direitoDeNegar/.test(comp) && /seRecusar/.test(comp),
      'a tela não mostra o efeito da recusa',
    ).toBe(true);
  });

  it('o texto do consentimento de IA nomeia os DOIS serviços externos', () => {
    // `LGPD-02` (art. 9º §1º): informação enganosa ANULA o consentimento. Falar só de
    // "transcrição" descreveria menos do que o sistema faz.
    const texto = fonte(TEXTO);
    const i = texto.indexOf('TEXTO_CONSENTIMENTO_IA');
    const bloco = texto.slice(i, texto.indexOf('VERSAO_CONSENTIMENTO_IA', i));
    expect(/Speech-to-Text/.test(bloco), 'o texto não nomeia o serviço de transcrição').toBe(true);
    expect(/Gemini/.test(bloco), 'o texto não nomeia o serviço que organiza o resumo').toBe(true);
    expect(
      /sem essa remoção|sem máscara/i.test(bloco),
      'o texto não diz que o áudio vai ao primeiro serviço SEM mascaramento — isso é a ' +
        'informação que mais pesa, e omiti-la é o conteúdo enganoso do art. 9º §1º',
    ).toBe(true);
  });

  it('os sete incisos do art. 9º estão cobertos no texto da IA', () => {
    // `LGPD-01`: finalidade · forma e duração · controlador · contato · uso compartilhado ·
    // responsabilidades · direitos com menção ao art. 18.
    const texto = fonte(TEXTO);
    expect(/finalidade é \*\*uma só\*\*|A finalidade/.test(texto), 'inciso I').toBe(true);
    expect(/não é gravado nem armazenado/.test(texto), 'inciso II — forma').toBe(true);
    expect(/CONTROLADOR/.test(texto), 'incisos III e IV — controlador e contato').toBe(true);
    expect(/RETENCAO/.test(texto), 'inciso II — duração').toBe(true);
    expect(/art\. 18/.test(texto), 'inciso VII exige menção EXPLÍCITA ao art. 18').toBe(true);
  });
});

describe('texto em rascunho não coleta consentimento em produção', () => {
  it('existe portão de produção, e ele está ligado ao ambiente', () => {
    const t = fonte(TEXTO);
    expect(/CONSENTIMENTO_PRONTO_PARA_USO/.test(t)).toBe(true);
    expect(
      /NODE_ENV\s*===\s*['"]production['"]/.test(t),
      'o portão não distingue produção — em dev a tela precisa funcionar, em produção não pode ' +
        'coletar aceite sobre texto não revisado',
    ).toBe(true);
  });

  it('a versão em rascunho é identificável no banco', () => {
    // Se algum aceite for gravado com texto de rascunho, tem de ser possível achá-lo depois.
    const t = fonte(TEXTO);
    expect(/rascunho-/.test(t), 'a versão de rascunho não é identificável').toBe(true);
    expect(/startsWith\(['"]rascunho-['"]\)/.test(t)).toBe(true);
  });

  it('a action recusa registrar quando o texto não pode ser oferecido', () => {
    expect(
      /if\s*\(!consentimentoPodeSerColetado\(\)\)/.test(fonte(ACTION)),
      'a action gravaria aceite mesmo com o texto em revisão',
    ).toBe(true);
  });
});
