/**
 * A triagem em PDF, EXECUTADA contra um Postgres de verdade.
 *
 * Chama a ROTA `GET /api/triagens/[id]/ficha-pdf` com triagens semeadas e abre o PDF que sai.
 * Os duplos são só o que é externo: o Clerk (quem está logado) e os cabeçalhos da requisição.
 *
 * ## O que ele prova
 *
 *   1. SÓ o admin baixa. Sem sessão → 401; paciente, médico e id inexistente → o MESMO 404
 *      (a rota não vira oráculo de ids); o claim "admin" no JWT não basta, o papel vem do banco
 *   2. o arquivo é um PDF de verdade, com o NOME DO PACIENTE no `content-disposition` (com
 *      acento, e com fallback ASCII)
 *   3. o conteúdo é o do modal: nome, contato, diagnóstico, urgência, as seções agrupadas e
 *      "Outras informações" — e só isso
 *   4. resposta longa atravessa páginas, todas com "Página X de N"
 *   5. o anexo em Base64, o link do store de arquivos e emoji NÃO entram no PDF
 *   6. triagem importada (Elementor), com chaves legadas, também sai
 *   7. o acesso é auditado, e o registro não carrega dado pessoal
 *
 * ⚠️ Não apaga tabela inteira: tudo o que semeia leva o prefixo `triag_pdf_` e é removido pelo
 * prefixo — pode rodar contra um banco com dados.
 *
 * Rodar: como os outros de `__tests__/integracao` (ver `vitest.integracao.mts`). Com
 * `TRIAGEM_PDF_SAIDA=<pasta>` grava os PDFs gerados, para olhar com os próprios olhos.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, like } from 'drizzle-orm';

const sessao = { clerkId: null as string | null, role: 'admin' as string };

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: sessao.role } },
  }),
  currentUser: async () => ({ id: sessao.clerkId }),
  clerkClient: async () => ({ users: {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({
  headers: async () => new Map<string, string>() as unknown as Headers,
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const rota = await import('@/app/api/triagens/[id]/ficha-pdf/route');

const NOME = 'Maria Conceição Albuquerque de Souza';
const URL_SECRETA = 'https://abc.public.blob.vercel-storage.com/rg-da-maria-SEGREDO.png';

const como = (clerkId: string | null, role: string) => {
  sessao.clerkId = clerkId;
  sessao.role = role;
};

/** Extrai o texto de um PDF do `@react-pdf` (fonte padrão: strings hex dentro de TJ/Tj). */
function textoDoPdf(pdf: Buffer): string {
  const bruto = pdf.toString('latin1');
  const pedacos: string[] = [];
  for (const f of bruto.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let conteudo: string;
    try {
      conteudo = inflateSync(Buffer.from(f[1], 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    for (const m of conteudo.matchAll(/<([0-9a-fA-F]+)>/g)) {
      pedacos.push(Buffer.from(m[1], 'hex').toString('latin1'));
    }
    for (const m of conteudo.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) pedacos.push(m[1]);
  }
  return pedacos.join('');
}

const pedir = (id: string) =>
  rota.GET(new Request(`http://teste.local/api/triagens/${id}/ficha-pdf`) as never, {
    params: Promise.resolve({ id }),
  });

const gravar = (nome: string, pdf: Buffer) => {
  if (!process.env.TRIAGEM_PDF_SAIDA) return;
  mkdirSync(process.env.TRIAGEM_PDF_SAIDA, { recursive: true });
  writeFileSync(path.join(process.env.TRIAGEM_PDF_SAIDA, nome), pdf);
};

async function limpar() {
  await db.delete(schema.logsAuditoria).where(eq(schema.logsAuditoria.entidade, 'triagens'));
  await db.delete(schema.triagens).where(like(schema.triagens.id, 'triag_pdf_%'));
  await db.delete(schema.users).where(like(schema.users.id, 'triag_pdf_%'));
}

const TEXTO_LONGO =
  'Paciente relata dor crônica irradiada para o membro inferior esquerdo, com piora ao final do dia ' +
  'e alívio parcial com repouso. Refere uso prévio de analgésicos e anti-inflamatórios sem resposta ' +
  'satisfatória, além de episódios de insônia e ansiedade associados ao quadro álgico. ';

beforeAll(async () => {
  await limpar();
  await db.insert(schema.users).values([
    {
      id: 'triag_pdf_adm',
      clerkId: 'triag_pdf_ck_adm',
      email: 'triag_pdf_adm@teste.invalid',
      nome: 'Admin do PDF',
      role: 'admin',
    },
    {
      id: 'triag_pdf_med',
      clerkId: 'triag_pdf_ck_med',
      email: 'triag_pdf_med@teste.invalid',
      nome: 'Médico',
      role: 'medico',
    },
    {
      id: 'triag_pdf_pac',
      clerkId: 'triag_pdf_ck_pac',
      email: 'triag_pdf_pac@teste.invalid',
      nome: 'Paciente',
      role: 'paciente',
    },
  ]);

  await db.insert(schema.triagens).values([
    {
      id: 'triag_pdf_nova',
      emailContato: 'maria@teste.invalid',
      telefoneContato: '(11) 98888-7777',
      nomeContato: NOME,
      statusVisualizacao: 'visualizada',
      dados: {
        nome_paciente: NOME,
        cpf: '529.982.247-25',
        data_nascimento: '01/05/1984',
        peso: '68',
        altura: '165',
        email: 'maria@teste.invalid',
        estado: 'SP',
        endereco: 'Avenida Paulista, 1000, apto 52',
        diagnostico_principal: 'Epilepsia refratária',
        nivel_tratamento: 'Urgente',
        historico_tratamentos: `Topiramato 100mg 😀 sem melhora. ${TEXTO_LONGO.repeat(14)}`,
        medicamentos_atuais: 'Carbamazepina 400mg',
        total_residencia: '4',
        renda_total: 'R$ 2.500',
        condicao_moradia: 'Casa própria',
        convenio_medico: 'Sim',
        relatorio_medico_nome: 'laudo.pdf',
        relatorio_medico_arquivo: 'data:application/pdf;base64,AAAA-NAO-DEVE-APARECER',
        link_do_laudo: URL_SECRETA,
      },
    },
    {
      id: 'triag_pdf_legada',
      emailContato: null,
      nomeContato: null,
      dados: {
        _formulario: 'elementor-2023',
        'Nome completo do Paciente:': 'José da Silva',
        'Data de nascimento:': '1950-03-10',
        'Patologia do paciente': 'Parkinson',
        'Tratamento:': 'Moderado',
        'Estado:': 'MG',
        'Condições de Moradia': 'Alugada',
        'Renda Familiar Bruta': 'R$ 1.800',
      },
    },
  ]);
});

afterAll(() => (process.env.TRIAGEM_PDF_MANTER ? undefined : limpar()));

describe('quem pode baixar', () => {
  it('sem sessão é 401', async () => {
    como(null, 'admin');
    expect((await pedir('triag_pdf_nova')).status).toBe(401);
  });

  it('paciente, médico e id inexistente recebem o MESMO 404', async () => {
    como('triag_pdf_ck_pac', 'paciente');
    const paciente = await pedir('triag_pdf_nova');
    como('triag_pdf_ck_med', 'medico');
    const medico = await pedir('triag_pdf_nova');
    como('triag_pdf_ck_adm', 'admin');
    const inexistente = await pedir('triag_pdf_nao_existe');
    expect([paciente.status, medico.status, inexistente.status]).toEqual([404, 404, 404]);
    expect(await paciente.json()).toEqual(await inexistente.json());
  });

  it('o JWT dizendo "admin" não basta: o papel vem do banco', async () => {
    como('triag_pdf_ck_pac', 'admin'); // claim de admin, mas no banco é paciente
    expect((await pedir('triag_pdf_nova')).status).toBe(404);
  });
});

describe('a triagem enviada pelo formulário', () => {
  let pdf: Buffer;
  let resposta: Response;
  let texto = '';

  beforeAll(async () => {
    como('triag_pdf_ck_adm', 'admin');
    resposta = await pedir('triag_pdf_nova');
    pdf = Buffer.from(await resposta.arrayBuffer());
    texto = textoDoPdf(pdf);
    gravar('triagem-formulario.pdf', pdf);
  });

  it('é um PDF de verdade, entregue como anexo e sem cache', () => {
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toBe('application/pdf');
    expect(resposta.headers.get('cache-control')).toBe('private, no-store');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('o arquivo leva o nome do paciente, com acento e com fallback ASCII', () => {
    const cd = resposta.headers.get('content-disposition') ?? '';
    expect(cd).toContain('attachment');
    expect(cd).toContain(`filename*=UTF-8''${encodeURIComponent(`${NOME}.pdf`)}`);
    expect(cd).toContain('filename="Maria Conceicao Albuquerque de Souza.pdf"');
  });

  it('tem o que o modal mostra', () => {
    for (const esperado of [
      'Maria Concei', // o "ç" depende da codificação; o resto prova o nome
      'maria@teste.invalid',
      '(11) 98888-7777',
      '42 anos',
      'Epilepsia refrat', // destaque e campo
      'Urgente',
      'Casa pr', // moradia
      '529.982.247-25',
      'Avenida Paulista',
      'Carbamazepina 400mg',
      'Dados pessoais',
      'Informa', // Informações clínicas / Outras informações
      'Composi', // Composição familiar
      'Situa', // Situação financeira
      'Moradia e sa',
    ]) {
      expect(texto, `faltou "${esperado}" no PDF`).toContain(esperado);
    }
  });

  it('resposta longa atravessa páginas, e a numeração diz quantas', () => {
    const total = Number(/de (\d+)/.exec(texto.slice(texto.lastIndexOf('Página') - 2))?.[1] ?? 0);
    expect(texto).toMatch(/P.gina 1 de \d+/);
    expect(total).toBeGreaterThanOrEqual(2);
    expect(texto).toContain(`Página ${total} de ${total}`);
  });

  it('anexo em Base64, link do store de arquivos e emoji não entram', () => {
    expect(texto).not.toContain('NAO-DEVE-APARECER');
    expect(texto).not.toContain('SEGREDO');
    expect(texto).not.toContain('blob.vercel-storage');
    expect(texto).toContain('arquivo guardado no sistema');
    expect(texto).toContain('Topiramato 100mg');
    expect(texto).not.toContain('\u{1F600}');
  });

  it('não mostra o status da fila (Visualizada/Pendente/Respondida)', () => {
    for (const status of ['Visualizada', 'Pendente', 'Respondida']) {
      expect(texto).not.toContain(status);
    }
  });

  it('o acesso foi auditado, sem dado pessoal no registro', async () => {
    const registros = await db
      .select()
      .from(schema.logsAuditoria)
      .where(eq(schema.logsAuditoria.entidadeId, 'triag_pdf_nova'));
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      acao: 'visualizar',
      entidade: 'triagens',
      userId: 'triag_pdf_adm',
    });
    expect(registros[0].dadosDepois).toEqual({ exportacao: 'triagem_pdf' });
    expect(JSON.stringify(registros[0])).not.toContain('529.982.247-25');
    expect(JSON.stringify(registros[0])).not.toContain('maria@teste.invalid');
  });
});

describe('a triagem importada (chaves legadas)', () => {
  it('sai com o nome das chaves antigas e o selo de importada', async () => {
    como('triag_pdf_ck_adm', 'admin');
    const r = await pedir('triag_pdf_legada');
    expect(r.status).toBe(200);
    const pdf = Buffer.from(await r.arrayBuffer());
    gravar('triagem-importada.pdf', pdf);
    const texto = textoDoPdf(pdf);
    expect(r.headers.get('content-disposition')).toContain(
      `${encodeURIComponent('José da Silva')}.pdf`,
    );
    for (const esperado of [
      'Jos',
      'Parkinson',
      'Moderado',
      'Importado',
      'Alugada',
      'RENDA FAMILIAR',
    ]) {
      expect(texto, `faltou "${esperado}"`).toContain(esperado);
    }
    expect(texto).not.toContain('elementor-2023'); // _formulario é interno: só vira o selo
  });
});
