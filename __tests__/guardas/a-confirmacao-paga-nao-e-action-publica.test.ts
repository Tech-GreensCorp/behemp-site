/**
 * GUARDA — a confirmação e a cobrança não viram Server Action pública.
 *
 * A CLASSE DE ERRO: no Next, TODA função `async` exportada de um arquivo que começa com
 * `'use server'` vira endpoint público, chamável por POST por qualquer um que saiba o id da
 * action. `confirmarConsultaPaga(consultaId)` não confere quem chama — é o que permite ao
 * webhook do Mercado Pago usá-la sem sessão. Exposta como action, ela CONFIRMARIA QUALQUER
 * CONSULTA SEM PAGAMENTO. `criarCobranca` decifra o token do médico e cobra; exposta, cobraria
 * sem conferir de quem é a consulta.
 *
 * O plano da Parte 2 mandava criá-la DENTRO de `app/(public)/_actions/agendamento.ts`, que é
 * `'use server'`. Foi para `lib/agendamento/confirmar-consulta-paga.ts` por isto.
 *
 * DERIVADO DO CÓDIGO: varre todo arquivo `'use server'` do repositório. Um re-export novo, ou
 * a diretiva acrescentada ao módulo, fica vermelho aqui, nomeado.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const raiz = process.cwd();

/** Funções que NÃO conferem quem chama — e os módulos onde moram. */
const PROTEGIDAS = ['confirmarConsultaPaga', 'criarCobranca'];
const MODULOS = ['lib/agendamento/confirmar-consulta-paga.ts', 'lib/mercadopago/cobranca.ts'];

function arquivosDeFonte(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome.startsWith('.')) continue;
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDeFonte(caminho, achados);
    else if (/\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

/** A diretiva só vale como PRIMEIRA instrução do arquivo (comentários antes não contam). */
function ehUseServer(texto: string): boolean {
  const semComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return /^\s*['"]use server['"]/.test(semComentarios);
}

/** O que um arquivo EXPORTA com esses nomes — declaração, lista ou re-export. */
function exportaProtegida(texto: string): string[] {
  const achados: string[] = [];
  for (const nome of PROTEGIDAS) {
    const declarada = new RegExp(`export\\s+(async\\s+)?(function|const|let)\\s+${nome}\\b`).test(
      texto,
    );
    const emLista = new RegExp(`export\\s*\\{[^}]*\\b${nome}\\b[^}]*\\}`).test(texto);
    if (declarada || emLista) achados.push(nome);
  }
  const reExportaModulo = MODULOS.some((m) => {
    const base = m.replace(/\.ts$/, '').replace(/^/, '@/');
    return new RegExp(`export\\s*\\*\\s*from\\s*['"]${base.replace(/[/.]/g, '\\$&')}['"]`).test(
      texto,
    );
  });
  if (reExportaModulo) achados.push('export * do módulo');
  return achados;
}

describe('🔴 a confirmação e a cobrança não são Server Actions públicas', () => {
  const arquivos = ['app', 'lib', 'components'].flatMap((d) => arquivosDeFonte(path.join(raiz, d)));
  const useServer = arquivos.filter((a) => ehUseServer(readFileSync(a, 'utf8')));

  it('a varredura enxerga os arquivos `use server` que importam (vacuidade)', () => {
    const relativos = useServer.map((a) => path.relative(raiz, a));
    expect(relativos).toContain('app/(public)/_actions/agendamento.ts');
    expect(relativos).toContain('app/(public)/_actions/pagamento.ts');
  });

  it('o detector reconhece exportação e diretiva nas formas reais (vacuidade)', () => {
    expect(ehUseServer("'use server';\nexport async function x() {}")).toBe(true);
    expect(ehUseServer("/** doc */\n'use server';")).toBe(true);
    expect(ehUseServer("import x from 'y';\n// 'use server'")).toBe(false);
    expect(exportaProtegida('export async function confirmarConsultaPaga() {}')).toContain(
      'confirmarConsultaPaga',
    );
    expect(
      exportaProtegida('export { criarCobranca } from "@/lib/mercadopago/cobranca";'),
    ).toContain('criarCobranca');
    expect(
      exportaProtegida("export * from '@/lib/agendamento/confirmar-consulta-paga';"),
    ).toContain('export * do módulo');
    expect(
      exportaProtegida('import { confirmarConsultaPaga } from "x"; confirmarConsultaPaga();'),
    ).toEqual([]);
  });

  it('os módulos que moram as funções NÃO têm `use server`', () => {
    for (const m of MODULOS) {
      expect(ehUseServer(readFileSync(path.join(raiz, m), 'utf8')), m).toBe(false);
    }
  });

  it('nenhum arquivo `use server` exporta nem re-exporta as funções sem autenticação', () => {
    const expostas = useServer.flatMap((a) =>
      exportaProtegida(readFileSync(a, 'utf8')).map((n) => `${path.relative(raiz, a)}: ${n}`),
    );
    expect(expostas).toEqual([]);
  });

  it('a action de cobrança confere a sessão e o DONO da consulta antes de cobrar', () => {
    const acao = readFileSync(path.join(raiz, 'app/(public)/_actions/pagamento.ts'), 'utf8');
    const antesDeCobrar = acao.slice(0, acao.indexOf('await criarCobranca('));
    expect(antesDeCobrar).toContain('verificarPaciente()');
    expect(antesDeCobrar).toMatch(/eq\(consultas\.pacienteId,\s*paciente\.id\)/);
  });
});
