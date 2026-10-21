/**
 * Guarda: autorização precisa de ESCOPO DE OBJETO, não só de papel.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Auditoria da Sprint 1, 20/08/2026. A teleconsulta perguntava "quem é você?" e nunca
 * "este objeto é seu?". O identificador (roomId, salaId, pacienteId) chegava DO CLIENTE e
 * ia direto ao `where`. Sete ocorrências. Duas delas, compostas, permitiam a qualquer
 * usuário autenticado assinar o canal Pusher de uma consulta alheia e negociar WebRTC
 * nela — assistir a uma consulta médica de outra pessoa.
 *
 * É OWASP API1:2023 (BOLA), que `.claude/rules/seguranca-lgpd.md` chama de "o risco
 * número um deste projeto".
 *
 * A GRANULARIDADE É POR FUNÇÃO, não por arquivo — Regra 2 de docs/TECNICA-DOS-GUARDAS.md.
 * `app/(medico)/_actions/teleconsulta.ts` acerta em 1 função e erra em 2: um guarda por
 * arquivo passaria sobre o arquivo inteiro por causa do acerto.
 *
 * 🔴 O QUE A PROVA DE SABOTAGEM ENCONTROU (20/08/2026)
 * Sabotei os 8 defeitos que este guarda existe para pegar. Sete mutantes morreram. Um
 * SOBREVIVEU: devolver a `aprovar-narrativa` o `pacienteId` vindo do BODY, mantendo a
 * chamada a `garantirDonoDaSala`. Os 50 casos de então continuaram verdes.
 *
 * A lição é sobre o que o guarda estava medindo: ele provava que a SALA foi verificada, e
 * não que os dados gravados DERIVAM dela. Mas verificar o dono e então gravar em outro dono
 * é checagem decorativa — e era exatamente o defeito original deste handler. Virou o
 * describe "o paciente gravado deriva da sala", fatiado no INSERT (não no arquivo, porque
 * `select({ pacienteId: teleconsultas.pacienteId })` é legítimo). Com ele, os 8 morrem.
 *
 * O QUE CONTA COMO PROVA DE ESCOPO
 * Chamar `garantirDonoDaSala(...)`, ou conjungir no `where` o dono do objeto
 * (`eq(x.medicoId, medico.id)` / `eq(x.pacienteId, paciente.id)`). Verificar o PAPEL
 * (`verificarMedico`, `verificarPaciente`, `auth()`) NÃO conta — era exatamente o que as
 * 7 ocorrências já faziam.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');

// Derivado do código, não listado à mão: toda função exportada destes arquivos é varrida.
// Arquivo novo de teleconsulta entra aqui e passa a ser cobrado.
const ALVOS = [
  'app/(medico)/_actions/teleconsulta.ts',
  'app/(paciente)/_actions/teleconsulta.ts',
  'app/api/teleconsulta/sinalizar/route.ts',
  'app/api/teleconsulta/transcrever/route.ts',
  'app/api/teleconsulta/transcricao/route.ts',
  'app/api/teleconsulta/aprovar-narrativa/route.ts',
  'app/api/pusher/auth/route.ts',
];

/** Tabelas cujo acesso indevido expõe dado clínico. */
const TABELAS_CLINICAS = ['teleconsultas', 'transcricoes', 'evolucoes', 'consultas', 'prescricoes'];

/** Identificadores que, neste módulo, chegam do cliente. */
const IDS_DO_CLIENTE = [
  'salaId',
  'roomId',
  'pacienteId',
  'teleconsultaId',
  'consultaId',
  'channel_name',
  'canal',
];

type Funcao = { nome: string; corpo: string; arquivo: string };

/** Fatia o arquivo em funções exportadas. É a unidade em que o defeito acontece. */
function funcoesDe(arquivo: string): Funcao[] {
  const fonte = readFileSync(join(RAIZ, arquivo), 'utf8');
  const marcas = [...fonte.matchAll(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g)];
  return marcas.map((m, i) => ({
    nome: m[1],
    arquivo,
    corpo: fonte.slice(m.index, marcas[i + 1]?.index ?? fonte.length),
  }));
}

/** A função encosta em tabela clínica usando um id que veio de fora? */
function precisaDeEscopo(f: Funcao): boolean {
  const tocaClinico = TABELAS_CLINICAS.some((t) =>
    new RegExp(`db\\s*\\.\\s*(update|insert|delete|select)[\\s\\S]{0,200}?\\b${t}\\b`).test(
      f.corpo,
    ),
  );
  const usaIdExterno = IDS_DO_CLIENTE.some((id) => new RegExp(`\\b${id}\\b`).test(f.corpo));
  return tocaClinico && usaIdExterno;
}

/** Prova de escopo de OBJETO. Papel não conta — era o que as 7 ocorrências já faziam. */
function provaEscopo(f: Funcao): boolean {
  return (
    /garantirDonoDaSala\s*\(/.test(f.corpo) ||
    /eq\s*\(\s*[A-Za-z0-9_]+\.medicoId\s*,\s*[A-Za-z0-9_.]*medico\.id\s*\)/.test(f.corpo) ||
    /eq\s*\(\s*[A-Za-z0-9_]+\.pacienteId\s*,\s*[A-Za-z0-9_.]*paciente\.id\s*\)/.test(f.corpo) ||
    // O controle de `transcricao/route.ts`: confere que o médico logado é o da sala.
    /eq\s*\(\s*medicos\.id\s*,\s*sala\.medicoId\s*\)/.test(f.corpo)
  );
}

const TODAS = ALVOS.flatMap(funcoesDe);
const COBRADAS = TODAS.filter(precisaDeEscopo);

describe('autorização tem escopo de objeto, não só de papel', () => {
  // Vacuidade: se o parser parar de achar função, o guarda passaria sobre zero.
  it('o guarda enxerga as funções que precisa proteger', () => {
    expect(
      TODAS.length,
      'nenhuma função exportada extraída — o parser quebrou',
    ).toBeGreaterThanOrEqual(10);
    expect(
      COBRADAS.length,
      'nenhuma função cobrada — a classificação quebrou',
    ).toBeGreaterThanOrEqual(5);
  });

  it.each(COBRADAS.map((f) => [`${f.arquivo} → ${f.nome}()`, f] as const))(
    '%s prova que o objeto é do usuário',
    (_rotulo, f) => {
      expect(
        provaEscopo(f),
        `${f.nome}() em ${f.arquivo} toca tabela clínica com id vindo do cliente e não prova ` +
          `escopo de objeto. Verificar papel não basta — é OWASP API1 (BOLA). Use ` +
          `garantirDonoDaSala() ou conjungue o dono no where.`,
      ).toBe(true);
    },
  );
});

// O canal `presence-sala-` foi o vetor mais grave: autorizava qualquer usuário autenticado
// em qualquer sala. Este caso é separado porque o defeito não estava num `where`, e sim na
// AUSÊNCIA de um ramo de verificação — o que a varredura acima não veria.
describe('canal de teleconsulta no Pusher confere vínculo com a sala', () => {
  const fonte = readFileSync(join(RAIZ, 'app/api/pusher/auth/route.ts'), 'utf8');

  // O guarda cobra a PROPRIEDADE — "o vínculo com a sala é verificado" — e não uma string
  // de implementação. A primeira versão exigia a palavra `teleconsultas` no ramo e ficou
  // vermelha quando a verificação passou a vir do helper, que consulta a tabela por dentro.
  // Guarda que fixa implementação em vez de propriedade acusa o inocente na primeira
  // refatoração — a Regra 2 de docs/TECNICA-DOS-GUARDAS.md pelo avesso.
  it('o ramo presence-sala- verifica o vínculo do usuário com a sala', () => {
    const ramo = fonte.slice(fonte.indexOf("canal.startsWith('presence-sala-')"));
    expect(
      /garantirDonoDaSala\s*\(|teleconsultas/.test(ramo),
      'o ramo presence-sala- autoriza sem verificar vínculo com a sala: qualquer usuário ' +
        'autenticado entra em qualquer consulta. private-user- e private-chat- verificam.',
    ).toBe(true);
  });

  it('canal desconhecido é NEGADO por padrão, não autorizado', () => {
    // fail-open: hoje o `autenticarCanal` final autoriza qualquer nome de canal que não
    // casou nenhum dos três prefixos.
    expect(
      /(Acesso negado|status:\s*403)[\s\S]{0,400}$/.test(fonte.trimEnd()),
      'o fim do handler autoriza canal desconhecido em vez de negar (fail-open)',
    ).toBe(true);
  });
});

// `sinalizar` não toca tabela clínica — só dispara no canal Pusher — então a varredura por
// tabela não o veria. Mas era metade do vetor mais grave: aceitava `roomId` arbitrário do
// body e disparava no canal correspondente. Precisa de caso próprio.
describe('sinalização WebRTC verifica a sala e valida o payload', () => {
  const fonte = readFileSync(join(RAIZ, 'app/api/teleconsulta/sinalizar/route.ts'), 'utf8');

  it('verifica o vínculo do remetente com a sala antes de disparar no canal', () => {
    const ondeDispara = fonte.indexOf('pusherServer.trigger');
    const ondeVerifica = fonte.search(/garantirDonoDaSala\s*\(/);
    expect(ondeVerifica, 'sinalizar não verifica vínculo com a sala').toBeGreaterThan(-1);
    expect(
      ondeVerifica < ondeDispara,
      'a verificação tem de vir ANTES do trigger — verificar depois de publicar não protege',
    ).toBe(true);
  });

  it('valida o corpo com Zod antes de usar o roomId', () => {
    expect(
      /safeParse\s*\(|\.parse\s*\(/.test(fonte),
      'o corpo chega do cliente e vai ao nome do canal e ao nome do evento: sem validação, ' +
        'o roomId é injetado sem forma conhecida',
    ).toBe(true);
  });
});

// 🔴 O QUE A SABOTAGEM ENCONTROU (20/08/2026)
// Sabotei os 8 defeitos corrigidos. Sete mutantes morreram. Um SOBREVIVEU: devolver a
// `aprovar-narrativa` o `pacienteId` vindo do BODY, mantendo a chamada a
// `garantirDonoDaSala`. Os 50 casos continuaram verdes.
//
// Causa: os casos acima provam que a SALA foi verificada. Não provam que os dados gravados
// DERIVAM dela. E o defeito original de `aprovar-narrativa` era exatamente esse — a sala até
// podia ser conferida, mas o prontuário escrito era o do `pacienteId` que o cliente mandou.
// Verificar o dono e então gravar em outro dono é uma checagem decorativa.
//
// Este caso fecha o furo: em insert em tabela clínica, o `pacienteId` tem de vir da sala.
// Fatiado no INSERT, não no arquivo: `select({ pacienteId: teleconsultas.pacienteId })` é
// legítimo e não pode ser acusado.
describe('o paciente gravado deriva da sala, nunca do corpo da requisição', () => {
  const CLINICAS = ['evolucoes', 'transcricoes', 'prescricoes', 'anamneses', 'dosagens'];

  const inserts = ALVOS.flatMap((arquivo) => {
    const fonte = readFileSync(join(RAIZ, arquivo), 'utf8');
    return [
      ...fonte.matchAll(
        /\.insert\(\s*([A-Za-z0-9_]+)\s*\)[\s\S]{0,120}?\.values\(\s*\{([\s\S]*?)\}\s*\)/g,
      ),
    ]
      .filter((m) => CLINICAS.includes(m[1]))
      .map((m) => ({ arquivo, tabela: m[1], corpo: m[2] }))
      .filter((i) => /pacienteId\s*:/.test(i.corpo));
  });

  it('o guarda enxerga os inserts que precisa proteger', () => {
    expect(
      inserts.length,
      'nenhum insert clínico com pacienteId encontrado',
    ).toBeGreaterThanOrEqual(2);
  });

  it.each(inserts.map((i) => [`${i.arquivo} → insert(${i.tabela})`, i] as const))(
    '%s grava o pacienteId da sala',
    (_rotulo, insert) => {
      const valor = insert.corpo.match(/pacienteId\s*:\s*([^,\n]+)/)?.[1]?.trim() ?? '';
      expect(
        /^(escopo\.sala|sala)\./.test(valor),
        `insert(${insert.tabela}) em ${insert.arquivo} grava pacienteId a partir de \`${valor}\`. ` +
          `Tem de derivar da sala já autorizada (escopo.sala.pacienteId) — id vindo do cliente ` +
          `escreve no prontuário de outra pessoa mesmo com a sala conferida.`,
      ).toBe(true);
    },
  );
});
