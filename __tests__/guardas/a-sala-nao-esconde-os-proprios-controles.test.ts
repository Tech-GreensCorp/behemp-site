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
 *
 * E O LADO DO PACIENTE (01/10/2026, ADR-0029 D-30): a mesma classe de erro existia na tela dele,
 * desde 13/08 (`8ee8e5c`). A espera tem `z-[1]` e a câmera do próprio paciente não tinha z-index,
 * então ficava por baixo: medido no Chromium, `elementFromPoint` no centro da câmera devolvia a
 * espera. Davi: "isso era um bug que eu já tinha resolvido" — o que estava resolvido era o lado do
 * médico. O caso abaixo compara os DOIS z-index, em vez de exigir um valor.
 *
 * ⚠️ RETIFICAÇÃO, 01/10/2026: a vacuidade exigia o TEXTO "Aguardando paciente entrar na sala", e o
 * texto saiu da tela com a D-30. O guarda lê o arquivo cru, então continuaria verde por um
 * COMENTÁRIO que cita o texto antigo: menção confundida com uso. Agora exige o componente.
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
    expect(codigo).toMatch(/<EsperaDaTeleconsulta\s/);
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

describe('a espera do paciente não cobre a câmera dele', () => {
  const PACIENTE = readFileSync(
    path.join(process.cwd(), 'app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx'),
    'utf8',
  );
  /** O primeiro `z-N` ou `z-[N]` da primeira div depois do marcador. */
  const zDepoisDe = (marcador: string): number | null => {
    const i = PACIENTE.indexOf(marcador);
    expect(i, marcador).toBeGreaterThan(-1);
    const classe = PACIENTE.slice(i).match(/className="([^"]*)"/)?.[1] ?? '';
    const z = classe.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/);
    return z ? Number(z[1] ?? z[2]) : null;
  };

  it('vacuidade: a espera e a câmera existem na tela do paciente', () => {
    expect(PACIENTE).toMatch(/<EsperaDaTeleconsulta\s/);
    expect(PACIENTE).toContain('{!remoteConnected && (');
    expect(PACIENTE).toMatch(/bottom-6 right-6/);
  });

  it('a câmera do paciente fica ACIMA da espera', () => {
    const espera = zDepoisDe('{!remoteConnected && (');
    // A câmera é a div cuja classe tem `bottom-6 right-6`, em qualquer ordem de classe.
    const classeDaCamera =
      PACIENTE.match(/className="([^"]*\bbottom-6 right-6\b[^"]*)"/)?.[1] ?? '';
    const z = classeDaCamera.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/);
    const camera = z ? Number(z[1] ?? z[2]) : null;
    expect(espera, 'a espera precisa de z-index explícito').not.toBeNull();
    expect(camera, 'sem z-index, a câmera fica por baixo da espera').not.toBeNull();
    expect(camera!).toBeGreaterThan(espera!);
  });
});
