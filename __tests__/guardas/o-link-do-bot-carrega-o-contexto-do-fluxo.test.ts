/**
 * GUARDA — o link do bot carrega o que o paciente já tem, e ausência não vira "não tem nada".
 *
 * A CLASSE DE ERRO, medida em 11/09/2026: o `bot-link` aceitava `sessionId`, `leadId`, nome,
 * e-mail e telefone — **e mais nada**. A solicitação nascia com `documentosDoParceiro` nulo, e
 * `pendenciasDe(null)` devolve os **cinco** documentos como pendentes.
 *
 * Resultado: todo paciente que chegava pelo bot era tratado como se não tivesse nada. O de
 * recompra (Greens 3), que tem tudo, via a mesma tela do paciente novo (BeHemp 4) — e o
 * destino, que sai do que **falta** (ADR-0021 D-01), mandava os dois para o agendamento.
 *
 * 🔴 O defeito não era visível de dentro: nada quebrava, nada logava, e a tela parecia certa.
 * Só olhando o que a rota **não** aceita é que ele aparece. Por isso o guarda mede a rota, e
 * não o resultado de um caso feliz.
 *
 * As quatro coisas que não podem regredir:
 *
 *   1. **A rota lê o manifesto** e o repassa até o banco.
 *   2. **Ausência não apaga.** `?tem=` vazio, ou parâmetro nenhum, significa "não declarou" —
 *      e não pode sobrescrever um manifesto que já existe. É a mesma regra do deploy: valor
 *      vazio não apaga o que está lá.
 *   3. **Chave desconhecida é IGNORADA, não rejeitada.** Resposta não-2xx do `bot-link`
 *      transfere o paciente para um atendente: um typo no painel derrubaria o atendimento.
 *   4. **O paciente continua podendo corrigir** — o manifesto é declaração, não prova.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DOCUMENTOS_DO_FLUXO } from '@/lib/parceiros/documentos';
import { lerManifestoDaUrl, PARAMETROS_DO_MANIFESTO } from '@/lib/chatpro/manifesto-da-url';

function ler(caminho: string): string {
  return readFileSync(path.join(process.cwd(), caminho), 'utf8');
}

/** Menção em comentário não é uso — a décima quinta vez desta classe no repositório. */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\/\*|\*)/.test(linha))
    .join('\n');
}

const rota = semComentarios(ler('app/api/chatpro/bot-link/route.ts'));
const servico = semComentarios(ler('lib/chatpro/solicitacao.ts'));
const q = (s: string) => new URLSearchParams(s);

// ─────────────────────────────────────────────────────────────────────────────
describe('a leitura do manifesto', () => {
  it('lê a lista separada por vírgula', () => {
    const r = lerManifestoDaUrl(q('tem=receita_medica,documento_identidade'));
    expect(r.documentos).toEqual(['receita_medica', 'documento_identidade']);
    expect(r.declarado).toBe(true);
  });

  it('aceita hífen e maiúscula — o painel é preenchido à mão', () => {
    const r = lerManifestoDaUrl(q('tem=Receita-Medica'));
    expect(r.documentos).toEqual(['receita_medica']);
  });

  it('aceita o parâmetro repetido', () => {
    const r = lerManifestoDaUrl(q('tem=receita_medica&tem=laudo_medico'));
    expect(r.documentos).toEqual(['receita_medica', 'laudo_medico']);
  });

  it('não repete a mesma chave', () => {
    const r = lerManifestoDaUrl(q('tem=receita_medica,receita_medica'));
    expect(r.documentos).toEqual(['receita_medica']);
  });

  it('🔴 chave desconhecida é IGNORADA, não derruba a leitura', () => {
    const r = lerManifestoDaUrl(q('tem=receita_medica,receta_medca'));
    expect(r.documentos).toEqual(['receita_medica']);
    expect(r.ignorados).toEqual(['receta_medca']);
    expect(r.declarado).toBe(true);
  });

  it('🔴 sem parâmetro nenhum: NÃO declarado — e isso não é "não tem nada"', () => {
    const r = lerManifestoDaUrl(q('name=Ana&phone=5511999999999'));
    expect(r.declarado).toBe(false);
    expect(r.documentos).toEqual([]);
  });

  it('🔴 parâmetro vazio também é "não declarou"', () => {
    expect(lerManifestoDaUrl(q('tem=')).declarado).toBe(false);
    expect(lerManifestoDaUrl(q('tem=,,')).declarado).toBe(false);
  });

  it('só de chave desconhecida não conta como declaração', () => {
    const r = lerManifestoDaUrl(q('tem=isso_nao_existe'));
    expect(r.declarado).toBe(false);
    expect(r.ignorados).toEqual(['isso_nao_existe']);
  });

  it.each([...DOCUMENTOS_DO_FLUXO])('reconhece %s — cobertura da lista inteira', (chave) => {
    expect(lerManifestoDaUrl(q(`tem=${chave}`)).documentos).toEqual([chave]);
  });

  it.each([...PARAMETROS_DO_MANIFESTO])('aceita o parâmetro "%s"', (nome) => {
    expect(lerManifestoDaUrl(q(`${nome}=receita_medica`)).documentos).toEqual(['receita_medica']);
  });

  it('a validação sai da lista do domínio, nunca de uma cópia paralela', () => {
    const fonte = ler('lib/chatpro/manifesto-da-url.ts');
    expect(fonte).toContain('import { DOCUMENTOS_DO_FLUXO');
    expect(semComentarios(fonte)).not.toMatch(/=\s*\[\s*'receita_medica'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a rota repassa o que leu', () => {
  it('a rota lê o manifesto da query', () => {
    expect(rota).toContain('lerManifestoDaUrl(q)');
  });

  it('e o entrega ao serviço', () => {
    expect(rota).toMatch(/documentosDeclarados:\s*manifesto\.declarado/);
  });

  it('🔴 quando não houve declaração, manda null — nunca lista vazia', () => {
    expect(rota).toMatch(/manifesto\.declarado \? manifesto\.documentos : null/);
  });

  /**
   * ⚠️ EXIGE O VALOR NO OBJETO DO LOG, não a menção em qualquer lugar.
   *
   * A primeira versão procurava `manifesto.ignorados` no arquivo inteiro e passava verde com o
   * log sabotado — a condição `if (manifesto.ignorados.length > 0)` satisfazia a busca.
   */
  it('o que não foi reconhecido vai ao log, para o typo não ficar invisível', () => {
    expect(rota).toMatch(/ignorados:\s*manifesto\.ignorados/);
  });

  it('e nenhum dado pessoal entra nesse log junto', () => {
    const bloco = rota.slice(rota.indexOf('manifesto.ignorados'));
    const linhaDoLog = bloco.slice(0, bloco.indexOf('}'));
    for (const proibido of ['telefone', 'email', 'nome', 'cpf']) {
      expect(linhaDoLog, proibido).not.toContain(proibido);
    }
  });

  it('a rota continua respondendo texto puro — o corpo vira a mensagem do WhatsApp', () => {
    expect(rota).toContain("'Content-Type': 'text/plain; charset=utf-8'");
  });

  it('🔴 e manifesto ruim NÃO gera resposta de erro — isso transferiria para um atendente', () => {
    const antesDoTry = rota.slice(rota.indexOf('lerManifestoDaUrl(q)'), rota.indexOf('try {'));
    expect(antesDoTry).not.toMatch(/return\s+textoPuro/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o serviço grava sem destruir o que já existe', () => {
  it('o insert grava o manifesto declarado', () => {
    expect(servico).toMatch(/documentosDoParceiro: params\.documentosDeclarados\?\.length/);
  });

  it('🔴 o reaproveitamento só sobrescreve quando veio alguma coisa', () => {
    const bloco = servico.slice(
      servico.indexOf('if (existente) {'),
      servico.indexOf('const protocolo'),
    );
    expect(bloco).toMatch(/\.\.\.\(params\.documentosDeclarados\?\.length/);
    // Atribuição direta apagaria o manifesto de um handoff anterior com um `?tem=` vazio.
    expect(bloco).not.toMatch(/documentosDoParceiro: params\.documentosDeclarados,/);
  });

  it('e o insert grava null, não `[]`, quando nada foi declarado', () => {
    const bloco = servico.slice(servico.indexOf('.insert(solicitacoesCadastro)'));
    expect(bloco).toMatch(
      /documentosDeclarados\?\.length\s*\n?\s*\?\s*params\.documentosDeclarados\s*\n?\s*:\s*null/,
    );
  });

  /**
   * ⚠️ O TRECHO É O CORPO DA FUNÇÃO, não "daqui até o fim do arquivo".
   *
   * A primeira versão fatiava do `async linkParaOBot` em diante e passava verde com o repasse
   * removido: a declaração do tipo da entrada, logo acima, satisfazia a busca. Aceitar o
   * parâmetro e não repassá-lo é exatamente o defeito que precisa ficar vermelho.
   */
  it('linkParaOBot aceita o parâmetro E o repassa ao resolverOuCriar', () => {
    const inicio = servico.indexOf('async linkParaOBot');
    const corpo = servico.slice(inicio, servico.indexOf('async intake', inicio));
    expect(corpo.length).toBeGreaterThan(100);
    expect(corpo).toMatch(/documentosDeclarados:\s*entrada\.documentosDeclarados/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o manifesto é declaração, não prova — o paciente ainda corrige', () => {
  const formulario = semComentarios(
    ler('app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx'),
  );

  it('a pergunta da receita continua derivando das pendências', () => {
    expect(formulario).toMatch(/perguntarSobreReceita\s*=[\s\S]{0,200}pendencias\.some/);
  });

  it('a pergunta da ANVISA também', () => {
    expect(formulario).toMatch(/perguntarSobreAnvisa\s*=[\s\S]{0,200}pendencias\.some/);
  });

  it('🔴 e a resposta do paciente ainda vence o manifesto', () => {
    expect(formulario).toContain('pendenciasDepoisDasRespostas');
    expect(formulario).toMatch(
      /filter\(\(p\) => !\(p\.chave === 'receita_medica' && temReceita === true\)\)/,
    );
  });
});
