/**
 * O log diz o que aconteceu — e não entrega o paciente junto.
 *
 * 🔴 DUAS CLASSES DE ERRO, E ELAS PUXAM EM DIREÇÕES OPOSTAS.
 *
 * 1. **O log que não diz nada.** `erro.name` de um `new Error` é sempre `'Error'`. Catorze
 *    pontos deste repositório logavam isso, e um deles escondeu por quatro dias o
 *    `Cannot use private access on a public store` que impedia TODO documento de paciente de
 *    ser gravado. O log rodava, e dizia `{ erro: 'Error' }`.
 *
 * 2. **O log que diz demais.** A correção óbvia — `erro.message` — foi tentada em 13/09/2026 e
 *    o guarda `cadastro-por-link-abre-sem-conta` a barrou. Medido contra um Postgres real
 *    naquele dia, o Drizzle monta a mensagem com a QUERY INTEIRA e os valores inline:
 *
 *        Failed query: insert into t2 values ('529.982.247-25', 'rg_maria_silva.pdf')
 *
 *    Num `insert` de paciente isso é CPF, telefone e texto clínico direto no log.
 *
 * ⚠️ **Resolver uma sem a outra troca um defeito por um pior.** Este guarda fica vermelho nos
 * dois sentidos, e EXECUTA a função — a versão anterior destes casos lia o arquivo, e foi assim
 * que seis caminhos de documento ficaram quebrados em produção com o guarda verde.
 */
import { describe, expect, it } from 'vitest';

import { motivoLegivel } from '@/lib/erros/motivo-legivel';

/** Um erro do Drizzle como ele chega de verdade — medido, não imaginado. */
function erroDoDrizzle(valores: string, causa: Record<string, string>): Error {
  const e = new Error(`Failed query: insert into pacientes values (${valores})\nparams: `);
  (e as Error & { cause: unknown }).cause = causa;
  return e;
}

const CPF = '529.982.247-25';
const TELEFONE = '(11) 98765-4321';
const NOME_ARQUIVO = 'rg_maria_silva.pdf';
const QUEIXA = 'dor cronica lombar ha 3 anos';

describe('o motivo diagnostica — a classe 1', () => {
  it('erro comum devolve a mensagem, não o nome', () => {
    expect(motivoLegivel(new Error('store privado recusou'))).toBe('store privado recusou');
  });

  it('🔴 e NUNCA devolve a palavra "Error" sozinha', () => {
    // É o defeito que custou quatro dias: três falhas diferentes, a mesma palavra.
    expect(motivoLegivel(new Error('qualquer coisa'))).not.toBe('Error');
  });

  it('erro de banco identifica o QUE falhou', () => {
    const m = motivoLegivel(
      erroDoDrizzle(`'${CPF}'`, {
        code: '23505',
        constraint: 'pacientes_cpf_key',
        table: 'pacientes',
      }),
    );
    expect(m).toContain('23505');
    expect(m, 'sem a constraint, "erro de banco" não diz qual').toContain('pacientes_cpf_key');
  });

  it('erro de rede identifica a causa, não o genérico do fetch', () => {
    const e = new Error('fetch failed');
    (e as Error & { cause: unknown }).cause = { code: 'ECONNREFUSED' };
    expect(motivoLegivel(e)).toContain('ECONNREFUSED');
  });

  it('o que não é Error tem motivo próprio, e não vira string vazia', () => {
    expect(motivoLegivel('texto solto')).toBe('erro_desconhecido');
    expect(motivoLegivel(null)).toBe('erro_desconhecido');
    expect(motivoLegivel(undefined)).toBe('erro_desconhecido');
  });
});

describe('🔴 e não vaza — a classe 2', () => {
  it.each([
    ['CPF', CPF],
    ['telefone', TELEFONE],
    ['nome de arquivo com nome de pessoa', NOME_ARQUIVO],
    ['queixa clínica', QUEIXA],
  ])('a query do Drizzle com %s não chega ao log', (_rotulo, valor) => {
    const m = motivoLegivel(
      erroDoDrizzle(`'${valor}'`, { code: '23505', constraint: 'x_key', table: 'pacientes' }),
    );
    expect(m, 'o valor da coluna vazou para o log').not.toContain(valor);
  });

  it('🔴 nem quando o erro do Drizzle vem SEM cause', () => {
    /**
     * A rede de segurança. Driver diferente, versão nova, erro reembrulhado: se a mensagem
     * ainda é uma query, ela não passa inteira — mesmo sem `code` para reconhecê-la.
     */
    const e = new Error(`Failed query: insert into pacientes values ('${CPF}', '${QUEIXA}')`);
    const m = motivoLegivel(e);
    expect(m).not.toContain(CPF);
    expect(m).not.toContain(QUEIXA);
  });

  it('a URL assinada do parceiro é redigida, não truncada', () => {
    /**
     * ⚠️ Truncar deixaria o começo, e o começo identifica o bucket. URL presignada É
     * credencial: quem a lê baixa o documento do paciente.
     */
    const m = motivoLegivel(
      new Error(
        'falhou em https://greens-site-bucket.s3.us-east-1.amazonaws.com/rg.pdf?X-Amz-Signature=deadbeef',
      ),
    );
    expect(m).not.toContain('X-Amz');
    expect(m).not.toContain('amazonaws');
    expect(m).not.toContain('greens-site-bucket');
    expect(m, 'redigir não pode apagar o resto da frase').toContain('falhou em');
    expect(m).toContain('<url>');
  });

  it('mesmo com VÁRIAS urls na mesma mensagem', () => {
    const m = motivoLegivel(new Error('de https://a.com/x?s=1 para https://b.com/y?s=2'));
    expect(m).not.toContain('a.com');
    expect(m).not.toContain('b.com');
  });

  /**
   * 🔴 A SEGUNDA CAMADA — acrescentada em 13/09/2026.
   *
   * O ramo de banco descarta a mensagem inteira, e resolve o caso do Drizzle. Mas o `catch`
   * da transação do cadastro cobre mais que o banco: erro do Clerk, do blob, de integração.
   * A mensagem do Clerk cita o e-mail de quem tentou — foi assim que a causa do `400` apareceu
   * em 13/09, com o endereço dentro.
   */
  it.each([
    [
      'e-mail',
      'falhou para maria.silva+teste@exemplo.com.br agora',
      'maria.silva+teste@exemplo.com.br',
    ],
    ['CPF com pontos', 'documento 529.982.247-25 recusado', '529.982.247-25'],
    ['CPF sem pontos', 'documento 52998224725 recusado', '52998224725'],
    ['telefone', 'ligar para (98) 97013-4822 depois', '97013-4822'],
  ])('%s não sobrevive na mensagem', (_rotulo, mensagem, segredo) => {
    const m = motivoLegivel(new Error(mensagem));
    expect(m, `${_rotulo} vazou para o log`).not.toContain(segredo);
  });

  it('mas a frase continua legível depois de redigir', () => {
    // Redigir não pode virar apagar: o log precisa continuar dizendo O QUE aconteceu.
    const m = motivoLegivel(new Error('falhou para joao@exemplo.com no passo 3'));
    expect(m).toContain('falhou para');
    expect(m).toContain('no passo 3');
    expect(m).toContain('<email>');
  });

  it('o motivo cabe num log e numa coluna', () => {
    expect(motivoLegivel(new Error('x'.repeat(5000))).length).toBeLessThanOrEqual(120);
  });
});

describe('o guarda tem o que medir (vacuidade)', () => {
  it('a função existe e responde', () => {
    expect(typeof motivoLegivel).toBe('function');
    expect(motivoLegivel(new Error('prova'))).toBeTruthy();
  });

  it('e distingue casos diferentes — se devolvesse constante, tudo acima passaria', () => {
    const a = motivoLegivel(new Error('primeiro'));
    const b = motivoLegivel(new Error('segundo'));
    expect(a).not.toBe(b);
  });
});
