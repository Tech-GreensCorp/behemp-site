/**
 * GUARDA — todo filtro SQL de reserva vencida carrega a trava do pagamento em curso.
 *
 * Parte 2, Fase 4 (28/09/2026). Uma reserva vencida com PIX ainda pagável
 * (`consultas.pix_valido_ate > agora`) ou pagamento `em_processamento` NÃO pode ser liberada:
 * o horário iria para outro paciente, e o pagamento aprovado depois cairia em
 * `pago_sem_horario`. A regra mora em `semPagamentoEmCurso()`
 * (`lib/agendamento/liberar-reservas-expiradas.ts`), e a integração
 * `a-expiracao-respeita-o-pagamento-em-curso` prova que ela funciona.
 *
 * 🔴 O QUE ESTE GUARDA COBRE que a integração não cobre: os OUTROS caminhos que liberam
 * reserva vencida. Havia dois ao escrever a Fase 4 — o job e `expirarReservasVencidasDoPaciente`
 * (`app/(public)/_actions/agendamento.ts`), que roda a cada vez que o paciente abre a tela de
 * agendamento. Sem a trava ali, o paciente que volta à tela para ver o QR code do PIX cancelaria
 * a própria reserva.
 *
 * DERIVA DO CÓDIGO: todo arquivo de `app/` e `lib/` que filtra `consultas.expiraEm` vencido em
 * SQL (`lte`/`lt`) precisa chamar `semPagamentoEmCurso(` pelo menos tantas vezes quanto filtra.
 *
 * ⚠️ LIMITE: comparação em JavaScript (`reserva.expiraEm.getTime() < Date.now()`) não entra —
 * `confirmarConsultaPaga` e `iniciarAguardoPagamento` cancelam assim, e ficaram catalogados.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const raiz = process.cwd();

function arquivosDeFonte(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome.startsWith('.')) continue;
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDeFonte(caminho, achados);
    else if (/\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

const FILTRO_DE_VENCIDA = /\blte?\(\s*consultas\.expiraEm\b/g;
const TRAVA = /\bsemPagamentoEmCurso\(/g;

const contar = (texto: string, re: RegExp) => (texto.match(re) ?? []).length;

const comFiltro = ['app', 'lib']
  .flatMap((d) => arquivosDeFonte(path.join(raiz, d)))
  .map((a) => ({ arquivo: path.relative(raiz, a), texto: readFileSync(a, 'utf8') }))
  .filter(({ texto }) => contar(texto, FILTRO_DE_VENCIDA) > 0);

describe('o guarda tem o que medir (vacuidade)', () => {
  it('acha os dois caminhos que liberam reserva vencida em SQL', () => {
    const arquivos = comFiltro.map((c) => c.arquivo);
    expect(arquivos).toContain('app/(public)/_actions/agendamento.ts');
    expect(arquivos).toContain('lib/agendamento/liberar-reservas-expiradas.ts');
  });

  it('o detector reconhece as formas reais e não o que só parece', () => {
    expect(contar('lte(consultas.expiraEm, agora)', FILTRO_DE_VENCIDA)).toBe(1);
    expect(contar('lt( consultas.expiraEm, new Date())', FILTRO_DE_VENCIDA)).toBe(1);
    expect(contar('gte(consultas.expiraEm, agora)', FILTRO_DE_VENCIDA)).toBe(0);
    expect(contar('import { semPagamentoEmCurso } from', TRAVA)).toBe(0);
    expect(contar('and(x, semPagamentoEmCurso(agora))', TRAVA)).toBe(1);
  });
});

describe('🔴 todo filtro de reserva vencida carrega a trava', () => {
  it.each(comFiltro.map((c) => [c.arquivo, c.texto] as const))('%s', (arquivo, texto) => {
    const filtros = contar(texto, FILTRO_DE_VENCIDA);
    const travas = contar(texto, TRAVA);
    expect(
      travas,
      `${arquivo} filtra reserva vencida ${filtros}× e chama semPagamentoEmCurso() ${travas}× — ` +
        'uma liberação sem a trava cancela reserva com PIX pagável ou cartão em análise',
    ).toBeGreaterThanOrEqual(filtros);
  });

  it('a trava lê as duas proteções — PIX pagável e pagamento em processamento', () => {
    const lib = readFileSync(
      path.join(raiz, 'lib/agendamento/liberar-reservas-expiradas.ts'),
      'utf8',
    );
    const corpo = lib.slice(lib.indexOf('export function semPagamentoEmCurso'));
    const fim = corpo.indexOf('\n}\n');
    const trava = corpo.slice(0, fim);
    expect(trava).toMatch(/isNull\(consultas\.pixValidoAte\)/);
    expect(trava).toMatch(/lte\(consultas\.pixValidoAte, agora\)/);
    expect(trava).toMatch(/eq\(pagamentos\.status, 'em_processamento'\)/);
    expect(trava).toMatch(/not\(\s*exists\(/);
  });
});
