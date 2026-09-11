/**
 * GUARDA — documento de paciente não abre por URL, e não abre para quem não é dele.
 *
 * A CLASSE DE ERRO: até 10/09/2026 todo documento deste projeto ia para store **público** —
 * RG, laudo, receita e procuração assinada legíveis por qualquer um com o endereço. É o Item 6,
 * e a regra do repositório é literal: _"Store público significa: quem tem a URL lê, sem
 * autenticação. Obscuridade de URL não é controle de acesso."_
 *
 * Decisão do dono em 10/09/2026: _"então vamos colocar no nosso store privado"_.
 *
 * Duas coisas não podem regredir, e a segunda é a que mata:
 *
 *   1. **os caminhos novos gravam privado** — e voltar a `'public'` é uma letra
 *   2. **a entrega confere escopo de OBJETO** — papel certo com id alheio é OWASP API1
 *      (BOLA), o risco número um deste projeto. Autenticar sem conferir de quem é o documento
 *      entrega o RG de qualquer paciente a qualquer médico.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

const ESCOPO = 'lib/auth/escopo-documento.ts';
const ROTA = 'app/api/documentos/[id]/arquivo/route.ts';
const ANEXO = 'lib/documentos/anexo-do-cadastro.ts';
const PARCEIRO = 'lib/parceiros/documentos-do-parceiro.ts';

/** Sem comentários: os arquivos EXPLICAM o que não pode voltar, e a menção não é uso. */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\/\*|\*)/.test(linha))
    .join('\n');
}

describe('os caminhos novos gravam privado', () => {
  it('o anexo do cadastro', () => {
    expect(semComentarios(ler(ANEXO))).toContain("access: 'private'");
    expect(semComentarios(ler(ANEXO))).not.toContain("access: 'public'");
  });

  it('o documento que vem do parceiro', () => {
    const codigo = semComentarios(ler(PARCEIRO));
    expect(codigo).toContain("const ACESSO_DO_BLOB = 'private' as const");
    expect(codigo).not.toMatch(/ACESSO_DO_BLOB = 'public'/);
  });
});

describe('a entrega confere escopo de objeto — OWASP API1', () => {
  const escopo = ler(ESCOPO);

  it('a rota não entrega nada antes de o escopo autorizar', () => {
    const rota = ler(ROTA);
    const checagem = rota.indexOf('garantirLeitorDoDocumento(');
    const entrega = rota.indexOf('new NextResponse(resposta.body');
    expect(checagem).toBeGreaterThan(-1);
    expect(entrega).toBeGreaterThan(-1);
    expect(checagem).toBeLessThan(entrega);
  });

  it('o próprio paciente pode ler', () => {
    expect(escopo).toMatch(/paciente\.userId === user\.id/);
  });

  /**
   * 🔴 A CONJUNÇÃO É O QUE IMPEDE O BOLA.
   *
   * "É médico" não basta: tem de ser o médico DESTE paciente. Sem `paciente.medicoId ===
   * medico.id`, qualquer médico autenticado lê o documento de qualquer paciente da
   * plataforma — que é exatamente o que o guarda `autorizacao-tem-escopo-de-objeto` já
   * protege nas actions de teleconsulta.
   */
  it('o médico só lê documento de paciente DELE', () => {
    expect(escopo).toMatch(/paciente\.medicoId === medico\.id/);
  });

  /**
   * ⚠️ E TUDO O QUE NÃO PODE RESPONDE 404, NUNCA 403.
   *
   * Distinguir "não existe" de "existe e não é seu" transforma a rota em oráculo: com um laço
   * sobre ids, alguém enumera os documentos da plataforma.
   */
  it('negar e não existir respondem igual — a rota não é oráculo', () => {
    const negativas = escopo.match(/status: 40\d/g) ?? [];
    // só 401 (não autenticado) e 404 (qualquer outra recusa)
    expect(negativas.every((s) => s.endsWith('401') || s.endsWith('404'))).toBe(true);
    expect(escopo).not.toMatch(/status: 403/);
  });

  it('a leitura é auditada — é a terceira pergunta da regra de LGPD', () => {
    const rota = ler(ROTA);
    expect(rota).toContain('registrarAuditoria');
    expect(rota).toMatch(/acao: 'visualizar'/);
  });

  it('e a auditoria não pode impedir o paciente de ver o próprio documento', () => {
    expect(ler(ROTA)).toMatch(/registrarAuditoria\([\s\S]{0,200}\}\)\.catch\(\(\) => \{\}\)/);
  });

  it('dado de saúde não entra em cache compartilhado', () => {
    const rota = ler(ROTA);
    expect(rota).toContain("'cache-control': 'private, no-store'");
    expect(rota).toContain("export const dynamic = 'force-dynamic'");
  });
});

describe('controle — o guarda não pode acusar inocente', () => {
  it('os arquivos existem e têm conteúdo (vacuidade)', () => {
    for (const arquivo of [ESCOPO, ROTA, ANEXO, PARCEIRO]) {
      expect(ler(arquivo).length).toBeGreaterThan(200);
    }
  });

  /**
   * ⚠️ A ROTA AINDA ATENDE BLOB ANTIGO, e isso é deliberado.
   *
   * Os 14 pontos de upload que ainda gravam público são o Item 6 — trabalho próprio. Exigir
   * que a rota recuse o antigo quebraria a tela para todo documento já existente.
   */
  it('a rota ainda serve o blob antigo, sem quebrar o que existe', () => {
    expect(ler(ROTA)).toContain('NextResponse.redirect(url)');
  });
});
