/**
 * GUARDA — a espera da chamada diz a verdade (ADR-0029 D-28, aprovado por Davi em 01/10/2026).
 *
 * Quebra o build se:
 *   1. o palco voltar a dizer "{outro} está sem câmera" ANTES de a conexão se completar, quando o
 *      outro lado ainda nem chegou (o defeito que motivou a D-28), ou a espera aparecer com a
 *      chamada já conectada (executando a regra);
 *   2. as barras do "Você · microfone ligado" se mexerem sem som, ou com o microfone silenciado
 *      (executando a regra): barra que mexe sem voz diz ao paciente que ele está sendo ouvido;
 *   3. as barras voltarem a ser uma animação de CSS, que mexe com ou sem voz;
 *   4. a espera mandar alguma coisa para fora do aparelho (o nível do microfone é medido ali);
 *   5. o contador deixar de zerar quando a fase muda, ou o Loader2 voltar às fases que têm o próprio
 *      indicador (ponto em `aguardando`, reticências em `conectando`);
 *   6. uma animação da espera ficar fora do bloco de `prefers-reduced-motion` (derivado do CSS);
 *   7. a dica deixar de esperar os 6 s decididos.
 *
 * O que ele NÃO prova: o desenho. Esse foi conferido no Chromium contra o canvas aprovado
 * (`docs/decisoes-visuais/teleconsulta-1..4.html`), e a sequência com login só produção mostra.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  alturasDasBarras,
  BARRA_PARADA,
  formatarTempoNaSala,
  oQueOPalcoMostra,
  type FaseDaChamada,
} from '@/lib/atendimento/espera';

import { semComentarios } from './_apoio/codigo';

const RAIZ = process.cwd();
const ler = (p: string) => semComentarios(readFileSync(join(RAIZ, p), 'utf8'));

const TELA = ler('components/atendimento/ChamadaDeAtendimento.tsx');
const ESPERA = ler('components/atendimento/EsperaDaChamada.tsx');
const CSS = readFileSync(join(RAIZ, 'app/globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Um espectro de 128 posições com o mesmo valor (0 a 255) em todas. */
const espectro = (valor: number) => new Uint8Array(128).fill(valor);

describe('o palco (executando a regra)', () => {
  const FASES: FaseDaChamada[] = [
    'entrando',
    'aguardando',
    'conectando',
    'conectado',
    'encerrada',
    'erro',
  ];

  it('antes de conectar é sempre a espera, mesmo com um vídeo velho no estado', () => {
    for (const fase of ['entrando', 'aguardando', 'conectando'] as const)
      for (const temDestaque of [false, true])
        expect(oQueOPalcoMostra(fase, temDestaque)).toBe('espera');
  });

  it('conectado mostra o vídeo, ou diz que o outro está sem câmera; nunca a espera', () => {
    expect(oQueOPalcoMostra('conectado', true)).toBe('destaque');
    expect(oQueOPalcoMostra('conectado', false)).toBe('sem-camera');
  });

  it('encerrada e erro não têm palco', () => {
    expect(oQueOPalcoMostra('encerrada', false)).toBe('nada');
    expect(oQueOPalcoMostra('erro', true)).toBe('nada');
  });

  it('"sem câmera" só sai de conectado', () => {
    const comSemCamera = FASES.flatMap((f) =>
      [false, true].filter((d) => oQueOPalcoMostra(f, d) === 'sem-camera').map(() => f),
    );
    expect(comSemCamera).toEqual(['conectado']);
  });

  it('a tela decide o palco pela regra, e cada ramo mostra o que a regra diz', () => {
    expect(TELA).toMatch(/oQueOPalcoMostra\(fase, destaque !== null\)/);
    const espera = TELA.indexOf("noPalco === 'espera'");
    const semCamera = TELA.indexOf("noPalco === 'sem-camera'");
    expect(espera).toBeGreaterThanOrEqual(0);
    expect(semCamera).toBeGreaterThanOrEqual(0);
    expect(TELA.slice(espera, espera + 300)).toMatch(/<EsperaDaChamada/);
    expect(TELA.slice(semCamera, semCamera + 700)).toMatch(
      /está sem câmera e não está mostrando a tela\./,
    );
    // O texto existe UMA vez: um segundo ramo com ele seria o defeito voltando por outro caminho.
    expect(TELA.match(/está sem câmera e não está mostrando a tela\./g) ?? []).toHaveLength(1);
  });
});

describe('as barras do microfone (executando a regra)', () => {
  it('silêncio deixa as quatro paradas', () => {
    expect(alturasDasBarras(espectro(0), false)).toEqual(Array(4).fill(BARRA_PARADA));
  });

  it('ruído de fundo abaixo do limiar não mexe nenhuma', () => {
    expect(alturasDasBarras(espectro(30), false)).toEqual(Array(4).fill(BARRA_PARADA));
  });

  it('com voz, sobem; e mais voz sobe mais', () => {
    const media = alturasDasBarras(espectro(120), false);
    const alta = alturasDasBarras(espectro(230), false);
    for (let i = 0; i < 4; i++) {
      expect(media[i]).toBeGreaterThan(BARRA_PARADA);
      expect(alta[i]).toBeGreaterThan(media[i]!);
      expect(alta[i]).toBeLessThanOrEqual(1);
    }
  });

  it('silenciado, ficam paradas MESMO com som chegando', () => {
    expect(alturasDasBarras(espectro(255), true)).toEqual(Array(4).fill(BARRA_PARADA));
  });

  it('cada barra é a sua faixa: som só no agudo mexe só a última', () => {
    const agudo = new Uint8Array(128);
    for (let i = 14; i <= 21; i++) agudo[i] = 220;
    const [a, b, c, d] = alturasDasBarras(agudo, false);
    expect([a, b, c]).toEqual([BARRA_PARADA, BARRA_PARADA, BARRA_PARADA]);
    expect(d).toBeGreaterThan(BARRA_PARADA);
  });

  it('espectro vazio ou curto não inventa nível', () => {
    expect(alturasDasBarras(new Uint8Array(0), false)).toEqual(Array(4).fill(BARRA_PARADA));
  });

  it('a tela usa a regra sobre o analisador do microfone, e não uma animação', () => {
    expect(ESPERA).toMatch(/createAnalyser\(\)/);
    expect(ESPERA).toMatch(/getByteFrequencyData\(/);
    expect(ESPERA).toMatch(/alturasDasBarras\(espectro, mudo\)/);
    // As barras não têm `animation` no CSS: só se mexem pelo que foi medido.
    const barras = CSS.match(/\.espera-eq i\s*\{[^}]*\}/g) ?? [];
    expect(barras.length).toBeGreaterThan(0);
    for (const regra of barras) expect(regra).not.toMatch(/animation/);
    expect(CSS).not.toMatch(/@keyframes bh-eq/);
  });

  it('silenciado diz "silenciado"; sem microfone, o indicador não aparece', () => {
    expect(ESPERA).toMatch(/microfone silenciado/);
    expect(TELA).toMatch(/microfone=\{semMicrofone \? null : faixaDoMicrofone\}/);
    expect(ESPERA).toMatch(/fase === 'aguardando' && microfone &&/);
  });

  it('o nível é medido no aparelho e não sai dele', () => {
    expect(ESPERA).not.toMatch(
      /\bfetch\(|sinalizar|getPusherClient|MediaRecorder|\.connect\(\s*contexto\.destination/,
    );
  });
});

describe('o contador, o cabeçalho e o movimento', () => {
  it('a espera remonta a cada fase, e o contador começa do zero', () => {
    expect(TELA).toMatch(/<EsperaDaChamada\s+key=\{fase\}/);
    expect(ESPERA).toMatch(/useState\(0\)/);
    expect(formatarTempoNaSala(0)).toBe('0:00');
    expect(formatarTempoNaSala(42)).toBe('0:42');
    expect(formatarTempoNaSala(135)).toBe('2:15');
    expect(formatarTempoNaSala(3725)).toBe('62:05');
  });

  it('Loader2 só em entrando; ponto em aguardando; reticências em conectando', () => {
    const cabecalho = TELA.slice(
      TELA.indexOf('role="status"'),
      TELA.indexOf('{estado[fase]}') + 200,
    );
    expect(cabecalho).toMatch(/fase === 'entrando' && \(\s*<Loader2/);
    expect(cabecalho).not.toMatch(/fase === 'conectando'\) && \(\s*<Loader2/);
    expect(cabecalho).toMatch(/fase === 'aguardando' && <span className="espera-ping"/);
    expect(cabecalho).toMatch(/fase === 'conectando' && \(\s*<span className="espera-dots"/);
  });

  it('toda animação da espera para com prefers-reduced-motion (derivado do CSS)', () => {
    const reduzido = CSS.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g) ?? [];
    const daEspera = reduzido.filter((b) => b.includes('.espera-'));
    expect(daEspera).toHaveLength(1);
    const animadas = [...CSS.matchAll(/([^{}]+)\{[^}]*animation:\s*bh-[^}]*\}/g)].flatMap((m) =>
      m[1]!.split(',').map((s) => s.trim()),
    );
    // Vacuidade: a varredura acha as animações da espera.
    expect(animadas.length).toBeGreaterThanOrEqual(8);
    for (const seletor of animadas) {
      const classe = seletor.match(/\.espera-[a-z0-9-]+/)?.[0];
      expect(classe, seletor).toBeDefined();
      expect(daEspera[0], seletor).toContain(classe!);
    }
  });

  it('a dica espera os 6 s decididos', () => {
    expect(CSS).toMatch(
      /\.espera-late\s*\{[^}]*bh-rise 0\.9s cubic-bezier\(0\.16, 1, 0\.3, 1\) 6s both/,
    );
  });
});
