/**
 * Guarda do ENVIO EM LOTE do comunicado "Atualização do Programa de Doação" (telas de Pacientes
 * e de Triagens). Decisão da Dryelle em 20/10/2026: lote permitido, no máximo 25 por disparo, e na
 * triagem quem não tem cadastro de paciente é listado e ignorado.
 *
 * 🔴 O que ele impede de voltar:
 *   · o lote virar um CAMINHO NOVO de envio (DocuSign ou e-mail chamados direto do diálogo, ou o
 *     disparo em paralelo): cada paciente passa pela MESMA action do botão individual, que já tem
 *     autorização de admin, trava de envio duplicado no banco e auditoria por envelope
 *   · o teto de 25 ficar em mais de um lugar, ou deixar de valer na pré-checagem e nas telas
 *   · as duas actions novas perderem a checagem de admin ANTES de tocar o banco, ou deixarem de
 *     ser só leitura (a pré-checagem NÃO envia nada)
 *   · o lote virar componente ÓRFÃO (existir e nenhuma tela o renderizar — é como um aviso passou
 *     quatro semanas sem aparecer) ou a triagem deixar de resolver paciente pelo servidor
 *   · a regra de "pode receber" divergir da de `enviarComunicado` (e-mail, CPF, envio ativo)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  LIMITE_DO_LOTE,
  ROTULO_DA_SITUACAO,
  situacaoNoLote,
  type SituacaoNoLote,
} from '@/lib/comunicados/lote';

const RAIZ = join(__dirname, '..', '..');
const ler = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** Tira comentários, para a asserção olhar o código e não a explicação do código. */
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** O corpo de uma `export async function` até a próxima (ou o fim do arquivo). */
function corpoDe(codigo: string, nome: string): string {
  const i = codigo.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} precisa existir`).toBeGreaterThanOrEqual(0);
  const proxima = codigo.indexOf('\nexport async function ', i + 1);
  return codigo.slice(i, proxima === -1 ? undefined : proxima);
}

const ACOES = semComentarios(ler('app/_actions/comunicados.ts'));
const DIALOGO = semComentarios(ler('components/admin/comunicados/DialogoEnvioEmLote.tsx'));
const PAGINAS = {
  pacientes: semComentarios(ler('app/(admin)/admin/pacientes/page.tsx')),
  triagens: semComentarios(ler('app/(admin)/admin/triagens/page.tsx')),
};
const NOVAS_ACOES = ['previaDoLoteDeComunicados', 'resolverPacientesDasTriagens'];

describe('o lote é só uma fila sobre o envio individual', () => {
  it('cada paciente passa pela action do botão individual, e só por ela', () => {
    expect(DIALOGO).toContain('enviarComunicadoAtualizacaoDoacao(');
    expect(DIALOGO).not.toMatch(/\benviarComunicado\(/);
    expect(DIALOGO).not.toMatch(/@\/lib\/comunicados\/assinatura|@\/lib\/docusign|@\/lib\/email/);
    expect(DIALOGO).not.toMatch(/gerarLinkDeAssinatura|criarEnvelope|enviarAvisoPorEmail/);
  });

  it('o envio é SEQUENCIAL: cada um é um envelope no DocuSign, e uma falha não derruba os outros', () => {
    expect(DIALOGO).not.toMatch(/Promise\.(all|allSettled|race)/);
    expect(DIALOGO).not.toMatch(/\.map\(\s*async/);
    // o laço espera cada envio e isola a falha de cada um
    expect(DIALOGO).toMatch(/for \(let i = 0;[\s\S]*?await enviarComunicadoAtualizacaoDoacao\(/);
    expect(DIALOGO).toMatch(
      /try \{[\s\S]*?await enviarComunicadoAtualizacaoDoacao[\s\S]*?\} catch/,
    );
  });

  it('as duas actions novas só LEEM: pré-checagem não envia nada', () => {
    for (const nome of NOVAS_ACOES) {
      const corpo = corpoDe(ACOES, nome);
      expect(corpo, nome).not.toMatch(/\.(insert|update|delete)\(/);
      expect(corpo, nome).not.toMatch(
        /enviarComunicado\(|gerarLinkDeAssinatura|enviarAvisoPorEmail/,
      );
    }
  });
});

describe('só admin, antes de tocar o banco', () => {
  it.each(NOVAS_ACOES)('%s confere o admin antes de qualquer consulta', (nome) => {
    const corpo = corpoDe(ACOES, nome);
    const admin = corpo.indexOf('await adminAtual()');
    const primeiraConsulta = corpo.search(/await db\b|db\s*\.select|\bdb\b\s*\n?\s*\.select/);
    expect(admin).toBeGreaterThan(-1);
    expect(primeiraConsulta).toBeGreaterThan(admin);
    expect(corpo).toMatch(/if \(!admin\) return \{ sucesso: false/);
  });
});

describe('o teto de 25 mora num lugar só e vale nos dois lados', () => {
  it('a constante vale 25 e só é declarada em lib/comunicados/lote.ts', () => {
    expect(LIMITE_DO_LOTE).toBe(25);
    const fontes = [
      ['app/_actions/comunicados.ts', ACOES],
      ['components/admin/comunicados/DialogoEnvioEmLote.tsx', DIALOGO],
      ['app/(admin)/admin/pacientes/page.tsx', PAGINAS.pacientes],
      ['app/(admin)/admin/triagens/page.tsx', PAGINAS.triagens],
    ] as const;
    for (const [arquivo, codigo] of fontes) {
      expect(codigo, arquivo).not.toMatch(/(const|let|var)\s+LIMITE_DO_LOTE\b/);
    }
  });

  it('as duas actions recusam acima do teto, no servidor', () => {
    expect(ACOES).toMatch(
      /idsDoLoteSchema\s*=\s*z\.array\(idSchema\)\.min\(1\)\.max\(LIMITE_DO_LOTE\)/,
    );
    for (const nome of NOVAS_ACOES) {
      expect(corpoDe(ACOES, nome), nome).toContain('idsDoLoteSchema.safeParse(');
    }
  });

  it.each(['pacientes', 'triagens'] as const)('a tela de %s barra a seleção no teto', (tela) => {
    expect(PAGINAS[tela]).toContain('LIMITE_DO_LOTE');
    expect(PAGINAS[tela]).toMatch(/>= LIMITE_DO_LOTE/);
  });
});

describe('o lote chega à tela', () => {
  it.each(['pacientes', 'triagens'] as const)('a tela de %s renderiza o diálogo', (tela) => {
    const codigo = PAGINAS[tela];
    expect(codigo).toContain("from '@/components/admin/comunicados/DialogoEnvioEmLote'");
    // Com fronteira: `<DialogoEnvioEmLoteX` não pode passar por `<DialogoEnvioEmLote`.
    expect(codigo).toMatch(/<DialogoEnvioEmLote\s/);
    expect(codigo).toMatch(/\bmontarLinhasDoLote\(/);
    expect(codigo).toMatch(/<Checkbox\s/);
  });

  it('a triagem resolve o paciente NO SERVIDOR (não há FK; o elo é o e-mail)', () => {
    expect(PAGINAS.triagens).toContain('resolverPacientesDasTriagens(');
    const corpo = corpoDe(ACOES, 'resolverPacientesDasTriagens');
    expect(corpo).toContain('normalizarEmail(');
    expect(corpo).toContain('isNull(pacientes.deletedAt)');
    expect(corpo).toContain('lower(trim(');
  });
});

describe('quem pode receber: a mesma régua de enviarComunicado', () => {
  const ok = { existe: true, email: 'a@b.com', cpf: '123', temEnvioAtivo: false };

  it('elegível só com ficha, e-mail, CPF e nenhum envio pendente ou assinado', () => {
    expect(situacaoNoLote(ok)).toBe('elegivel');
    expect(situacaoNoLote({ ...ok, existe: false })).toBe('nao_encontrado');
    expect(situacaoNoLote({ ...ok, email: null })).toBe('sem_email');
    expect(situacaoNoLote({ ...ok, email: '   ' })).toBe('sem_email');
    expect(situacaoNoLote({ ...ok, cpf: null })).toBe('sem_cpf');
    expect(situacaoNoLote({ ...ok, cpf: '  ' })).toBe('sem_cpf');
    expect(situacaoNoLote({ ...ok, temEnvioAtivo: true })).toBe('ja_enviado');
  });

  it('a pré-checagem conta só envio PENDENTE ou ASSINADO como "já recebeu" (cancelado e erro reenviam)', () => {
    const corpo = corpoDe(ACOES, 'previaDoLoteDeComunicados');
    expect(corpo).toMatch(/inArray\(comunicadosAssinatura\.status, \['pendente', 'assinado'\]\)/);
    expect(corpo).toContain('TIPO_ATUALIZACAO_PROGRAMA_DOACAO');
  });

  it('as exigências de e-mail e CPF são as mesmas de enviarComunicado (a régua não diverge)', () => {
    const envio = semComentarios(ler('lib/comunicados/assinatura.ts'));
    const corpo = envio.slice(envio.indexOf('export async function enviarComunicado('));
    expect(corpo).toContain('!alvo.email?.trim()');
    expect(corpo).toContain('!alvo.cpf?.trim()');
  });

  it('todo estado do lote tem rótulo na tela (nenhum fica sem explicação)', () => {
    const fonte = ler('lib/comunicados/lote.ts');
    const uniao = fonte.slice(
      fonte.indexOf('export type SituacaoNoLote'),
      fonte.indexOf(';', fonte.indexOf('export type SituacaoNoLote')),
    );
    const declarados = [...uniao.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(declarados.length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(ROTULO_DA_SITUACAO).sort()).toEqual(declarados);
    for (const s of declarados) {
      expect(ROTULO_DA_SITUACAO[s as SituacaoNoLote].length).toBeGreaterThan(3);
    }
  });
});
