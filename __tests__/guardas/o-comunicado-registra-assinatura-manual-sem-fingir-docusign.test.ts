/**
 * Guarda: o REGISTRO MANUAL da assinatura do comunicado "Atualização do Programa de Doação".
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Em 27/10/2026 o paciente assinou a carta por outra plataforma e mandou o arquivo pelo WhatsApp.
 * O sistema só marcava `assinado` pela confirmação do DocuSign (guarda
 * `o-comunicado-assina-so-pelo-docusign`), então o card ficava "pendente" e o dashboard do
 * paciente seguia com o aviso grande de "você tem um documento para assinar".
 *
 * 🔴 Esta é uma EXCEÇÃO CONSCIENTE à regra "quem diz que assinou é o DocuSign". Ela só é segura se
 * continuar sendo uma exceção estreita, visível e rastreável:
 *   · só o ADMIN, e só sobre um comunicado `pendente` (nunca cria linha, nunca sobrescreve um
 *     assinado, nunca reabre um recusado);
 *   · o arquivo é validado no servidor (tipo declarado E assinatura dos bytes) e vai para store
 *     PRIVADO;
 *   · fica marcado COMO manual (quem, quando, observação, nome do arquivo) e auditado;
 *   · não finge ser DocuSign: nenhum e-mail de "confirmação" nem a notificação a docs@ saem, e a
 *     sincronização com o DocuSign não mexe nele.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  LIMITE_DO_ARQUIVO_MANUAL,
  identificarArquivoDaAssinatura,
  validarDataDaAssinatura,
} from '../../lib/comunicados/registro-manual';

const RAIZ = join(import.meta.dirname, '..', '..');

function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\{\s*\}/g, '');
}
const ler = (caminho: string) => semComentarios(readFileSync(join(RAIZ, caminho), 'utf8'));
const compactar = (s: string) => s.replace(/\s+/g, ' ');

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d); // %PDF-
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const EXE = bytes(0x4d, 0x5a, 0x90, 0x00); // MZ

// ═══════════════════════════════════════════════════════════════════════════════
// 1. O ARQUIVO — executado
// ═══════════════════════════════════════════════════════════════════════════════

describe('o arquivo da assinatura é conferido pelos BYTES, não só pelo tipo declarado', () => {
  it.each([
    ['application/pdf', PDF, 'pdf'],
    ['image/png', PNG, 'png'],
    ['image/jpeg', JPG, 'jpg'],
  ])('%s com a assinatura certa é aceito', (mime, conteudo, extensao) => {
    const r = identificarArquivoDaAssinatura(conteudo, mime);
    expect(r?.contentType).toBe(mime);
    expect(r?.extensao).toBe(extensao);
  });

  it.each([
    ['PNG declarado como PDF', PNG, 'application/pdf'],
    ['executável declarado como PDF', EXE, 'application/pdf'],
    ['PDF declarado como imagem', PDF, 'image/png'],
    ['HTML declarado como PDF', new TextEncoder().encode('<html>'), 'application/pdf'],
    ['tipo fora da lista', PDF, 'text/html'],
    ['tipo vazio', PDF, ''],
    ['arquivo vazio', new Uint8Array(0), 'application/pdf'],
  ])('🔴 %s é recusado', (_nome, conteudo, mime) => {
    expect(identificarArquivoDaAssinatura(conteudo, mime)).toBeNull();
  });

  it('o limite de tamanho existe e é de um documento assinado, não de um vídeo', () => {
    expect(LIMITE_DO_ARQUIVO_MANUAL).toBeGreaterThan(1024 * 1024);
    expect(LIMITE_DO_ARQUIVO_MANUAL).toBeLessThanOrEqual(25 * 1024 * 1024);
  });
});

describe('a data da assinatura', () => {
  const agora = new Date('2026-10-27T15:30:00-03:00');

  it('aceita hoje e dias passados, e guarda ao meio-dia de Brasília (sem escorregar de dia)', () => {
    const hoje = validarDataDaAssinatura('2026-10-27', agora);
    expect(hoje.ok).toBe(true);
    if (hoje.ok) expect(hoje.data.toISOString()).toBe('2026-10-27T15:00:00.000Z');
    expect(validarDataDaAssinatura('2026-10-20', agora).ok).toBe(true);
  });

  it.each([
    ['2026-10-28'],
    ['2027-01-01'],
    ['2026-02-30'],
    ['27/10/2026'],
    ['abc'],
    [''],
    ['2026-13-01'],
  ])('🔴 "%s" é recusada', (texto) => {
    expect(validarDataDaAssinatura(texto, agora).ok).toBe(false);
  });

  it('às 22h de Brasília ainda é "hoje" lá, mesmo já sendo amanhã em UTC', () => {
    const noite = new Date('2026-10-27T22:30:00-03:00'); // 01:30Z do dia 28
    expect(validarDataDaAssinatura('2026-10-27', noite).ok).toBe(true);
    expect(validarDataDaAssinatura('2026-10-28', noite).ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. A REGRA NA LIB — só admin, só de pendente, sem fingir DocuSign
// ═══════════════════════════════════════════════════════════════════════════════

describe('registrarAssinaturaManual (lib)', () => {
  const lib = () => ler('lib/comunicados/assinatura.ts');
  const corpo = () => {
    const c = compactar(lib());
    const i = c.indexOf('export async function registrarAssinaturaManual');
    expect(i, 'registrarAssinaturaManual não existe').toBeGreaterThan(-1);
    // até a próxima função exportada — o corpo desta, e só dela
    const fim = c.indexOf('export ', i + 10);
    return fim === -1 ? c.slice(i) : c.slice(i, fim);
  };

  it('🔴 só transiciona a partir de `pendente`, com UPDATE condicional', () => {
    const c = corpo();
    expect(c).toMatch(/status:\s*'assinado'/);
    expect(c, 'o UPDATE perdeu a condição pendente — poderia sobrescrever um assinado').toMatch(
      /eq\(comunicadosAssinatura\.status,\s*'pendente'\)/,
    );
  });

  it('🔴 não cria linha nova (sem duplicar o documento) e não apaga nada', () => {
    const c = corpo();
    expect(/\.insert\(/.test(c), 'o registro manual inseriu linha: duplicaria o comunicado').toBe(
      false,
    );
    expect(/\.delete\(/.test(c)).toBe(false);
  });

  it('🔴 fica marcado como manual: quem, quando, observação e nome do arquivo', () => {
    const c = corpo();
    for (const campo of [
      'registroManualEm',
      'registroManualPorUserId',
      'registroManualObservacao',
      'registroManualNomeArquivo',
    ]) {
      expect(c, `falta gravar ${campo}`).toContain(campo);
    }
  });

  it('🔴 é auditado, com o estado de antes e o de depois', () => {
    const c = corpo();
    expect(c).toMatch(/registrarAuditoria\(/);
    expect(c).toMatch(/dadosAntes/);
    expect(c).toMatch(/dadosDepois/);
  });

  it('🔴 guarda em store PRIVADO e recolhe o blob órfão quando perde a corrida', () => {
    const c = corpo();
    expect(c).toMatch(/guardarDocumentoPrivado\(/);
    expect(c).toMatch(/apagarDocumentoPrivado\(/);
    expect(/from '@vercel\/blob'|\bput\(/.test(c)).toBe(false);
  });

  it('🔴 NÃO finge ser o DocuSign: as duas travas de e-mail nascem preenchidas', () => {
    const c = corpo();
    expect(c, 'o e-mail de confirmação ao paciente voltaria a sair').toMatch(
      /emailConfirmacaoPacienteEm:\s*(agora|new Date\(\))/,
    );
    expect(c, 'a notificação a docs@ (com "envelope") voltaria a sair').toMatch(
      /emailNotificacaoDocsEm:\s*(agora|new Date\(\))/,
    );
  });

  it('🔴 a finalização do DocuSign não age sobre um registro manual', () => {
    const c = compactar(lib());
    const i = c.indexOf('export async function finalizarAssinatura');
    expect(i).toBeGreaterThan(-1);
    expect(c.slice(i, i + 700), 'um webhook tardio do envelope aberto mandaria e-mails').toMatch(
      /registroManualEm/,
    );
  });

  it('a lista do admin diz que foi manual, sem a URL do arquivo', () => {
    const c = lib();
    const i = c.indexOf('export interface ComunicadoParaAdmin');
    const bloco = c.slice(i, c.indexOf('\n}', i));
    expect(bloco).toContain('registroManual');
    expect(bloco).not.toContain('urlPdfAssinado');
    // E o paciente não recebe nada que o distinga: para ele, assinado é assinado.
    const j = c.indexOf('export interface ComunicadoParaPaciente');
    expect(c.slice(j, c.indexOf('\n}', j))).not.toContain('registroManual');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. A ROTA
// ═══════════════════════════════════════════════════════════════════════════════

describe('a rota de registro manual', () => {
  const ROTA = 'app/api/comunicados/[id]/assinatura-manual/route.ts';

  it('existe', () => {
    expect(existsSync(join(RAIZ, ROTA)), `falta ${ROTA}`).toBe(true);
  });

  it('🔴 só admin; limita antes de autenticar; valida o arquivo no servidor', () => {
    const c = compactar(ler(ROTA));
    expect(c).toMatch(/verificarAdmin\(/);
    expect(c).toMatch(/consumir\(/);
    expect(c.indexOf('consumir('), 'o limite vem ANTES de autenticar').toBeLessThan(
      c.indexOf('verificarAdmin('),
    );
    expect(c).toMatch(/identificarArquivoDaAssinatura\(/);
    expect(c).toMatch(/validarDataDaAssinatura\(/);
    expect(c).toMatch(/LIMITE_DO_ARQUIVO_MANUAL/);
    expect(c).toMatch(/registrarAssinaturaManual\(/);
  });

  it('🔴 o tamanho é conferido ANTES de ler o arquivo para a memória', () => {
    const c = compactar(ler(ROTA));
    expect(c.indexOf('.size'), 'a rota não confere o tamanho').toBeGreaterThan(-1);
    expect(c.indexOf('.size')).toBeLessThan(c.indexOf('arrayBuffer('));
  });

  it('🔴 quem não é admin não descobre se o comunicado existe (404, nunca 403)', () => {
    const c = ler(ROTA);
    expect(/status:\s*403/.test(c)).toBe(false);
  });

  it('a resposta não devolve a URL do arquivo', () => {
    expect(/NextResponse\.json\([^)]*urlPdfAssinado/.test(compactar(ler(ROTA)))).toBe(false);
  });
});

describe('a entrega do arquivo assinado serve o tipo REAL do arquivo', () => {
  it('🔴 não fixa `application/pdf` — um JPG enviado pelo WhatsApp abriria quebrado', () => {
    const c = compactar(ler('app/api/comunicados/[id]/arquivo/route.ts'));
    expect(/'content-type':\s*'application\/pdf'/.test(c)).toBe(false);
    expect(c).toMatch(/privado\.contentType/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. A TELA DO ADMIN E O QUE O PACIENTE VÊ
// ═══════════════════════════════════════════════════════════════════════════════

describe('o card do admin', () => {
  const CARTAO = 'components/admin/comunicados/CartaoComunicadoDoacao.tsx';
  const c = () => compactar(ler(CARTAO));

  it('🔴 tem "Registrar assinatura manualmente", só para comunicado pendente, ao lado do reenvio', () => {
    const t = c();
    expect(t).toContain('Registrar assinatura manualmente');
    const i = t.indexOf('Registrar assinatura manualmente');
    // "Reenviar e-mail" também aparece em mensagens de aviso: vale a ocorrência MAIS PRÓXIMA
    const ocorrencias = [...t.matchAll(/Reenviar e-mail/g)].map((m) => m.index ?? 0);
    expect(
      ocorrencias.length,
      'o botão "Reenviar e-mail" sumiu — o guarda ficou sem referência',
    ).toBeGreaterThan(0);
    // o botão novo fica na MESMA linha de botões que o reenvio (a distância entre eles é curta)
    expect(Math.min(...ocorrencias.map((o) => Math.abs(i - o)))).toBeLessThan(1500);
    expect(t.slice(Math.max(0, i - 700), i)).toMatch(/atual\??\.status === 'pendente'/);
  });

  it('o envio vai para a rota autenticada, com o arquivo e a data', () => {
    const t = c();
    expect(t).toMatch(/\/api\/comunicados\/\$\{[^}]+\}\/assinatura-manual/);
    expect(t).toMatch(/append\('arquivo'/);
    expect(t).toMatch(/append\('dataAssinatura'/);
  });

  it('o card diz que foi MANUAL — não afirma "confirmada pelo DocuSign" para um registro manual', () => {
    const t = c();
    expect(t).toMatch(/registroManual/);
    expect(t).toMatch(/Registrad[ao] manualmente/);
  });
});

describe('o paciente deixa de ver a pendência assim que o status vira assinado', () => {
  it('🔴 o aviso grande do dashboard só conta `pendente`', () => {
    const c = compactar(ler('components/paciente/AvisoDeDocumentoParaAssinar.tsx'));
    expect(c).toMatch(/filter\(\(c\) => c\.status === 'pendente'\)/);
  });

  it('🔴 a lista do paciente lê o MESMO status do banco (não há segundo lugar a atualizar)', () => {
    const c = compactar(ler('lib/comunicados/assinatura.ts'));
    const i = c.indexOf('export async function listarParaPaciente');
    expect(c.slice(i, i + 1200)).toMatch(
      /status:\s*c\.status as ComunicadoParaPaciente\['status'\]/,
    );
  });
});

describe('a migration só ACRESCENTA colunas', () => {
  it('existe e não altera nem apaga nada', () => {
    const arquivo = `db/migrations/0054_registro_manual_do_comunicado.sql`;
    expect(existsSync(join(RAIZ, arquivo)), `falta ${arquivo}`).toBe(true);
    const sql = readFileSync(join(RAIZ, arquivo), 'utf8');
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|ALTER COLUMN|TRUNCATE/i);
    for (const col of [
      'registro_manual_em',
      'registro_manual_por_user_id',
      'registro_manual_observacao',
      'registro_manual_nome_arquivo',
    ]) {
      expect(sql).toContain(col);
    }
  });
});
