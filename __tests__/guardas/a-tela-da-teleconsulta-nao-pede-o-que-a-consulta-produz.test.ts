/**
 * Guarda: a tela do fluxo da teleconsulta não pede o que a consulta vai produzir — e o que
 * muda nela NÃO vaza para o fluxo da ANVISA.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Em 14/09/2026 o chefe do dono fixou uma regra de negócio nova: **quem não tem receita não
 * tem ANVISA**, porque a autorização de importação é pedida com base na receita. Disso saíram
 * cinco ajustes na tela de cadastro, todos válidos **só** para o paciente que chega sem
 * receita — o do agendamento de teleconsulta.
 *
 * 🔴 O RISCO NÃO É O FLUXO NOVO: É O QUE JÁ FUNCIONA. O caminho da ANVISA está provado de
 * ponta a ponta em produção (`SOL-000065`, 14/09, três documentos materializados e a tela da
 * ANVISA reconhecendo os três). Uma mudança de tela feita sem condição derrubaria esse
 * caminho **em silêncio** — nenhum teste de tipo acusa um `<Secao>` que sumiu, e o sintoma
 * só apareceria com um paciente real no meio do cadastro.
 *
 * ⚠️ E A EXCEÇÃO DO COMPROVANTE É O CASO MAIS FÁCIL DE ERRAR. "Comprovante de residência é
 * opcional" vale **aqui**; no fluxo da ANVISA ele é peça da procuração, e a procuração não
 * sai sem ele. A tentação é mexer em `DOCUMENTOS_OPCIONAIS` — uma linha, e quebra o outro
 * fluxo sem nada ficar vermelho. Por isso a exceção mora na TELA, e este guarda vigia a
 * constante.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DOCUMENTOS_OPCIONAIS, DOCUMENTOS_DO_FLUXO } from '../../lib/parceiros/documentos';
import { DESTINOS, destinoDepoisDoCadastro } from '../../lib/parceiros/destino-do-paciente';

const RAIZ = join(import.meta.dirname, '..', '..');
const FORMULARIO = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';

const fonte = readFileSync(join(RAIZ, FORMULARIO), 'utf8');
const semComentarios = fonte
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const compacto = semComentarios.replace(/\s+/g, ' ');

/**
 * A expressão de guarda de um bloco JSX: tudo entre `{` e o `&& (` que abre o bloco.
 *
 * Mede a CONDIÇÃO, não a formatação — o Prettier quebra essas linhas de jeitos diferentes
 * conforme o comprimento, e um guarda que exige a linha inteira fica vermelho por
 * formatação. Já aconteceu duas vezes neste repositório, em 14/09.
 */
function condicaoDoBloco(gatilho: string): string {
  const i = compacto.indexOf(gatilho);
  if (i === -1) return '';
  const j = compacto.indexOf('&& (', i);
  return j === -1 ? '' : compacto.slice(i, j);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. A REGRA DE DESTINO QUE SUSTENTA TUDO — executada, não lida
// ═══════════════════════════════════════════════════════════════════════════════

describe('o destino continua saindo do que falta, e a ordem é a clínica', () => {
  it('sem receita vai para o agendamento — é o fluxo da teleconsulta', () => {
    expect(destinoDepoisDoCadastro(['receita_medica'])).toBe(DESTINOS.agendamento);
  });

  it('com receita e sem ANVISA vai para a ANVISA', () => {
    expect(destinoDepoisDoCadastro(['autorizacao_anvisa'])).toBe(DESTINOS.anvisa);
  });

  it('🔴 sem os DOIS, a consulta vem antes da procuração', () => {
    /**
     * A procuração da ANVISA instrui importação de um medicamento que ainda não foi
     * prescrito. Inverter a ordem manda o paciente pedir autorização para nada.
     */
    expect(destinoDepoisDoCadastro(['receita_medica', 'autorizacao_anvisa'])).toBe(
      DESTINOS.agendamento,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. O FLUXO É DERIVADO DA PENDÊNCIA, NÃO DO DESTINO
// ═══════════════════════════════════════════════════════════════════════════════

describe('o fluxo da teleconsulta é reconhecido pela pendência da receita', () => {
  it('🔴 a condição NÃO compara destino — as duas constantes são a mesma string', () => {
    /**
     * `DESTINOS.agendamento` e `DESTINOS.teleconsulta` valem ambos `/paciente/agendamento`.
     * Comparar destino diria "é o fluxo da teleconsulta" também para quem não tem pendência
     * NENHUMA — que é o paciente de recompra, outro caso inteiramente.
     */
    expect(DESTINOS.agendamento).toBe(DESTINOS.teleconsulta);
    expect(compacto, 'a derivação do fluxo sumiu').toMatch(/const fluxoDaTeleconsulta =/);
    const decl = compacto.slice(
      compacto.indexOf('const fluxoDaTeleconsulta ='),
      compacto.indexOf('const fluxoDaTeleconsulta =') + 220,
    );
    expect(decl, 'a condição passou a comparar destino, e isso abrange o caso errado').not.toMatch(
      /DESTINOS\./,
    );
    expect(decl).toMatch(/receita_medica/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AS QUATRO MUDANÇAS SÃO CONDICIONADAS — o fluxo da ANVISA fica intacto
// ═══════════════════════════════════════════════════════════════════════════════

describe('nada muda para quem vai tirar a autorização da ANVISA', () => {
  it('🔴 as duas listas só somem no fluxo da teleconsulta', () => {
    /**
     * "O que já recebemos" responde _"será que perderam meus documentos?"_ para quem veio do
     * parceiro com arquivos — foi por isso que ela nasceu, em 10/09. Removê-la sem condição
     * apagaria essa resposta de quem precisa dela.
     */
    const cond = condicaoDoBloco('{pendencias.length > 0');
    expect(cond, 'o bloco das listas sumiu ou perdeu a condição').toMatch(/!fluxoDaTeleconsulta/);
  });

  it('🔴 a pergunta da receita só some no fluxo da teleconsulta', () => {
    const cond = condicaoDoBloco('{perguntarSobreReceita');
    expect(cond, 'a pergunta da receita sumiu ou perdeu a condição').toMatch(
      /!fluxoDaTeleconsulta/,
    );
  });

  it('🔴 o COMPROVANTE não virou opcional na constante', () => {
    /**
     * Executado contra o módulo, não lido do arquivo: é a diferença entre "a intenção está
     * escrita" e "o valor é esse". No fluxo da ANVISA o comprovante é peça da procuração.
     */
    expect(DOCUMENTOS_OPCIONAIS).toEqual(['laudo_medico']);
    expect(DOCUMENTOS_DO_FLUXO).toContain('comprovante_residencia');
  });

  it('🔴 a exceção do comprovante existe, e mora na tela', () => {
    expect(compacto, 'a exceção por fluxo sumiu').toMatch(
      /const ehOpcionalAqui =[\s\S]{0,200}comprovante_residencia/,
    );
    expect(compacto, 'a exceção deixou de depender do fluxo').toMatch(
      /const ehOpcionalAqui =[\s\S]{0,200}fluxoDaTeleconsulta/,
    );
  });

  it('🔴 o rótulo do anexo usa a exceção, não o campo cru', () => {
    // Menção não basta: a função pode existir e o JSX continuar lendo `doc.opcional`.
    const rotulo = compacto.slice(
      compacto.indexOf('<Label htmlFor={`anexo-${doc.chave}`}>'),
      compacto.indexOf('<Label htmlFor={`anexo-${doc.chave}`}>') + 300,
    );
    expect(
      rotulo,
      'o rótulo voltou a ler doc.opcional e o comprovante deixa de ser opcional aqui',
    ).toMatch(/ehOpcionalAqui\(doc\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. O QUE O PACIENTE LÊ
// ═══════════════════════════════════════════════════════════════════════════════

describe('a tela fala a língua que o produto decidiu', () => {
  it('🔴 nenhuma ocorrência de "cannabis medicinal"', () => {
    // Pedido 5 do chefe, 14/09/2026. Vale no arquivo inteiro, comentário incluído: um
    // comentário que ainda diz o termo antigo é o que faz o próximo copiar de volta.
    expect(
      /cannabis\s+medicinal/i.test(fonte),
      'o termo antigo voltou — o produto decidiu "fitocanabinoide"',
    ).toBe(false);
  });

  it('a pergunta do tratamento usa o termo novo', () => {
    expect(compacto).toMatch(/tratamento à base de fitocanabinoide/);
  });

  it('🔴 o texto diz o que é preciso E o que pode vir depois', () => {
    /**
     * ⚠️ RETIFICADO em 14/09/2026, no mesmo dia em que nasceu. A versão anterior exigia a
     * frase _"Nada disso impede você de continuar agora"_ — e o dono apontou que ela é
     * FALSA nesta tela: há um documento que precisamos, e dizer que nada é preciso é a tela
     * desmentindo a si mesma.
     *
     * Havia duas frases sobre a mesma lista, dizendo coisas diferentes: esta e a do rodapé.
     * Viraram uma. A propriedade agora é a que importa: o texto **nomeia** o que precisamos
     * e **oferece** o adiamento do resto.
     */
    const trecho = compacto.slice(
      compacto.indexOf('Documentos para a sua consulta'),
      compacto.indexOf('Documentos para a sua consulta') + 900,
    );
    expect(trecho, 'o texto deixou de dizer QUAL documento precisamos').toMatch(
      /documento com foto/,
    );
    expect(trecho, 'o texto deixou de oferecer o envio posterior').toMatch(/enviar depois/);
    // E nomeia QUAL pode vir depois — com o laudo fora, sobrou um só.
    expect(trecho, 'o texto deixou de nomear o que pode vir depois').toMatch(
      /comprovante de residência/i,
    );
  });

  it('🔴 o texto NÃO promete que nada é preciso', () => {
    // A contradição que o dono pegou: "nada disso impede" com um campo marcado logo abaixo.
    /**
     * ⚠️ SÓ O RAMO VERDADEIRO. A primeira versão pegava 600 caracteres a partir do `? (` e
     * abocanhava o `else` junto — onde a frase antiga é CORRETA, porque o fluxo da ANVISA
     * não tem documento necessário. O caso nasceu vermelho acusando o ramo errado.
     */
    const inicio = compacto.indexOf('fluxoDaTeleconsulta ? (');
    const ramoVerdadeiro = compacto.slice(inicio, compacto.indexOf(') : (', inicio));
    expect(ramoVerdadeiro, 'o ramo do fluxo da teleconsulta sumiu').not.toBe('');
    expect(
      /Nada disso impede/.test(ramoVerdadeiro),
      'voltou a dizer "nada disso impede" no fluxo que tem documento necessário',
    ).toBe(false);
  });

  it('🔴 o LAUDO não é pedido neste fluxo, e NÃO sai do vocabulário', () => {
    /**
     * Decisão do chefe do dono em 14/09/2026: o laudo não é mais necessário na tela da
     * teleconsulta.
     *
     * ⚠️ A parte que importa é a segunda metade. Ele **continua** em `DOCUMENTOS_DO_FLUXO`:
     * quem vem do parceiro pode tê-lo mandado, e a tela precisa saber reconhecê-lo em
     * `recebidos` e no manifesto. Tirá-lo do vocabulário para tirá-lo de UMA tela apagaria
     * um documento que o parceiro envia — e o paciente veria "0 enviados" para algo que
     * mandou, que é o defeito que `o-painel-diz-o-que-falta` existe para impedir.
     */
    expect(DOCUMENTOS_DO_FLUXO, 'o laudo saiu do vocabulário — o parceiro ainda o envia').toContain(
      'laudo_medico',
    );
    expect(compacto, 'a filtragem do laudo por fluxo sumiu').toMatch(
      /anexosDaTela = fluxoDaTeleconsulta[\s\S]{0,200}laudo_medico/,
    );
    expect(compacto, 'a seção de anexos voltou a renderizar a lista sem filtro').toMatch(
      /\{anexosDaTela\.map\(/,
    );
  });

  it('🔴 o rótulo AVISA, não promete trava', () => {
    /**
     * Decisão do dono em 14/09/2026: _"não trave, apenas deixe esse alerta"_. `podeEnviar`
     * não exige anexo nenhum — um rótulo "obrigatório" com o botão liberado promete uma
     * trava que não existe, que é o mesmo defeito do outro lado.
     */
    expect(compacto, 'o aviso do documento necessário sumiu').toMatch(/\(precisamos deste\)/);
    expect(
      /\(obrigatório\)/.test(compacto),
      'o rótulo passou a dizer "obrigatório" — e nada bloqueia o envio',
    ).toBe(false);
  });

  it('🔴 a ANVISA não é perguntada no fluxo da teleconsulta', () => {
    /**
     * Consequência direta de `DO-57`: quem não tem receita não tem ANVISA. Perguntar é pedir
     * que o paciente responda algo que a regra já respondeu — e um "Sim" mandaria para a
     * procuração alguém sem receita para autorizar.
     *
     * ⚠️ E ela continua existindo para o outro fluxo, onde é a pergunta que decide o destino.
     */
    const cond = condicaoDoBloco('{perguntarSobreAnvisa');
    expect(cond, 'a pergunta da ANVISA sumiu ou perdeu a condição').toMatch(/!fluxoDaTeleconsulta/);
  });

  it('a seção de envio tem nome próprio no fluxo da teleconsulta', () => {
    expect(compacto).toMatch(/fluxoDaTeleconsulta \? 'Documentos para a sua consulta'/);
  });
});
