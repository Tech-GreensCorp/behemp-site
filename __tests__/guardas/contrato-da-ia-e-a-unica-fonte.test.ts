/**
 * Guarda: o contrato da IA é a única fonte do formato, e os fixtures o respeitam.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * A [ADR-0002](../../docs/adr/ADR-0002-ui-antes-da-inteligencia.md) decidiu construir a UI
 * antes de ligar o motor. O único risco real dessa ordem, nomeado na própria ADR (§1.3), é
 * **desenhar contra dado imaginado** — e descobrir na integração que o formato era outro,
 * justamente nas telas de decisão clínica.
 *
 * Três coisas impedem isso, e este guarda cobra as três:
 *   1. o formato vive em UM lugar (`lib/ia-clinica/contrato.ts`), não em cada componente;
 *   2. existe **resposta real congelada** como fixture, e ela carrega no contrato;
 *   3. existe o caso de **resposta parcial** — porque tela testada só com resposta completa
 *      quebra na primeira parcial, e parcial é o caso comum.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { corpoDoTipo, semComentarios, valoresDeCampoInline, valoresDeUnion } from './_apoio/codigo';

import {
  FRONTEIRA_MOTOR_IA,
  achadoEhInferidoPelaIa,
  faixaDeConfianca,
  grafoEstaParcial,
  type RespostaAnalise,
} from '@/lib/ia-clinica/contrato';

const RAIZ = join(import.meta.dirname, '..', '..');
const FIXTURES = join(RAIZ, '__fixtures__/ia-clinica');
const CONTRATO_FONTE = readFileSync(join(RAIZ, 'lib/ia-clinica/contrato.ts'), 'utf8');

function carregar(arquivo: string): RespostaAnalise {
  return JSON.parse(readFileSync(join(FIXTURES, arquivo), 'utf8')) as RespostaAnalise;
}

describe('os fixtures são resposta real e carregam no contrato', () => {
  it('o diretório canônico de fixtures existe e não está vazio', () => {
    expect(existsSync(FIXTURES), '__fixtures__/ia-clinica não existe').toBe(true);
    const json = readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));
    expect(json.length, 'nenhum fixture — o guarda passaria sobre zero').toBeGreaterThanOrEqual(2);
  });

  it('a resposta COMPLETA tem a forma do envelope, não do grafo cru', () => {
    const r = carregar('resposta-completa-teleconsulta.json');
    // O erro mais provável de quem integra: programar contra o grafo na raiz.
    expect(r.grafo, 'o envelope perdeu a chave `grafo`').toBeDefined();
    expect(Array.isArray(r.blocos), '`blocos` não é array').toBe(true);
    expect(r.analiseIA, 'o envelope perdeu `analiseIA`').toBeDefined();

    expect(r.grafo.achados.length).toBeGreaterThan(0);
    expect(r.grafo.hipoteses.length).toBeGreaterThan(0);
    expect(r.grafo.arestas.length).toBeGreaterThan(0);
    expect(r.grafo.sindrome.titulo).toBeTruthy();
  });

  it('a resposta PARCIAL carrega sem erro — se o tipo não a aceita, o tipo está errado', () => {
    const r = carregar('resposta-parcial-truncada.json');
    // É o critério de aceite da Sprint 2: nenhuma hipótese, análise quase vazia, e ainda assim
    // um objeto válido do contrato.
    expect(r.grafo.hipoteses).toEqual([]);
    expect(r.grafo.confianca, 'o motor omite confiança quando não calibra').toBeUndefined();
    expect(r.grafo.completude?.nivel).toBe('parcial');
    expect(r.grafo.completude?.motivos.length).toBeGreaterThan(0);
  });

  it('grafoEstaParcial trata os DOIS campos que dizem parcial', () => {
    // No fixture real, `parcial: false` convive com `completude.nivel: 'parcial'`. Uma tela que
    // leia só `parcial` mostra "completo" sobre um grafo com red flags não explicadas.
    const completa = carregar('resposta-completa-teleconsulta.json');
    expect(completa.grafo.parcial).toBe(false);
    expect(completa.grafo.completude?.nivel).toBe('parcial');
    expect(
      grafoEstaParcial(completa.grafo),
      'o helper ignorou completude.nivel e chamou de completo um grafo parcial',
    ).toBe(true);

    expect(
      grafoEstaParcial({
        parcial: false,
        completude: {
          nivel: 'completo',
          inconclusivos: 0,
          red_flags_nao_explicadas: 0,
          motivos: [],
        },
      }),
    ).toBe(false);
  });

  it('a origem do achado é distinguível — IA × registro humano', () => {
    const r = carregar('resposta-completa-teleconsulta.json');
    // Sem isto, sugestão de modelo e fato registrado aparecem iguais na tela (ADR-0002 D-03).
    for (const a of r.grafo.achados) {
      expect(a.proveniencia, `achado ${a.id} sem proveniência`).toBeTruthy();
    }
    expect(achadoEhInferidoPelaIa({ proveniencia: 'inferido_ia' })).toBe(true);
    expect(achadoEhInferidoPelaIa({ proveniencia: 'historico_validado' })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 TODO VALOR DE TODO FIXTURE EXISTE NO CONTRATO
//
// POR QUE ESTE BLOCO EXISTE — E POR QUE ELE É A PARTE MAIS IMPORTANTE DO ARQUIVO
//
// Em 24/08/2026 um fixture novo entrou com `relato_paciente`, `medida_registrada`,
// `lab_importado` e `urgencia: 'rotina'` — QUATRO valores que não existem no contrato. A tela de
// preview caiu inteira: `PROVENIENCIA[valor]` deu `undefined` e o React estourou em
// "can't access property 'icone'".
//
// Este guarda existia e passou verde. Dois defeitos, os dois de classe:
//
//  1. **Checava `toBeTruthy()`** — que o campo EXISTA, não que o valor seja VÁLIDO.
//     `'relato_paciente'` é truthy. A asserção não dizia nada.
//  2. **Lia UM fixture, pelo nome.** Fixture novo nunca era verificado. Só o teste de PII
//     varria o diretório.
//
// O TypeScript não protegia porque o import do JSON usa `as never` — decisão tomada para não
// ter que escrever tipos de fixture à mão, e que transferiu a responsabilidade para cá.
//
// A correção é um guarda de **duas pontas**: extrai os valores permitidos do PRÓPRIO contrato
// (`valoresDeUnion`) e varre TODOS os `.json` do diretório. Nenhuma lista paralela — lista
// paralela desatualizada aprova o errado, que é o defeito que estamos consertando.
// ═══════════════════════════════════════════════════════════════════════════════

/** Onde cada valor enumerado mora no fixture, e qual tipo do contrato o governa. */
const CAMPOS_ENUMERADOS: {
  caminho: string;
  tipo: string;
  /** Colhe os valores presentes num fixture carregado. */
  colher: (r: RespostaAnalise) => { onde: string; valor: unknown }[];
}[] = [
  {
    caminho: 'grafo.achados[].proveniencia',
    tipo: 'ProvenienciaAchado',
    colher: (r) =>
      (r.grafo?.achados ?? []).map((a) => ({ onde: `achado ${a.id}`, valor: a.proveniencia })),
  },
  {
    caminho: 'grafo.achados[].dominio',
    tipo: 'DominioAchado',
    colher: (r) =>
      (r.grafo?.achados ?? []).map((a) => ({ onde: `achado ${a.id}`, valor: a.dominio })),
  },
  {
    caminho: 'grafo.arestas[].tipo',
    tipo: 'TipoAresta',
    colher: (r) =>
      (r.grafo?.arestas ?? []).map((x, i) => ({
        onde: `aresta ${i} (${x.de}→${x.para})`,
        valor: x.tipo,
      })),
  },
  {
    caminho: 'grafo.dominio',
    tipo: 'DominioAnalise',
    colher: (r) => [{ onde: 'grafo.dominio', valor: r.grafo?.dominio }],
  },
  {
    caminho: 'grafo.urgencia',
    tipo: 'UrgenciaAnalise',
    colher: (r) => [{ onde: 'grafo.urgencia', valor: r.grafo?.urgencia }],
  },
  {
    caminho: 'grafo.hipoteses[].confianca_evidencia',
    tipo: 'ConfiancaEvidencia',
    colher: (r) =>
      (r.grafo?.hipoteses ?? []).map((h) => ({
        onde: `hipótese ${h.id}`,
        valor: h.confianca_evidencia,
      })),
  },
  {
    caminho: 'grafo.hipoteses[].medicamentos[].confianca_evidencia',
    tipo: 'ConfiancaEvidencia',
    colher: (r) =>
      (r.grafo?.hipoteses ?? []).flatMap((h) =>
        (h.medicamentos ?? []).map((m) => ({
          onde: `medicamento ${m.id}`,
          valor: m.confianca_evidencia,
        })),
      ),
  },
];

/** `procedencia` é união inline no `interface`, não `type` próprio — extraída à parte. */
const PROCEDENCIAS_VALIDAS = valoresDeCampoInline(
  corpoDoTipo(CONTRATO_FONTE, 'MedicamentoSugerido'),
  'procedencia',
);

const FIXTURES_JSON = readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));

describe('todo valor enumerado de todo fixture existe no contrato', () => {
  // ── VACUIDADE ───────────────────────────────────────────────────────────────
  // Sem isto, um extrator quebrado devolveria [] para tudo, nada seria comparado, e o bloco
  // passaria sobre zero — o modo de falha que a técnica dos guardas §5 nomeia.
  it('o extrator lê os tipos do contrato de verdade', () => {
    for (const { tipo } of CAMPOS_ENUMERADOS) {
      const vals = valoresDeUnion(CONTRATO_FONTE, tipo);
      expect(vals.length, `não consegui extrair valores de ${tipo}`).toBeGreaterThan(1);
    }
    expect(PROCEDENCIAS_VALIDAS, 'procedencia não extraída').toContain('inferido_ia');
    expect(PROCEDENCIAS_VALIDAS.length).toBeGreaterThan(1);
  });

  it('há mais de um fixture, e o novo está entre eles', () => {
    expect(FIXTURES_JSON.length, 'menos de 2 fixtures — o guarda cobriria pouco').toBeGreaterThan(
      1,
    );
    expect(FIXTURES_JSON, 'o fixture de canabidiol não está sendo varrido').toContain(
      'resposta-canabidiol-dor-cronica.json',
    );
  });

  // ── A COMPARAÇÃO, fixture por fixture ───────────────────────────────────────
  // Fatiado por arquivo de propósito: quando quebra, a mensagem nomeia QUAL fixture e QUAL
  // campo. "Um fixture está errado" manda alguém procurar; isto manda alguém corrigir.
  it.each(FIXTURES_JSON)('%s usa só valores que o contrato declara', (arquivo) => {
    const r = carregar(arquivo);
    const erros: string[] = [];

    for (const { caminho, tipo, colher } of CAMPOS_ENUMERADOS) {
      const validos = valoresDeUnion(CONTRATO_FONTE, tipo);
      for (const { onde, valor } of colher(r)) {
        // `undefined` é legítimo em campo opcional — o que não é legítimo é valor INVENTADO.
        if (valor === undefined || valor === null) continue;
        if (!validos.includes(String(valor))) {
          erros.push(
            `${caminho} em ${onde}: '${String(valor)}' não existe em ${tipo} ` +
              `(válidos: ${validos.join(' | ')})`,
          );
        }
      }
    }

    for (const h of r.grafo?.hipoteses ?? [])
      for (const m of h.medicamentos ?? [])
        if (m.procedencia && !PROCEDENCIAS_VALIDAS.includes(String(m.procedencia)))
          erros.push(
            `medicamento ${m.id}: procedencia '${String(m.procedencia)}' não existe ` +
              `(válidas: ${PROCEDENCIAS_VALIDAS.join(' | ')})`,
          );

    expect(
      erros,
      `${arquivo} tem valor que a tela não sabe renderizar — foi assim que o preview caiu ` +
        `em 24/08/2026 com "can't access property 'icone'":\n  - ${erros.join('\n  - ')}`,
    ).toHaveLength(0);
  });

  // ── COBERTURA: campo enumerado NOVO não pode entrar sem ser vigiado ─────────
  // Este é o caso que teria pegado o defeito de 24/08 mesmo se `procedencia` fosse campo novo.
  // Ele compara os nomes de campo que o CONTRATO governa por união com os que o mapa cobre.
  it('nenhum tipo de união do contrato ficou fora da varredura', () => {
    const unioesDoContrato = [
      ...semComentarios(CONTRATO_FONTE).matchAll(/export type (\w+)\s*=\s*\n?\s*\|?\s*'/g),
    ].map((m) => m[1]);
    const cobertos = new Set(CAMPOS_ENUMERADOS.map((c) => c.tipo));
    // Tipos que existem e deliberadamente NÃO aparecem em fixture ficam listados aqui, com
    // motivo — dispensa exige motivo escrito (Regra 3 da técnica).
    const dispensados: Record<string, string> = {
      // Regra 3 da técnica: toda dispensa exige motivo escrito.
      StatusNo:
        'governa NoPanorama.status, e NENHUM fixture tem nós de panorama — o `analiseIA` dos ' +
        'fixtures reais tem outra forma (nivel_urgencia, sindrome_principal, …). Quando um ' +
        'fixture com panorama entrar, esta dispensa sai e volta a ser caso de varredura. ' +
        'Registrado em 24/08/2026, depois de eu ter inventado um `sindrome.status` que o ' +
        'contrato não declara — o tsc pegou, e o campo saiu do fixture, não entrou no contrato.',
    };
    const descobertos = unioesDoContrato.filter((t) => !cobertos.has(t) && !(t in dispensados));
    expect(
      descobertos,
      `tipo(s) de união do contrato sem varredura em fixture: ${descobertos.join(', ')}. ` +
        'Acrescente ao mapa CAMPOS_ENUMERADOS, ou dispense com motivo escrito.',
    ).toHaveLength(0);
  });
});

describe('os fixtures são resposta real e carregam no contrato — parte 2', () => {
  it('a confiança exibível é FAIXA, e nunca derivada do número', () => {
    // ADR-0006: percentual de confiança de modelo não vai para a tela.
    expect(faixaDeConfianca({ confianca_evidencia: 'alta' })).toBe('alta');
    // Sem a faixa calibrada, devolve null — a tela não mostra nada, em vez de inventar uma
    // faixa a partir de `probabilidade`, o que reintroduziria a precisão que a ADR rejeita.
    expect(
      faixaDeConfianca({}),
      'derivar faixa de percentual traz de volta o que a ADR-0006 proíbe',
    ).toBeNull();
  });

  it('nenhum fixture carrega dado pessoal', () => {
    // Fixture de produto clínico com PII é vazamento versionado.
    const PII = /\d{3}\.\d{3}\.\d{3}-\d{2}|[\w.-]+@[\w.-]+\.\w{2,}|\(\d{2}\)\s?\d{4,5}-?\d{4}/;
    for (const f of readdirSync(FIXTURES).filter((x) => x.endsWith('.json'))) {
      expect(PII.test(readFileSync(join(FIXTURES, f), 'utf8')), `${f} tem padrão de PII`).toBe(
        false,
      );
    }
  });
});

describe('o formato vive em um lugar só', () => {
  it('a marca de fronteira do motor existe e é buscável', () => {
    // A Metade 2 começa por `rg FRONTEIRA_MOTOR_IA` — lista derivada do código, não escrita à
    // mão, que é o que a ADR-0002 R-08 aponta como divergente na primeira semana.
    expect(FRONTEIRA_MOTOR_IA).toBe('FRONTEIRA_MOTOR_IA');
  });

  it('o contrato declara os tipos que as telas vão precisar', () => {
    // Vacuidade do arquivo de contrato: se ele encolher, as telas voltam a inventar tipo.
    const fonte = readFileSync(join(RAIZ, 'lib/ia-clinica/contrato.ts'), 'utf8');
    for (const tipo of [
      'RespostaAnalise',
      'GrafoEvidencias',
      'PanoramaClinico',
      'Hipotese',
      'Achado',
      'Completude',
      'ConfiancaEvidencia',
    ]) {
      expect(
        new RegExp(`export (interface|type) ${tipo}\\b`).test(fonte),
        `o contrato perdeu ${tipo}`,
      ).toBe(true);
    }
  });

  it('mock de resposta do motor não aparece fora do diretório de fixtures', () => {
    // Mock espalhado por componente é o que faz a tela divergir do contrato sem ninguém ver.
    const suspeitos: string[] = [];
    const varrer = (dir: string) => {
      for (const item of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
        const rel = `${dir}/${item.name}`;
        if (item.isDirectory()) {
          if (!/node_modules|\.next|__fixtures__/.test(item.name)) varrer(rel);
        } else if (/\.tsx?$/.test(item.name)) {
          const texto = readFileSync(join(RAIZ, rel), 'utf8');
          // Objeto literal com a assinatura do grafo — não menção em tipo ou comentário.
          if (
            /(?:const|let)\s+\w*[Mm]ock\w*\s*[:=][\s\S]{0,200}?\bhipoteses\s*:\s*\[/.test(texto)
          ) {
            suspeitos.push(rel);
          }
        }
      }
    };
    for (const raiz of ['components', 'lib']) varrer(raiz);
    expect(
      suspeitos,
      `mock de resposta do motor fora de __fixtures__/: ${suspeitos.join(', ')}`,
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A FUNDAÇÃO DO MÓDULO — Sprint 2, entregáveis 3, 5, 7 e 8.
// ─────────────────────────────────────────────────────────────────────────────
describe('a casa do módulo existe e é alcançável', () => {
  it('a página do módulo está DENTRO de (medico), como manda DO-11', () => {
    // `DO-11`: a área nova mora dentro de `(medico)`, não há sexto route group. Estar aqui é o
    // que faz o módulo herdar a checagem de papel de `app/(medico)/layout.tsx`.
    expect(existsSync(join(RAIZ, 'app/(medico)/medico/ia-clinica/page.tsx'))).toBe(true);
  });

  it('quem não é médico nem admin não chega — pela checagem do layout pai', () => {
    // Uma segunda checagem dentro do módulo seria uma segunda regra, que pode divergir da
    // primeira. O guarda cobra que a regra do pai continua de pé.
    const layout = readFileSync(join(RAIZ, 'app/(medico)/layout.tsx'), 'utf8');
    expect(/obterRoleComFallback/.test(layout)).toBe(true);
    expect(
      /role !== 'medico'[\s\S]{0,40}role !== 'admin'/.test(layout),
      'o layout de (medico) deixou de barrar quem não é médico nem admin',
    ).toBe(true);
    expect(/redirect\(/.test(layout)).toBe(true);
  });

  it('a navegação chega ao módulo', () => {
    const sidebar = readFileSync(join(RAIZ, 'components/shared/medico-sidebar.tsx'), 'utf8');
    expect(
      /href:\s*'\/medico\/ia-clinica'/.test(sidebar),
      'o módulo existe mas não há como chegar nele pela navegação',
    ).toBe(true);
  });

  it('a marca de fronteira está USADA no código, não só declarada', () => {
    // Uma constante declarada e nunca usada não produz lista nenhuma no `rg`. O valor da marca
    // está em aparecer nos pontos de integração futuros.
    const pagina = readFileSync(join(RAIZ, 'app/(medico)/medico/ia-clinica/page.tsx'), 'utf8');
    expect(
      /FRONTEIRA_MOTOR_IA/.test(pagina),
      'nenhum ponto de integração marcado — a Metade 2 não terá lista derivada do código',
    ).toBe(true);
  });

  it('os enums de HITL e de validação clínica existem, com migration gerada', () => {
    const enums = readFileSync(join(RAIZ, 'db/schema/enums.ts'), 'utf8');
    expect(/analiseStatusEnum/.test(enums), 'falta o enum de status HITL').toBe(true);
    expect(/validacaoClinicaEnum/.test(enums), 'falta o enum de validação clínica').toBe(true);

    // Schema sem migration é schema que não existe no banco. O AGENTS.md exige SQL + snapshot
    // + journal juntos.
    const migracoes = readdirSync(join(RAIZ, 'db/migrations')).filter((f) => f.endsWith('.sql'));
    const sql = migracoes.map((f) => readFileSync(join(RAIZ, 'db/migrations', f), 'utf8')).join('');
    expect(
      /CREATE TYPE "public"\."analise_status"/.test(sql),
      'o enum está no schema TypeScript mas não em nenhuma migration',
    ).toBe(true);
    expect(/CREATE TYPE "public"\."validacao_clinica"/.test(sql)).toBe(true);
    // As colunas do consentimento também: sem elas o código da Sprint 1 fica inerte.
    expect(
      /ADD COLUMN "consentimento_paciente_em"/.test(sql),
      'as colunas de consentimento não têm migration — o código não funciona sem elas',
    ).toBe(true);
  });

  it('o ResultadoAction do módulo não é a 11ª cópia de ActionResult', () => {
    const fonte = readFileSync(join(RAIZ, 'lib/ia-clinica/resultado.ts'), 'utf8');
    // União discriminada: `sucesso: false` não pode carregar `dados`, senão dá para ler o
    // resultado de uma chamada que falhou.
    expect(/sucesso: true; dados: T/.test(fonte)).toBe(true);
    expect(/sucesso: false; erro: string/.test(fonte)).toBe(true);
  });
});
