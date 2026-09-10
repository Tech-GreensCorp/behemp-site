/**
 * GUARDA — o paciente que vem do parceiro cai no lugar certo, e a ordem entre os dois casos
 * não se inverte.
 *
 * A CLASSE DE ERRO: até 10/09/2026 o destino depois do cadastro era fixo — todo mundo ia para
 * `/paciente/teleconsulta`. Os dois fluxos que a Greens encaminha querem coisas diferentes:
 *
 *   sem ANVISA (tem receita)  → procuração. Agendar consulta seria repetir um ato médico.
 *   sem receita               → agendamento. A receita só existe depois de um médico avaliar.
 *
 * 🔴 E QUANDO FALTAM OS DOIS, A CONSULTA VEM PRIMEIRO. A procuração instrui um pedido de
 * importação de um medicamento que ainda não foi prescrito; sem receita não há o que
 * autorizar. Inverter a ordem manda o paciente preencher uma procuração vazia.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DESTINOS, destinoDepoisDoCadastro } from '@/lib/parceiros/destino-do-paciente';

const FORM = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
const codigo = readFileSync(path.join(process.cwd(), FORM), 'utf8');

describe('o destino segue o que falta', () => {
  it('sem receita → agendamento (fluxo 2 da Greens)', () => {
    expect(destinoDepoisDoCadastro(['receita_medica'])).toBe(DESTINOS.agendamento);
  });

  it('com receita e sem ANVISA → procuração (fluxo 1 da Greens)', () => {
    expect(destinoDepoisDoCadastro(['autorizacao_anvisa'])).toBe(DESTINOS.anvisa);
  });

  it('🔴 faltando os DOIS, a consulta vem primeiro — sem receita não há o que autorizar', () => {
    expect(destinoDepoisDoCadastro(['receita_medica', 'autorizacao_anvisa'])).toBe(
      DESTINOS.agendamento,
    );
    // e a ordem inversa da lista não muda a decisão
    expect(destinoDepoisDoCadastro(['autorizacao_anvisa', 'receita_medica'])).toBe(
      DESTINOS.agendamento,
    );
  });

  it('sem pendência nenhuma, o caminho de sempre', () => {
    expect(destinoDepoisDoCadastro([])).toBe(DESTINOS.teleconsulta);
  });

  it('pendência que não é nenhuma das duas não muda o destino', () => {
    expect(destinoDepoisDoCadastro(['comprovante_residencia', 'laudo_medico'])).toBe(
      DESTINOS.teleconsulta,
    );
  });
});

describe('a tela usa a regra, em vez de decidir por conta própria', () => {
  it('o formulário chama a função, e não empurra rota fixa', () => {
    expect(codigo).toContain('destinoDepoisDoCadastro(');
    // o push tem de ser da variável decidida, nunca de uma string literal
    expect(codigo).toMatch(/router\.push\(destino\)/);
    expect(codigo).not.toMatch(/router\.push\('\/paciente\/teleconsulta'\)/);
  });

  it('as três rotas de destino existem no produto', () => {
    // Um destino que não existe manda o paciente para um 404 no melhor momento dele.
    expect(Object.values(DESTINOS)).toEqual([
      '/agendamento',
      '/paciente/anvisa',
      '/paciente/teleconsulta',
    ]);
  });
});
