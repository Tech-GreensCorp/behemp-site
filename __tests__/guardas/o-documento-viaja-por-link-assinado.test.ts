/**
 * GUARDA — o documento sai daqui por link assinado de vida curta, auditado, e nunca pela URL
 * do blob.
 *
 * O QUE ISTO IMPLEMENTA: a ADR-0016 já tinha decidido, ao adiar a cópia de arquivos —
 * _"copiar blob de saúde entre duas empresas exige **URL assinada de vida curta na origem,
 * validação de MIME e tamanho no destino, store privado e prazo de retenção**"_. Não era
 * decisão aberta; eu é que a tinha apresentado como se fosse.
 *
 * 🔴 A URL É NOSSA, E ISSO É O PONTO. O Vercel Blob 2.3.3 não assina URL com validade (medido
 * nos exports do pacote), mas a razão de fundo é outra e melhor: uma URL assinada de store
 * entrega o arquivo **sem que ninguém aqui saiba que ele foi lido**. Passando pela nossa rota,
 * cada download vira registro de auditoria — a terceira pergunta de `.claude/rules/seguranca-lgpd.md`.
 *
 * As cinco coisas que não podem regredir:
 *
 *   1. **A URL crua do blob nunca sai.** Se sair, a validade e a auditoria viram decoração.
 *   2. **A assinatura é conferida ANTES da expiração.** O contrário conta a quem forjou que o
 *      formato está certo e só o prazo passou — e o prazo é o único campo que ele controla.
 *   3. **A chave do link é DERIVADA do segredo de webhook, nunca o próprio.** Dois usos para o
 *      mesmo valor significam que um oráculo em um enfraquece o outro.
 *   4. **A rota responde 404 para tudo** — token forjado, expirado, documento apagado, blob
 *      fora do ar. Distinguir transformaria a rota em oráculo de ids, e aqui não há login.
 *   5. **Simetria com a Greens.** Mesmo teto (8 MB), mesma allowlist de MIME, mesmo TTL (1 h),
 *      e `laudo_medico` não viaja. Limite diferente de cada lado faz um documento atravessar
 *      numa direção e não na outra, e quem investiga só descobre lendo os dois repositórios.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assinarLinkDoDocumento,
  conferirLinkDoDocumento,
  VALIDADE_DO_LINK_EM_SEGUNDOS,
} from '@/lib/parceiros/link-do-documento';
import {
  LIMITE_DE_BYTES,
  MIMES_QUE_VIAJAM,
  NAO_VIAJAM,
  planoDoEnvio,
} from '@/lib/parceiros/documentos-que-viajam';

function ler(c: string): string {
  return readFileSync(path.join(process.cwd(), c), 'utf8');
}
function semComentarios(f: string): string {
  return f
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
}

const rota = semComentarios(ler('app/api/parceiros/documento/[token]/route.ts'));
const assinador = semComentarios(ler('lib/parceiros/link-do-documento.ts'));
const p5 = semComentarios(ler('lib/parceiros/transferencia-de-cadastro.ts'));

const SEGREDO = 'segredo-de-teste-com-tamanho-razoavel';

// ─────────────────────────────────────────────────────────────────────────────
describe('o link assinado', () => {
  it('vai e volta', () => {
    const token = assinarLinkDoDocumento({ documentoId: 'doc_1', segredoDeSaida: SEGREDO });
    const r = conferirLinkDoDocumento({ token, segredoDeSaida: SEGREDO });
    expect(r).toEqual({ valido: true, documentoId: 'doc_1' });
  });

  it('não vale com outro segredo', () => {
    const token = assinarLinkDoDocumento({ documentoId: 'doc_1', segredoDeSaida: SEGREDO });
    const r = conferirLinkDoDocumento({ token, segredoDeSaida: 'outro-segredo-qualquer' });
    expect(r).toEqual({ valido: false, motivo: 'assinatura_invalida' });
  });

  it('🔴 trocar o id invalida — senão um link serviria para qualquer documento', () => {
    const token = assinarLinkDoDocumento({ documentoId: 'doc_1', segredoDeSaida: SEGREDO });
    const forjado = token.replace('doc_1', 'doc_2');
    expect(conferirLinkDoDocumento({ token: forjado, segredoDeSaida: SEGREDO }).valido).toBe(false);
  });

  it('🔴 esticar o prazo invalida — a data faz parte do que é assinado', () => {
    const token = assinarLinkDoDocumento({
      documentoId: 'doc_1',
      segredoDeSaida: SEGREDO,
      agoraEmSegundos: 1_000,
    });
    const [id, , assinatura] = token.split('.');
    const esticado = `${id}.${9_999_999}.${assinatura}`;
    expect(conferirLinkDoDocumento({ token: esticado, segredoDeSaida: SEGREDO })).toEqual({
      valido: false,
      motivo: 'assinatura_invalida',
    });
  });

  it('expira', () => {
    const token = assinarLinkDoDocumento({
      documentoId: 'doc_1',
      segredoDeSaida: SEGREDO,
      agoraEmSegundos: 1_000,
      validadeEmSegundos: 60,
    });
    expect(
      conferirLinkDoDocumento({ token, segredoDeSaida: SEGREDO, agoraEmSegundos: 1_059 }).valido,
    ).toBe(true);
    expect(
      conferirLinkDoDocumento({ token, segredoDeSaida: SEGREDO, agoraEmSegundos: 1_061 }),
    ).toEqual({
      valido: false,
      motivo: 'expirado',
    });
  });

  it('🔴 token forjado E expirado responde "assinatura inválida", nunca "expirado"', () => {
    const token = assinarLinkDoDocumento({
      documentoId: 'doc_1',
      segredoDeSaida: SEGREDO,
      agoraEmSegundos: 1_000,
      validadeEmSegundos: 60,
    });
    const forjado = token.replace(/\.[0-9a-f]{64}$/, `.${'a'.repeat(64)}`);
    expect(
      conferirLinkDoDocumento({
        token: forjado,
        segredoDeSaida: SEGREDO,
        agoraEmSegundos: 999_999,
      }),
    ).toEqual({
      valido: false,
      motivo: 'assinatura_invalida',
    });
  });

  it('sem segredo não valida nada', () => {
    const token = assinarLinkDoDocumento({ documentoId: 'doc_1', segredoDeSaida: SEGREDO });
    expect(conferirLinkDoDocumento({ token, segredoDeSaida: undefined })).toEqual({
      valido: false,
      motivo: 'sem_segredo',
    });
    expect(conferirLinkDoDocumento({ token, segredoDeSaida: '   ' }).valido).toBe(false);
  });

  it.each(['', 'a', 'a.b', 'a.b.c.d', 'doc.123.naoehex', `doc.abc.${'a'.repeat(64)}`])(
    'formato inválido é recusado sem estourar: %s',
    (token) => {
      const r = conferirLinkDoDocumento({ token, segredoDeSaida: SEGREDO });
      expect(r.valido).toBe(false);
    },
  );

  /**
   * ⚠️ EXIGE O USO, não a existência.
   *
   * A primeira versão checava que `chaveDoLink` existia e passou verde com `assinaturaDe`
   * usando o segredo cru — a função derivadora continuava no arquivo, órfã. É a mesma classe
   * do componente que ninguém renderizava: existir não é estar no caminho.
   */
  it('🔴 a assinatura USA a chave derivada, não o segredo cru', () => {
    const fn = assinador.slice(
      assinador.indexOf('function assinaturaDe'),
      assinador.indexOf('export function assinarLinkDoDocumento'),
    );
    expect(fn.length).toBeGreaterThan(50);
    expect(fn).toContain('chaveDoLink(segredoDeSaida)');
    expect(fn).not.toMatch(/createHmac\('sha256', segredoDeSaida\)/);
  });

  /**
   * ⚠️ EXIGE O USO DENTRO DA CONFERÊNCIA. A primeira versão via `timingSafeEqual` no import e
   * passava verde com a comparação trocada por `!==` — que nem casava com o regex antigo.
   */
  it('e a comparação é em tempo constante, dentro da conferência', () => {
    const fn = assinador.slice(assinador.indexOf('export function conferirLinkDoDocumento'));
    expect(fn).toContain('timingSafeEqual(');
    // Nenhuma comparação direta entre a assinatura recebida e a esperada.
    expect(fn).not.toMatch(/recebida\s*[!=]==\s*esperada|esperada\s*[!=]==\s*recebida/);
  });

  it('a conferência da assinatura vem ANTES da expiração no código', () => {
    const iAssinatura = assinador.indexOf('assinatura_invalida');
    const iExpirado = assinador.indexOf("motivo: 'expirado'");
    expect(iAssinatura).toBeGreaterThan(0);
    expect(iExpirado).toBeGreaterThan(iAssinatura);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a rota que entrega o arquivo', () => {
  it('confere o token', () => {
    expect(rota).toContain('conferirLinkDoDocumento(');
  });

  it('🔴 responde 404 quando o token não vale — nunca 401 nem 403', () => {
    const bloco = rota.slice(
      rota.indexOf('if (!conferido.valido)'),
      rota.indexOf('const [documento]'),
    );
    expect(bloco).toContain('naoEncontrado()');
    expect(bloco).not.toMatch(/40[13]/);
  });

  it('e o motivo da recusa fica no log, nunca na resposta', () => {
    expect(rota).toMatch(/console\.warn\([^)]*motivo: conferido\.motivo/);
    expect(rota).not.toMatch(/erro: conferido\.motivo/);
  });

  it('documento apagado também é 404', () => {
    expect(rota).toContain('isNull(documentos.deletedAt)');
    expect(rota).toMatch(/if \(!documento\) return naoEncontrado\(\)/);
  });

  it('🔴 audita ANTES de entregar', () => {
    const iAudita = rota.indexOf('registrarAuditoria');
    const iEntrega = rota.indexOf('await fetch(documento.urlBlob)');
    expect(iAudita).toBeGreaterThan(0);
    expect(iEntrega).toBeGreaterThan(iAudita);
  });

  it('a auditoria registra QUEM leu, mesmo sem usuário', () => {
    expect(rota).toMatch(/por: 'parceiro'/);
    expect(rota).toMatch(/acao: 'visualizar'/);
  });

  it('tem limite de requisição — OWASP API4', () => {
    expect(rota).toContain('consumir(');
    expect(rota).toMatch(/if \(!limite\.permitido\)/);
  });

  it('dado de saúde não entra em cache', () => {
    expect(rota).toContain("'cache-control': 'private, no-store'");
  });

  it('nenhum dado pessoal no log da rota', () => {
    for (const proibido of ['nomeArquivo', 'cpf', 'telefone', 'email']) {
      const logs = rota.match(/console\.\w+\([^;]*\)/g) ?? [];
      for (const l of logs) expect(l, proibido).not.toContain(proibido);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o que viaja, e a simetria com a Greens', () => {
  it('🔴 o teto é o mesmo deles: 8 MB', () => {
    expect(LIMITE_DE_BYTES).toBe(8 * 1024 * 1024);
  });

  it('🔴 a allowlist de MIME é a mesma deles', () => {
    expect([...MIMES_QUE_VIAJAM].sort()).toEqual(
      ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'].sort(),
    );
  });

  it('🔴 o TTL é o mesmo que eles usam ao mandar para cá: 1 hora', () => {
    expect(VALIDADE_DO_LINK_EM_SEGUNDOS).toBe(3600);
  });

  it('🔴 laudo_medico não viaja — decisão deles, respeitada aqui', () => {
    expect(NAO_VIAJAM.has('laudo_medico')).toBe(true);
    const [e] = planoDoEnvio([{ id: 'd1', tipo: 'laudo_medico', nomeArquivo: 'x.pdf' }]);
    expect(e.motivoSemArquivo).toBe('tipo_nao_suportado_la');
    expect(e.nomeArquivo).toBeNull();
  });

  it('arquivo grande demais não viaja', () => {
    const [e] = planoDoEnvio([
      {
        id: 'd1',
        tipo: 'receita_medica',
        nomeArquivo: 'x.pdf',
        tamanhoEmBytes: LIMITE_DE_BYTES + 1,
      },
    ]);
    expect(e.motivoSemArquivo).toBe('grande_demais');
  });

  it('MIME fora da lista não viaja', () => {
    const [e] = planoDoEnvio([
      { id: 'd1', tipo: 'receita_medica', nomeArquivo: 'x.docx', mime: 'application/msword' },
    ]);
    expect(e.motivoSemArquivo).toBe('mime_nao_aceito');
  });

  it('🔴 metadado AUSENTE não bloqueia — o destino valida de novo', () => {
    const [e] = planoDoEnvio([{ id: 'd1', tipo: 'receita_medica', nomeArquivo: 'x.pdf' }]);
    expect(e.motivoSemArquivo).toBeNull();
  });

  it('tipo repetido mantém o primeiro — a mesma regra deles', () => {
    const r = planoDoEnvio([
      { id: 'd1', tipo: 'documento_identidade', nomeArquivo: 'rg1.png' },
      { id: 'd2', tipo: 'documento_identidade', nomeArquivo: 'rg2.png' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].documentoId).toBe('d1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a P5 entrega o link, não o blob', () => {
  it('🔴 a URL crua do blob nunca entra no corpo', () => {
    expect(p5).not.toMatch(/urlBlob/);
  });

  it('monta a rota assinada', () => {
    expect(p5).toContain('/api/parceiros/documento/');
    expect(p5).toContain('assinarLinkDoDocumento(');
  });

  it('🔴 falha ao assinar NÃO derruba a transferência — cai para "só o tipo"', () => {
    expect(p5).toMatch(/catch \{[\s\S]{0,200}falha_ao_assinar/);
    expect(p5).toMatch(/saida\.push\(\{ tipo: e\.tipo \}\)/);
  });

  it('sem segredo também cai para "só o tipo", em vez de mandar link quebrado', () => {
    expect(p5).toMatch(/!segredo\?\.trim\(\)/);
  });

  it('o que não viajou vai ao log sem nome de arquivo', () => {
    const logs = p5.match(/console\.\w+\([^;]*\)/g) ?? [];
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) expect(l).not.toContain('nomeArquivo');
  });

  it('só documentos não apagados entram', () => {
    expect(p5).toContain('isNull(tabelaDeDocumentos.deletedAt)');
  });
});
