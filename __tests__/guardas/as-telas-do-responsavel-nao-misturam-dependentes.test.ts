/**
 * AS TELAS DO RESPONSÁVEL NÃO MISTURAM DEPENDENTES — ADR-0033, pedido de Dryelle em 29/10/2026.
 *
 * O pedido: o responsável SEM dependentes não vê nada que dependa de um paciente (nem "Sua jornada"); com um ou
 * VÁRIOS, cada dado é identificado pelo NOME do dependente e nada se mistura. O COMPORTAMENTO dos dados é provado
 * contra Postgres real em `__tests__/integracao/o-responsavel-pede-e-le-so-do-dependente-dele`. Este guarda
 * vigia a ESTRUTURA, e renderiza de verdade os componentes de apresentação.
 *
 * 🔴 AS CLASSES DE ERRO:
 *   1. **Página de dependente sem a prova do vínculo.** O `pacienteId` vem da URL (entrada do usuário). Um layout
 *      NÃO protege a página filha (o Next renderiza as duas em paralelo): cada `page.tsx` de `[pacienteId]` chama
 *      `carregarDependente`, e usa o `pacienteId` que ELE devolve, nunca o da URL.
 *   2. **Leitura que decide acesso.** `lib/dependentes/leituras.ts` NÃO importa `auth`: ele não tem como decidir
 *      quem pode ler; quem chama já provou o vínculo. Uma segunda regra de acesso divergiria da primeira.
 *   3. **"Sua jornada" para quem não é o paciente.** O responsável vê "Jornada de <nome>", e só dentro da lista de
 *      dependentes: sem dependentes, o cartão nem existe na tela.
 *   4. **Dependente sem rótulo.** Uma fase da jornada sem texto na tela aparece como o código cru.
 *
 * ⚠️ O QUE NÃO PROVA: o que o navegador mostra com uma sessão real do Clerk. Isso NÃO foi visto.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { jornadaFaseEnum, pacienteStatusEnum } from '../../db/schema/enums';
import { semComentarios } from './_apoio/codigo';

vi.mock('next/navigation', () => ({
  usePathname: () => '/responsavel/dependentes/dep-1',
  useRouter: () => ({ push() {}, refresh() {}, replace() {} }),
}));
vi.mock('@clerk/nextjs', () => ({ useClerk: () => ({ signOut: async () => {} }) }));
vi.mock('@/app/_actions/dependentes', () => ({
  cadastrarDependente: async () => ({ sucesso: true }),
}));
vi.mock('@/app/_actions/recompras', () => ({
  solicitarRecompraManual: async () => ({ sucesso: true }),
}));
vi.mock('@/app/_actions/perfil-paciente', () => ({
  atualizarPerfilCompletoPaciente: async () => ({ sucesso: true }),
}));
vi.mock('sonner', () => ({ toast: { success() {}, error() {} } }));

const RAIZ = join(__dirname, '..', '..');
const codigo = (p: string) => semComentarios(readFileSync(join(RAIZ, p), 'utf8'));

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, acc);
    else if (/\.(ts|tsx)$/.test(nome)) acc.push(caminho);
  }
  return acc;
}
const rel = (p: string) => relative(RAIZ, p).replace(/\\/g, '/');

const PASTA_DO_DEPENDENTE = join(
  RAIZ,
  'app',
  '(responsavel)',
  'responsavel',
  'dependentes',
  '[pacienteId]',
);
const PAGINAS_DO_DEPENDENTE = arquivos(PASTA_DO_DEPENDENTE)
  .filter((p) => /(page|layout)\.tsx$/.test(p))
  .map((p) => ({ caminho: rel(p), codigo: semComentarios(readFileSync(p, 'utf8')) }));

const TELAS_DO_RESPONSAVEL = [
  ...arquivos(join(RAIZ, 'app', '(responsavel)')),
  ...arquivos(join(RAIZ, 'components', 'responsavel')),
].map((p) => ({ caminho: rel(p), codigo: semComentarios(readFileSync(p, 'utf8')) }));

describe('1. toda página de UM dependente prova o vínculo, por conta própria', () => {
  it('⚠️ VACUIDADE: o guarda enxerga as seis páginas e o layout de [pacienteId]', () => {
    const nomes = PAGINAS_DO_DEPENDENTE.map((p) => p.caminho.split('[pacienteId]/')[1]).sort();
    expect(nomes).toEqual([
      'consultas/page.tsx',
      'documentos/page.tsx',
      'layout.tsx',
      'medicamentos/page.tsx',
      'page.tsx',
      'solicitacoes/page.tsx',
    ]);
  });

  it('🔴 cada uma chama `carregarDependente(` (o layout não protege a página filha)', () => {
    const sem = PAGINAS_DO_DEPENDENTE.filter((p) => !/carregarDependente\(/.test(p.codigo)).map(
      (p) => p.caminho,
    );
    expect(sem, 'página de dependente sem a prova do vínculo').toEqual([]);
  });

  it('🔴 os dados são lidos com o `pacienteId` que o resolvedor DEVOLVE, nunca o da URL', () => {
    const leituras =
      /(listar\w+DoDependente|resumoDoDependente|obterFichaDoDependente)\(\s*([\w.]+)\s*\)/g;
    for (const p of PAGINAS_DO_DEPENDENTE) {
      for (const m of p.codigo.matchAll(leituras)) {
        expect(m[2], `${p.caminho}: ${m[1]}(${m[2]}) usa o id da URL`).toBe('escopo.pacienteId');
      }
    }
  });

  it('🔴 nenhuma página fala com o banco: lê pelas funções do módulo, depois da prova', () => {
    const com = PAGINAS_DO_DEPENDENTE.filter((p) =>
      /from '@\/lib\/db'|from '@\/db\/schema'/.test(p.codigo),
    ).map((p) => p.caminho);
    expect(com).toEqual([]);
  });

  it('🔴 a porta devolve 404 (notFound), nunca uma resposta diferente para "não é seu"', () => {
    const porta = codigo('app/(responsavel)/_lib/carregar-dependente.ts');
    expect(porta).toMatch(/garantirResponsavelDoPaciente\(/);
    expect([...porta.matchAll(/notFound\(\)/g)]).toHaveLength(2);
    expect(porta).not.toMatch(/redirect\(|403|status/);
  });
});

describe('2. as leituras não decidem acesso', () => {
  const leituras = codigo('lib/dependentes/leituras.ts');

  it('🔴 `leituras.ts` não importa `auth` nem lê a sessão', () => {
    expect(leituras).not.toMatch(/from '@\/lib\/auth|obterUsuarioAtual|auth\(\)|clerk/i);
  });

  it('🔴 toda função recebe SÓ um `pacienteId` (nunca clerkId nem userId)', () => {
    const assinaturas = [...leituras.matchAll(/export async function (\w+)\(\s*([^)]*)\)/g)];
    expect(assinaturas.length).toBeGreaterThanOrEqual(6);
    for (const [, nome, args] of assinaturas) {
      expect(args.replace(/\s+/g, ' ').trim().replace(/,$/, ''), nome).toBe('pacienteId: string');
    }
  });

  it('🔴 cada leitura filtra o apagado (deleted_at), menos a de recompras, que não tem a coluna', () => {
    const corpos = leituras.split('export async function ').slice(1);
    for (const corpo of corpos) {
      const nome = corpo.slice(0, corpo.indexOf('('));
      if (nome === 'listarRecomprasDoDependente') continue;
      expect(corpo, nome).toMatch(/deleted_at|deletedAt/);
    }
  });

  it('o documento só vai como metadado: nunca a URL do arquivo', () => {
    const f = leituras.slice(leituras.indexOf('listarDocumentosDoDependente'));
    expect(f).not.toMatch(/urlBlob|url_blob/);
  });
});

describe('3. sem dependentes não há "Sua jornada": o cartão só existe dentro da lista', () => {
  it('🔴 nenhum texto "Sua jornada" nas telas do responsável', () => {
    const onde = TELAS_DO_RESPONSAVEL.filter((f) => /Sua\s+Jornada/i.test(f.codigo)).map(
      (f) => f.caminho,
    );
    expect(onde).toEqual([]);
  });

  it('🔴 no painel, `JornadaDoDependente` só aparece dentro do `blocos.map(`', () => {
    const p = codigo('app/(responsavel)/responsavel/page.tsx');
    const usos = [...p.matchAll(/<JornadaDoDependente\b/g)].map((m) => m.index!);
    expect(usos).toHaveLength(1);
    const mapa = p.indexOf('blocos.map(');
    expect(mapa).toBeGreaterThan(-1);
    expect(usos[0]).toBeGreaterThan(mapa);
    // E o ramo SEM dependentes vem antes e não renderiza o cartão.
    const vazio = p.indexOf('dependentes.length === 0');
    expect(vazio).toBeGreaterThan(-1);
    expect(vazio).toBeLessThan(mapa);
  });

  it('o responsável SEM dependentes vê só o convite para cadastrar (renderizado)', () => {
    // `Button render={<Link/>}` e `next/link` renderizam como estão; o conteúdo do ramo vazio é estático.
    const p = codigo('app/(responsavel)/responsavel/page.tsx');
    const ramoVazio = p.slice(p.indexOf('dependentes.length === 0'), p.indexOf('blocos.map('));
    expect(ramoVazio).toMatch(/Cadastre o primeiro dependente/);
    expect(ramoVazio).not.toMatch(/Jornada|Medicamento|Consulta|Documento|ANVISA/);
  });
});

describe('4. rótulos', () => {
  it('toda fase da jornada e todo status de paciente tem rótulo (senão a tela mostra o código cru)', async () => {
    const { LABEL_JORNADA, LABEL_STATUS_DO_PACIENTE, JORNADA_ORDEM } = await import(
      '../../lib/dependentes/rotulos'
    );
    for (const fase of jornadaFaseEnum.enumValues) expect(LABEL_JORNADA[fase], fase).toBeTruthy();
    for (const s of pacienteStatusEnum.enumValues)
      expect(LABEL_STATUS_DO_PACIENTE[s], s).toBeTruthy();
    // E a ordem do stepper é a do enum: nenhuma fase some do desenho.
    expect([...JORNADA_ORDEM]).toEqual([...jornadaFaseEnum.enumValues]);
  });
});

describe('5. renderização real dos componentes de apresentação', () => {
  it('"Jornada de <primeiro nome>", com o médico, e nada de "Sua jornada"', async () => {
    const { JornadaDoDependente } = await import(
      '../../components/responsavel/jornada-do-dependente'
    );
    const html = renderToStaticMarkup(
      React.createElement(JornadaDoDependente, {
        nome: 'Ana Souza Lima',
        fase: 'avaliacao_medica',
        status: 'aguardando_consulta',
        medicoNome: 'Dra. Helena',
      }),
    );
    expect(html).toContain('Jornada de Ana');
    expect(html).toContain('Avaliação Médica');
    expect(html).toContain('Dra. Helena');
    expect(html).not.toMatch(/Sua\s+Jornada/i);
  });

  it('o menu: com 3 dependentes lista os 3 pelo NOME, e as seções são só do aberto', async () => {
    const { montarGruposDoMenu } = await import('../../lib/dependentes/menu');
    const dependentes = [
      { pacienteId: 'dep-1', nome: 'Ana Souza' },
      { pacienteId: 'dep-2', nome: 'Bruno Souza' },
      { pacienteId: 'dep-3', nome: 'Caio Souza' },
    ];
    const grupos = montarGruposDoMenu({
      dependentes,
      pathname: '/responsavel/dependentes/dep-1',
      temAreaDePaciente: false,
    });
    const lista = grupos.find((g) => g.title === 'Dependentes')!;
    expect(lista.items.map((i) => i.label)).toEqual(['Ana Souza', 'Bruno Souza', 'Caio Souza']);
    expect(lista.items.map((i) => i.href)).toEqual([
      '/responsavel/dependentes/dep-1',
      '/responsavel/dependentes/dep-2',
      '/responsavel/dependentes/dep-3',
    ]);
    // Só o aberto (dep-1) ganha as seções, com o título que diz de quem são e o id DELE nos links.
    const secoes = grupos.find((g) => g.title.startsWith('Dados de'))!;
    expect(secoes.title).toBe('Dados de Ana');
    for (const item of secoes.items)
      expect(item.href).toMatch(/^\/responsavel\/dependentes\/dep-1\//);
    expect(secoes.items.map((i) => i.label)).toEqual([
      'Medicamentos',
      'Documentos',
      'Solicitações',
      'Consultas',
    ]);
    expect(grupos.filter((g) => g.title.startsWith('Dados de'))).toHaveLength(1);
    // Fora de um dependente (a lista), nenhuma seção aparece.
    const fora = montarGruposDoMenu({
      dependentes,
      pathname: '/responsavel/dependentes',
      temAreaDePaciente: false,
    });
    expect(fora.some((g) => g.title.startsWith('Dados de'))).toBe(false);
    // E um id que NÃO é de nenhum dos dependentes do menu não abre seção nenhuma.
    const alheio = montarGruposDoMenu({
      dependentes,
      pathname: '/responsavel/dependentes/dep-99',
      temAreaDePaciente: false,
    });
    expect(alheio.some((g) => g.title.startsWith('Dados de'))).toBe(false);
  });

  it('o menu SEM dependentes não tem grupo de dependentes nem seções de paciente', async () => {
    const { montarGruposDoMenu } = await import('../../lib/dependentes/menu');
    const grupos = montarGruposDoMenu({
      dependentes: [],
      pathname: '/responsavel',
      temAreaDePaciente: false,
    });
    expect(grupos.map((g) => g.title)).toEqual(['Geral']);
    expect(grupos[0].items.map((i) => i.label)).toEqual(['Início', 'Seus dependentes']);
  });

  it('a barra lateral desenha o que a função devolve (renderizada)', async () => {
    const { SidebarDoResponsavel } = await import(
      '../../components/responsavel/sidebar-do-responsavel'
    );
    const html = renderToStaticMarkup(
      React.createElement(SidebarDoResponsavel, {
        dependentes: [{ pacienteId: 'dep-1', nome: 'Ana Souza' }],
        temAreaDePaciente: false,
      }),
    );
    expect(html).toContain('/responsavel/dependentes/dep-1');
    expect(html).toContain('/responsavel/dependentes/dep-1/medicamentos');
    expect(html).toContain('title="Ana Souza"');
  });
  it('o paciente que também é responsável ganha o caminho de volta à própria área', async () => {
    const { SidebarDoResponsavel } = await import(
      '../../components/responsavel/sidebar-do-responsavel'
    );
    const html = renderToStaticMarkup(
      React.createElement(SidebarDoResponsavel, { dependentes: [], temAreaDePaciente: true }),
    );
    expect(html).toContain('Minha área de paciente');
    expect(html).toContain('href="/paciente"');
  });

  it('o cadastro do dependente mostra os campos do cadastro da equipe, e nenhum campo interno', async () => {
    const { FormularioDeDependente } = await import(
      '../../components/responsavel/formulario-de-dependente'
    );
    const html = renderToStaticMarkup(React.createElement(FormularioDeDependente));
    for (const rotulo of [
      'Nome completo',
      'Data de nascimento',
      'RG',
      'Peso (kg)',
      'Histórico médico',
      'Patologia',
      'CID',
      'Tipo de tratamento',
      'Hospital mais próximo',
      'Possui plano de saúde',
      'Seu CPF',
    ]) {
      expect(html, rotulo).toContain(rotulo);
    }
    for (const interno of [
      'Valor da Contribuição',
      'Termo de Associado',
      'Categorização',
      'Etapa',
      'Data de Associação',
    ]) {
      expect(html, `${interno} é da equipe`).not.toContain(interno);
    }
  });
});
