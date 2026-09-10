/**
 * GUARDA — a tela de espera da teleconsulta não pode cobrir os controles da sala.
 *
 * A CLASSE DE ERRO: o overlay que diz "Aguardando paciente entrar na sala…" é `absolute
 * inset-0` com fundo opaco. Enquanto ele tinha `z-30` fixo, cobria o PiP da câmera do próprio
 * médico (`z-10`) e os botões de Paciente / Prontuário / Prescrição / Copilot (`z-20`) — que
 * ficavam renderizados e invisíveis atrás de um retângulo `bg-slate-900`.
 *
 * Relatado pelo dono em 10/09/2026: "a câmera não aparece, o sidebar da esquerda também não".
 * Os dois somem juntos porque a causa é uma só, e nenhum log acusa: não há erro nenhum em
 * elemento que existe e está atrás de outro.
 *
 * ⚠️ O overlay PRECISA cobrir em `lobby` — lá ele é a tela: card "Pronto para iniciar?",
 * consentimento da ADR-0007 e o botão de iniciar. O que não pode é cobrir DEPOIS de iniciar.
 * Por isso o guarda exige z-index CONDICIONAL, não z-index baixo.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const HOST = 'components/teleconsulta/GlobalTeleconsultaHost.tsx';
const codigo = readFileSync(path.join(process.cwd(), HOST), 'utf8');

/** O bloco do overlay de espera, do `!remoteConnected &&` até o fim da abertura da div. */
function blocoDoOverlay(): string {
  const i = codigo.indexOf('Estado de aguardando / Lobby');
  expect(i).toBeGreaterThan(-1);
  return codigo.slice(i, i + 1600);
}

describe('o overlay de espera não cobre os controles depois de iniciar', () => {
  it('o overlay existe (vacuidade — sem ele o resto não testa nada)', () => {
    expect(codigo).toContain('Aguardando paciente entrar na sala');
    expect(codigo).toContain('!remoteConnected &&');
  });

  it('o z-index do overlay é CONDICIONAL à fase, não fixo', () => {
    const bloco = blocoDoOverlay();
    // precisa haver uma condição de fase decidindo o z
    expect(bloco).toMatch(/phase === 'lobby'[\s\S]{0,40}z-30/);
  });

  it('fora do lobby o overlay vai para trás dos controles', () => {
    const bloco = blocoDoOverlay();
    // o ramo "else" do ternário precisa ser um z menor que o do PiP (z-10)
    expect(bloco).toMatch(/z-30[\s\S]{0,20}:[\s\S]{0,20}z-0/);
  });

  it('o PiP da câmera local continua existindo e acima do fundo', () => {
    expect(codigo).toContain('PiP local');
    expect(codigo).toMatch(/z-10[\s\S]{0,400}ref=\{setLocalVideoEl\}/);
  });

  it('os botões clínicos continuam existindo e acima do PiP', () => {
    expect(codigo).toContain('Botões clínicos');
    expect(codigo).toMatch(/top-4 left-4 z-20/);
    for (const rotulo of ['Paciente', 'Prontuário', 'Prescrição']) {
      expect(codigo).toContain(`label: '${rotulo}'`);
    }
  });

  /**
   * O lobby é o caso em que cobrir é CORRETO: é onde vive o consentimento da ADR-0007, e o
   * médico não pode iniciar sem passar por ele. Um "conserto" que baixasse o z sempre
   * deixaria o card de consentimento atrás do vídeo.
   */
  it('em lobby o overlay CONTINUA cobrindo — é onde vive o consentimento da ADR-0007', () => {
    const bloco = blocoDoOverlay();
    expect(bloco).toContain("phase === 'lobby' ? 'z-30'");
  });
});

describe('controle — o guarda não pode acusar inocente', () => {
  it('não exige z-0 no lobby, que quebraria o consentimento', () => {
    const bloco = blocoDoOverlay();
    expect(bloco).not.toMatch(/phase === 'lobby' \? 'z-0'/);
  });

  it('a fase de lobby e a de sala continuam sendo estados distintos', () => {
    expect(codigo).toContain("setPhase('room')");
    expect(codigo).toMatch(/setPhase\(["']lobby["']\)/);
  });
});
