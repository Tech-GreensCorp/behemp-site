/**
 * Guarda: exame de paciente só é lido, enviado ou apagado por quem é o médico DO paciente (ou
 * admin), e abre por rota que autentica e audita.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Em 27/10/2026, ao corrigir o "Baixar" de documentos, o exame mostrou dois defeitos de classe
 * diferente da do documento:
 *
 * 1. **BOLA (OWASP API1).** `listarExames(pacienteId)`, `excluirExame(exameId)`, `criarExame` e
 *    `POST /api/upload-exame` só exigiam `verificarMedicoOuAdmin()` — o PAPEL. Qualquer médico
 *    autenticado lia, enviava e apagava exame de paciente de OUTRO médico, bastando o id.
 * 2. **URL crua.** A lista devolvia `urlArquivo` ao navegador, e "Ver"/"Baixar" a usavam: sem
 *    autenticação, sem auditoria, e com `fetch` sem `response.ok`.
 *
 * ⚠️ O blob do exame continua em store PÚBLICO (`upload-exame`, `criarExame`). Mover para o
 * privado exige migrar os arquivos já enviados — trabalho próprio. O que este guarda garante é
 * que o NAVEGADOR deixa de receber a URL, e que o caminho de leitura é o autenticado, para que
 * a migração futura não precise tocar em tela nenhuma.
 *
 * E um terceiro defeito, achado junto e que vale para TODA entrega: o nome do arquivo ia cru
 * no cabeçalho `content-disposition`, e um nome com travessão ("—") ou aspas LANÇA no
 * `new Response` — a rota respondia 502 "Documento indisponível".
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');

function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\{\s*\}/g, '');
}
const ler = (caminho: string) => semComentarios(readFileSync(join(RAIZ, caminho), 'utf8'));
const compactar = (s: string) => s.replace(/\s+/g, ' ');

/** O corpo de uma função exportada: do nome até a próxima `export` (ou o fim). */
function corpoDe(codigo: string, nome: string): string {
  const i = codigo.search(new RegExp(`export\\s+async\\s+function\\s+${nome}\\b`));
  expect(i, `a função ${nome} sumiu — o guarda ficou sem o que medir`).toBeGreaterThan(-1);
  const resto = codigo.slice(i + 10);
  const fim = resto.search(/\nexport\s/);
  return compactar(fim === -1 ? resto : resto.slice(0, fim));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. O CABEÇALHO — executado
// ═══════════════════════════════════════════════════════════════════════════════

describe('o nome do arquivo no cabeçalho nunca derruba a entrega', () => {
  it.each([
    ['Atualização do Programa de Doação — Davi.pdf'],
    ['TERMO_DE_CIÊNCIA_E_ADESÃO.docx.pdf'],
    ['rg "frente".jpg'],
    ['linha\r\nset-cookie: x=1.pdf'],
    ['a;b\\c.png'],
    ['日本語.pdf'],
    [''],
    [null],
  ])('%s vira cabeçalho válido', async (nome) => {
    const { disposicaoInline } = await import('../../lib/documentos/disposicao-do-arquivo');
    const valor = disposicaoInline(nome as string | null, 'fallback-id');

    // Era aqui que lançava: caractere acima de 255 no valor do cabeçalho.
    expect(() => new Headers({ 'content-disposition': valor })).not.toThrow();
    expect(valor).toMatch(/^inline; filename="/);
    expect(/[\r\n]/.test(valor), 'quebra de linha no cabeçalho é injeção de cabeçalho').toBe(false);
  });

  it('o nome com acento sai em `filename*` (UTF-8) e com fallback ASCII em `filename`', async () => {
    const { disposicaoInline } = await import('../../lib/documentos/disposicao-do-arquivo');
    const valor = disposicaoInline('Doação — termo.pdf', 'x');
    expect(valor).toContain("filename*=UTF-8''Doa%C3%A7%C3%A3o%20%E2%80%94%20termo.pdf");
    const ascii = /filename="([^"]*)"/.exec(valor)?.[1] ?? '';
    expect(/^[\x20-\x7e]*$/.test(ascii), 'o fallback tem de ser ASCII puro').toBe(true);
  });

  it('sem nome usa o fallback', async () => {
    const { disposicaoInline } = await import('../../lib/documentos/disposicao-do-arquivo');
    expect(disposicaoInline(null, 'abc123')).toContain('abc123');
  });

  it.each([
    'app/api/documentos/[id]/arquivo/route.ts',
    'app/api/exames/[id]/arquivo/route.ts',
    'lib/documentos/entregar-blob.ts',
  ])('🔴 %s não monta `filename=` à mão', (arquivo) => {
    const c = existsSync(join(RAIZ, arquivo)) ? ler(arquivo) : '';
    expect(c.length, `falta ${arquivo}`).toBeGreaterThan(0);
    if (arquivo.endsWith('entregar-blob.ts')) {
      expect(c).toMatch(/disposicaoInline\(/);
    } else if (arquivo.includes('documentos')) {
      expect(c).toMatch(/disposicaoInline\(/);
    } else {
      expect(c).toMatch(/entregarBlob\(/);
    }
    expect(/filename="\$\{/.test(c), 'o nome do arquivo voltou a ir cru no cabeçalho').toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. O ESCOPO — médico DO paciente
// ═══════════════════════════════════════════════════════════════════════════════

describe('exame tem escopo de objeto', () => {
  const ACOES = ler('app/_actions/exames.ts');

  it.each(['listarExames', 'excluirExame', 'criarExame'])(
    '🔴 %s confere o vínculo médico-paciente',
    (nome) => {
      expect(
        corpoDe(ACOES, nome),
        `${nome} só confere o PAPEL: qualquer médico alcança exame de qualquer paciente`,
      ).toMatch(/garantirMedicoDoPaciente\(/);
    },
  );

  it('🔴 excluirExame descobre o paciente PELO exame, não pelo cliente', () => {
    const c = corpoDe(ACOES, 'excluirExame');
    expect(c).toMatch(/\.from\(exames\)/);
    expect(c.indexOf('.from(exames)'), 'o exame tem de ser lido antes do escopo').toBeLessThan(
      c.indexOf('garantirMedicoDoPaciente('),
    );
    expect(
      c.indexOf('garantirMedicoDoPaciente('),
      'o escopo tem de vir ANTES do update',
    ).toBeLessThan(c.indexOf('.update(exames)'));
  });

  it('🔴 a lista não devolve a URL do arquivo', () => {
    const c = corpoDe(ACOES, 'listarExames');
    expect(c, 'a lista deixou de dizer SE há arquivo').toMatch(/temArquivo/);
    expect(
      /dados:\s*lista\b/.test(c),
      'a lista voltou a devolver a linha crua, com urlArquivo',
    ).toBe(false);
  });

  it('🔴 o upload confere o vínculo ANTES de gravar o blob', () => {
    const c = compactar(ler('app/api/upload-exame/route.ts'));
    expect(c).toMatch(/garantirMedicoDoPaciente\(/);
    expect(c.indexOf('garantirMedicoDoPaciente('), 'o escopo tem de vir antes do put').toBeLessThan(
      c.indexOf('put('),
    );
  });
});

describe('a rota autenticada do exame', () => {
  const ROTA = 'app/api/exames/[id]/arquivo/route.ts';
  const ESCOPO = 'lib/auth/escopo-exame.ts';

  it('existe, com o escopo em módulo próprio', () => {
    expect(existsSync(join(RAIZ, ROTA)), `falta ${ROTA}`).toBe(true);
    expect(existsSync(join(RAIZ, ESCOPO)), `falta ${ESCOPO}`).toBe(true);
  });

  it('🔴 limita, confere escopo, audita e entrega pelo ajudante', () => {
    const c = compactar(ler(ROTA));
    expect(c).toMatch(/consumir\(/);
    expect(c).toMatch(/garantirLeitorDoExame\(/);
    expect(c).toMatch(/acao:\s*'visualizar'/);
    expect(c).toMatch(/entregarBlob\(/);
    expect(c.indexOf('consumir('), 'o limite vem antes do escopo').toBeLessThan(
      c.indexOf('garantirLeitorDoExame('),
    );
    expect(/NextResponse\.json\([^)]*urlArquivo/.test(c), 'a rota devolve a URL no corpo').toBe(
      false,
    );
  });

  it('🔴 o escopo é o do paciente e responde 404, nunca 403', () => {
    const c = compactar(ler(ESCOPO));
    expect(c).toMatch(/garantirMedicoDoPaciente\(/);
    expect(c).toMatch(/isNull\(exames\.deletedAt\)/);
    expect(/status:\s*403/.test(c), 'distinguir 403 de 404 vira oráculo de enumeração').toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AS TELAS
// ═══════════════════════════════════════════════════════════════════════════════

describe('as telas abrem exame pela rota, nunca pela URL', () => {
  it('🔴 tab-exames não conhece urlArquivo e baixa pelo ajudante', () => {
    const c = compactar(ler('app/(medico)/medico/pacientes/[id]/_components/tab-exames.tsx'));
    expect(c.includes('urlArquivo'), 'a tela voltou a usar a URL crua do exame').toBe(false);
    expect(c).toMatch(/enderecoDoExame\(/);
    expect(c).toMatch(/baixarExame\(/);
    expect(/window\.open\(/.test(c), 'o fallback window.open(url) escondia o erro').toBe(false);
    expect(/fetch\(\s*url\b/.test(c)).toBe(false);
  });

  it('🔴 o prontuário vivo (teleconsulta) leva o ENDEREÇO da rota, não a URL do blob', () => {
    const c = compactar(ler('app/(medico)/_actions/prontuario-vivo.ts'));
    // `[,}]` logo depois: só a atribuição CRUA é proibida — `r.urlArquivo ? '/api/…' : null` é o certo.
    expect(
      /urlArquivo:\s*r\.urlArquivo\s*[,}]/.test(c),
      'exame: a URL crua voltou ao prontuário',
    ).toBe(false);
    expect(/url:\s*r\.urlBlob\s*[,}]/.test(c), 'documento: a URL crua voltou ao prontuário').toBe(
      false,
    );
    expect(c).toMatch(/\/api\/exames\//);
    expect(c).toMatch(/\/api\/documentos\//);
  });
});
