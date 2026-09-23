/**
 * O LAUDO MÉDICO VIRA DOCUMENTO DA BE4HOPE — ADR-0026.
 *
 * 🔴 ISTO NÃO É GUARDA ESTRUTURAL. Ele EXECUTA a materialização contra um Postgres real, com o
 * enum já migrado, e olha as linhas que sobram. É o Nível 4 da regra _"Deploy CUSTA"_.
 *
 * ## O que ele trava
 *
 * Desde 15/09/2026 a Greens manda o laudo como **arquivo**. Nós o baixávamos, guardávamos no
 * nosso blob privado e o descartávamos em `materializar-documentos.ts`, porque o enum
 * `documento_tipo` não tinha o valor. Medido em produção em 23/09/2026: **3 laudos no blob,
 * 0 linhas em `documentos`** — documento clínico guardado que nenhuma linha apontava.
 *
 * Rodar:
 *
 *   docker start behemp-pg || docker run -d --name behemp-pg \
 *     -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp -p 5544:5432 postgres:16
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/o-laudo-medico-vira-documento.test.ts
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';

vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({
  headers: async () => new Map<string, string>() as unknown as Headers,
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { materializarDocumentosDoParceiro } = await import(
  '@/lib/parceiros/materializar-documentos'
);
const { planoDoEnvio, NAO_VIAJAM } = await import('@/lib/parceiros/documentos-que-viajam');
const { rotuloDoDocumento } = await import('@/lib/parceiros/documentos');

const PROTOCOLO = 'SOL-TESTE-LAUDO';

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.documentos);
  await db.delete(schema.pacientes);
  await db.delete(schema.users);
}

/** Um paciente com ficha, para as linhas de `documentos` terem dono. */
async function pacienteDeTeste() {
  const [user] = await db
    .insert(schema.users)
    .values({
      clerkId: 'user_laudo_de_teste',
      email: 'paciente.ficticio@exemplo.test',
      nome: 'Paciente Fictício de Teste',
      role: 'paciente',
    })
    .returning({ id: schema.users.id });
  const [ficha] = await db
    .insert(schema.pacientes)
    .values({ userId: user.id })
    .returning({ id: schema.pacientes.id });
  return ficha.id;
}

async function documentosDe(pacienteId: string) {
  return db
    .select({ tipo: schema.documentos.tipo, urlBlob: schema.documentos.urlBlob })
    .from(schema.documentos)
    .where(eq(schema.documentos.pacienteId, pacienteId));
}

describe('o laudo médico é documento da Be4Hope', () => {
  beforeEach(limpar);
  afterAll(limpar);

  it('a. o laudo com arquivo vira linha em documentos, com o tipo novo', async () => {
    const pacienteId = await pacienteDeTeste();

    const r = await materializarDocumentosDoParceiro({
      pacienteId,
      documentosDoParceiro: [
        { tipo: 'laudo_medico', urlBlob: 'https://blob.test/laudo.pdf', nomeArquivo: 'laudo.pdf' },
      ],
      protocolo: PROTOCOLO,
    });

    expect(r.inseridos).toBe(1);
    const docs = await documentosDe(pacienteId);
    expect(docs).toHaveLength(1);
    // 🔴 O tipo novo, não `documento_pessoal`: classificar documento clínico como pessoal
    // faria a ficha mentir sobre o que está olhando (ADR-0026 D-01, rejeitado).
    expect(docs[0].tipo).toBe('laudo_medico');
  });

  it('b. documento_identidade continua virando rg — não regrediu', async () => {
    const pacienteId = await pacienteDeTeste();

    await materializarDocumentosDoParceiro({
      pacienteId,
      documentosDoParceiro: [
        { tipo: 'documento_identidade', urlBlob: 'https://blob.test/rg.jpg', nomeArquivo: null },
        { tipo: 'laudo_medico', urlBlob: 'https://blob.test/laudo.pdf', nomeArquivo: null },
      ],
      protocolo: PROTOCOLO,
    });

    const tipos = (await documentosDe(pacienteId)).map((d) => d.tipo).sort();
    expect(tipos).toEqual(['laudo_medico', 'rg']);
  });

  it('b2. o laudo só vira linha quando tem ARQUIVO — nome puro continua sendo só manifesto', async () => {
    const pacienteId = await pacienteDeTeste();

    // A forma antiga do contrato: a string do nome, sem `urlBlob`.
    const r = await materializarDocumentosDoParceiro({
      pacienteId,
      documentosDoParceiro: ['laudo_medico', 'documento_identidade'],
      protocolo: PROTOCOLO,
    });

    expect(r.inseridos).toBe(0);
    expect(await documentosDe(pacienteId)).toHaveLength(0);
  });

  it('c. 🔴 na IDA o laudo AGORA entra no plano — decisão do dono em 23/09/2026', async () => {
    /**
     * Até 23/09 o `NAO_VIAJAM` tinha `laudo_medico`, espelhando uma decisão da Greens que não
     * existe desde 15/09 — e o ramo era inalcançável, porque o enum não tinha o valor.
     *
     * ⚠️ Isto NÃO faz dado de saúde atravessar. Quem impede é o interruptor
     * (`PARCEIRO_TRANSFERENCIA_ATIVA`) mais o consentimento de finalidade específica, os dois
     * conferidos antes de qualquer documento ser olhado.
     */
    const plano = planoDoEnvio([
      { id: 'd1', tipo: 'laudo_medico', nomeArquivo: 'laudo.pdf', dataEmissao: null },
      { id: 'd2', tipo: 'rg', nomeArquivo: 'rg.jpg', dataEmissao: null },
    ]);

    const laudo = plano.find((e) => e.tipo === 'laudo_medico');
    expect(laudo).toBeDefined();
    expect(laudo!.motivoSemArquivo).toBeNull();
    expect(NAO_VIAJAM.size).toBe(0);
  });

  it('c2. o mecanismo NAO_VIAJAM continua funcionando — vazio é a lista, não o código', async () => {
    // Controle contra vacuidade: se o ramo tivesse sido apagado, este caso não teria como
    // provar nada. Ele prova que a exclusão AINDA funciona, para quem a declarar amanhã.
    NAO_VIAJAM.add('rg');
    try {
      const plano = planoDoEnvio([
        { id: 'd1', tipo: 'rg', nomeArquivo: 'rg.jpg', dataEmissao: null },
      ]);
      expect(plano[0].motivoSemArquivo).toBe('tipo_nao_suportado_la');
    } finally {
      NAO_VIAJAM.delete('rg');
    }
  });

  it('d. o rótulo do laudo é texto, nunca o valor cru', async () => {
    expect(rotuloDoDocumento('laudo_medico')).toBe('Laudo médico');
    expect(rotuloDoDocumento('laudo_medico')).not.toBe('laudo_medico');
  });

  it('d2. todo mapa de rótulo de DOCUMENTO no disco conhece laudo_medico', () => {
    /**
     * 🔴 DERIVA DO DISCO, não de uma lista. Um `TIPO_LABELS` novo amanhã nasce coberto — e é
     * assim que se evita o `PROVENIENCIA[valor]` que estourou uma tela inteira em 24/08/2026.
     *
     * Só os mapas de tipo de DOCUMENTO entram: o critério é conter `receita_medica`, que é o
     * tipo presente em todos eles e em nenhum outro `TIPO_LABELS` do repositório.
     */
    const raizes = ['app', 'components'];
    const encontrados: string[] = [];
    const semLaudo: string[] = [];

    const varrer = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        if (nome === 'node_modules' || nome === '.next') continue;
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) {
          varrer(caminho);
          continue;
        }
        if (!/\.tsx?$/.test(nome)) continue;
        const texto = readFileSync(caminho, 'utf8');
        const i = texto.indexOf('TIPO_LABELS');
        if (i === -1) continue;
        const bloco = texto.slice(i, texto.indexOf('};', i) + 2);
        if (!bloco.includes('receita_medica')) continue;
        // O cron lista só os RENOVÁVEIS, e o laudo não é um — ele não gera alerta de vencimento.
        if (caminho.includes('verificar-validade-documentos')) continue;
        encontrados.push(caminho);
        if (!bloco.includes('laudo_medico')) semLaudo.push(caminho);
      }
    };
    raizes.forEach(varrer);

    // Vacuidade: se a varredura não achar nada, ela não está provando nada.
    expect(encontrados.length).toBeGreaterThanOrEqual(3);
    expect(semLaudo).toEqual([]);
  });
});
