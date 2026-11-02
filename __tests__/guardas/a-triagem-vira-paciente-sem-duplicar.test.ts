/**
 * GUARDA — a triagem vira paciente por ato do admin, sem duplicar, e a conta nasce junto.
 *
 * Classe de erro: converter criar SEGUNDA ficha/usuário para quem já é paciente, converter sem
 * ser admin, o e-mail de boas-vindas carregar senha ou token no lugar errado, a lista de Pacientes
 * não achar nem arquivados (filtro "Arquivado" vazio), a atribuição de médico tocar ficha arquivada,
 * e a tela de triagens voltar a oferecer o que o dono mandou tirar.
 *
 * Deriva do código (lê os arquivos); a parte pura é executada.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { dadosDoPacienteDaTriagem, dataDeNascimento } from '@/lib/triagens/dados-do-paciente';
import { montarEmailDeBoasVindas } from '@/lib/pacientes/email-de-boas-vindas';

const ler = (rel: string) =>
  readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CONVERTER = semComentarios(ler('app/_actions/converter-triagem.ts'));
const TELA_TRIAGENS = semComentarios(ler('app/(admin)/admin/triagens/page.tsx'));
const TELA_PACIENTES = semComentarios(ler('app/(admin)/admin/pacientes/page.tsx'));
const LISTA_ADMIN = semComentarios(ler('app/_actions/admin-pacientes.ts'));
const ATRIBUICAO = semComentarios(ler('app/_actions/admin-atribuicao.ts'));
const SIDEBAR = ler('components/shared/admin-sidebar.tsx');
const BOAS_VINDAS = semComentarios(ler('lib/pacientes/boas-vindas.ts'));
const CRIAR_PACIENTE = semComentarios(ler('app/_actions/pacientes.ts'));
const DEFINIR_SENHA = semComentarios(ler('app/(auth)/entrar/definir-senha/page.tsx'));

describe('a tradução triagem → ficha (pura)', () => {
  const base = {
    nomeContato: 'Maria Souza',
    emailContato: '  Maria@Exemplo.COM ',
    telefoneContato: '11999990000',
    dados: {
      cpf: '123.456.789-09',
      data_nascimento: '1980-05-17',
      estado: 'SP',
      diagnostico_principal: 'Epilepsia',
    } as Record<string, unknown>,
  };

  it('normaliza o e-mail (o webhook do Clerk casa por igualdade exata)', () => {
    expect(dadosDoPacienteDaTriagem(base)?.email).toBe('maria@exemplo.com');
  });

  it('leva só o que a ficha guarda e o formulário pergunta', () => {
    const d = dadosDoPacienteDaTriagem(base)!;
    expect(d).toMatchObject({ nome: 'Maria Souza', cpf: '123.456.789-09', uf: 'SP', patologia: 'Epilepsia' });
    expect(Object.keys(d)).not.toContain('renda_total');
  });

  it('sem e-mail ou sem nome não há o que converter', () => {
    expect(dadosDoPacienteDaTriagem({ ...base, emailContato: null, dados: {} })).toBeNull();
    expect(dadosDoPacienteDaTriagem({ ...base, nomeContato: null, dados: {} })).toBeNull();
  });

  it('o e-mail pode vir do formulário quando o contato está vazio', () => {
    const d = dadosDoPacienteDaTriagem({ ...base, emailContato: null, dados: { email: 'A@b.com' } });
    expect(d?.email).toBe('a@b.com');
  });

  it('data de nascimento: aceita ISO e dd/mm/aaaa; descarta o duvidoso (nunca adivinha)', () => {
    expect(dataDeNascimento('1980-05-17')).toBe('1980-05-17');
    expect(dataDeNascimento('17/05/1980')).toBe('1980-05-17');
    expect(dataDeNascimento('31/02/1980')).toBeUndefined();
    expect(dataDeNascimento('2999-01-01')).toBeUndefined();
    expect(dataDeNascimento('maio de 80')).toBeUndefined();
    expect(dataDeNascimento(undefined)).toBeUndefined();
  });

  it('UF só entra com duas letras (estado por extenso não é adivinhado)', () => {
    const d = dadosDoPacienteDaTriagem({ ...base, dados: { estado: 'São Paulo' } });
    expect(d?.uf).toBeUndefined();
  });
});

describe('a conversão é ato do admin e não duplica', () => {
  it('exige admin antes de qualquer consulta', () => {
    const i = CONVERTER.indexOf('verificarAdmin()');
    expect(i).toBeGreaterThan(-1);
    expect(CONVERTER.indexOf('db\n      .select')).toBeGreaterThan(i);
  });

  it('reaproveita criarPaciente (mesma porta do "Novo paciente"): conta, auditoria e boas-vindas', () => {
    expect(CONVERTER).toMatch(/await criarPaciente\(/);
    expect(CONVERTER).not.toMatch(/\.insert\(pacientes\)|\.insert\(users\)/);
  });

  it('confere ficha existente ANTES de criar: ativa → devolve a existente; arquivada → recusa', () => {
    const iPre = CONVERTER.indexOf('lower(${users.email})');
    const iCria = CONVERTER.indexOf('await criarPaciente(');
    expect(iPre).toBeGreaterThan(-1);
    expect(iPre).toBeLessThan(iCria);
    expect(CONVERTER).toContain('jaEraPaciente: true');
    expect(CONVERTER).toContain('arquivado');
  });

  it('não apaga nem altera a triagem', () => {
    expect(CONVERTER).not.toMatch(/\.delete\(triagens\)|\.update\(triagens\)/);
  });

  it('a tela só chama a conversão para quem ainda NÃO é paciente', () => {
    expect(TELA_TRIAGENS).toMatch(/triagemSelecionada\.ehPaciente \?/);
    expect(TELA_TRIAGENS).toContain('converterTriagemEmPaciente(');
  });
});

describe('a conta e o e-mail de boas-vindas', () => {
  it('só se convida quem teve a conta CRIADA agora (conta existente não é convidada a trocar senha)', () => {
    expect(CRIAR_PACIENTE).toMatch(/acesso\.situacao === 'criada'[\s\S]{0,80}enviarBoasVindasComLinkDeSenha\(/);
  });

  it('o link leva o token no FRAGMENTO, nunca no query', () => {
    expect(BOAS_VINDAS).toContain('/entrar/definir-senha#ticket=');
    expect(BOAS_VINDAS).not.toMatch(/definir-senha\?/);
    expect(DEFINIR_SENHA).toContain('window.location.hash');
  });

  it('o token expira (7 dias) e nenhuma senha é gerada ou enviada', () => {
    expect(BOAS_VINDAS).toContain('expiresInSeconds');
    expect(BOAS_VINDAS).not.toMatch(/password|senhaTemporaria|gerarSenha/i);
    const { html } = montarEmailDeBoasVindas({ nome: 'Ana', link: 'https://x/y#ticket=abc' });
    expect(html).toContain('Definir minha senha');
    expect(html).toMatch(/não pedimos sua senha/i);
  });

  it('a falha do e-mail não desfaz o cadastro (nunca lança)', () => {
    expect(BOAS_VINDAS).toMatch(/catch \(e\)[\s\S]*ok: false/);
  });

  it('o nome do paciente é escapado no HTML do e-mail', () => {
    const { html } = montarEmailDeBoasVindas({ nome: '<script>x</script>', link: 'https://x' });
    expect(html).not.toContain('<script>');
  });
});

describe('a lista de Pacientes e a atribuição de médico', () => {
  it('o filtro "Arquivado" enxerga os arquivados (deletedAt NOT NULL), os demais só os ativos', () => {
    expect(LISTA_ADMIN).toMatch(/status === 'arquivado'[\s\S]{0,60}isNotNull\(pacientes\.deletedAt\)/);
    expect(LISTA_ADMIN).toMatch(/isNull\(pacientes\.deletedAt\)/);
  });

  it('o mais recente vem primeiro, com desempate estável', () => {
    expect(LISTA_ADMIN).toContain('.orderBy(desc(pacientes.createdAt), desc(pacientes.id))');
  });

  it('a tela não tem mais os filtros de fase e de tipo, nem a flag de status ao lado do arquivar', () => {
    expect(TELA_PACIENTES).not.toContain('Todas as fases');
    expect(TELA_PACIENTES).not.toContain('Todos os tipos');
    expect(TELA_PACIENTES).not.toContain('statusConfig');
  });

  it('atribuir, contar e reatribuir ignoram ficha arquivada', () => {
    for (const nome of ['atribuirMedicoAoPaciente', 'contarPacientesSemMedico', 'reatribuirTodosPacientes']) {
      const ini = ATRIBUICAO.indexOf(`function ${nome}`);
      const proxima = ATRIBUICAO.indexOf('\nexport async function', ini + 1);
      const corpo = ATRIBUICAO.slice(ini, proxima === -1 ? undefined : proxima);
      expect(corpo, nome).toContain('isNull(pacientes.deletedAt)');
    }
  });

  it('atribuir médico não muda a posição da linha: a ordenação não agrupa por "tem médico"', () => {
    const ini = ATRIBUICAO.indexOf('function listarPacientesComMedicoPaginado');
    const fim = ATRIBUICAO.indexOf('function listarMedicosDisponiveis');
    expect(ATRIBUICAO.slice(ini, fim)).not.toMatch(/CASE WHEN p\.medico_id IS NULL/);
  });

  it('a atribuição só escreve medicoId (não muda status nem arquivamento)', () => {
    const ini = ATRIBUICAO.indexOf('function atribuirMedicoAoPaciente');
    const fim = ATRIBUICAO.indexOf('function contarPacientesSemMedico');
    const corpo = ATRIBUICAO.slice(ini, fim);
    expect(corpo).toContain('.set({ medicoId })');
    expect(corpo).not.toMatch(/\.set\(\{[^}]*(status|deletedAt)/);
  });
});

describe('a tela de triagens', () => {
  it('não oferece mais o que foi retirado', () => {
    for (const termo of [
      'Ver na planilha',
      'Marcar como respondida',
      'Marcar como lida',
      'Elementor</Badge>',
      'Formulário novo',
      'Respondidas',
      'Visualizada',
      'carta de doação',
    ]) {
      expect(TELA_TRIAGENS, termo).not.toContain(termo);
    }
    expect(TELA_TRIAGENS).not.toMatch(/>\s*Fechar\s*</);
  });

  it('abrir os detalhes marca como lida e só reflete na tela o que o servidor gravou', () => {
    const ini = TELA_TRIAGENS.indexOf('async function handleVisualizarTriagem');
    const corpo = TELA_TRIAGENS.slice(ini, TELA_TRIAGENS.indexOf('async function handleConverter'));
    expect(corpo).toContain("atualizarStatusTriagem(triagem.id, 'visualizada')");
    expect(corpo).toMatch(/if \(!resultado\.sucesso\) return;/);
    expect(corpo.indexOf('if (!resultado.sucesso)')).toBeLessThan(corpo.indexOf('setTodasTriagens'));
  });

  it('o modal tem altura limitada à tela e rolagem só no corpo', () => {
    expect(TELA_TRIAGENS).toMatch(/max-h-\[calc\(100dvh-/);
    expect(TELA_TRIAGENS).toMatch(/min-h-0 flex-1 overflow-y-auto/);
  });
});

describe('o sidebar', () => {
  it('começa por Triagens, Pacientes, Atribuir Médico, Médicos — e perde nenhuma rota', () => {
    const ordem = [...SIDEBAR.matchAll(/href: '(\/admin[^']*)'/g)].map((m) => m[1]);
    expect(ordem.slice(0, 4)).toEqual([
      '/admin/triagens',
      '/admin/pacientes',
      '/admin/atribuir-medico',
      '/admin/medicos',
    ]);
    for (const rota of [
      '/admin',
      '/admin/usuarios',
      '/admin/teleconsulta',
      '/admin/procuracoes',
      '/admin/anvisa',
      '/admin/alertas',
      '/admin/calculadora',
      '/admin/chat',
      '/admin/mensagens',
      '/admin/leads-ebooks',
      '/admin/pagamentos',
      '/admin/invoices',
      '/admin/recompras',
      '/admin/perfil',
    ]) {
      expect(ordem, rota).toContain(rota);
    }
    expect(new Set(ordem).size).toBe(ordem.length);
  });
});

describe('excluir triagem', () => {
  // O dono pediu para tirar só o botão do MODAL; o da lista (com confirmação) fica.
  it('a lista mantém o botão de excluir, com confirmação; o modal de detalhes não tem', () => {
    expect(TELA_TRIAGENS).toContain('excluirTriagem(');
    expect(TELA_TRIAGENS).toContain('<ModalConfirmarExclusao');
    const modal = TELA_TRIAGENS.slice(TELA_TRIAGENS.indexOf('Modal de detalhes'));
    const dentroDoModalDeDetalhes = modal.slice(0, modal.indexOf('<ModalConfirmarExclusao'));
    expect(dentroDoModalDeDetalhes).not.toContain('Excluir triagem');
  });
});

describe('reativar paciente arquivado', () => {
  const REATIVAR = LISTA_ADMIN.slice(LISTA_ADMIN.indexOf('function reativarPacienteAdmin'));

  it('é só admin, só mexe em ficha ARQUIVADA e não apaga nem recria nada', () => {
    expect(REATIVAR.indexOf('verificarAdmin()')).toBeLessThan(REATIVAR.indexOf('db\n      .select'));
    expect(REATIVAR).toMatch(/\.update\(pacientes\)[\s\S]{0,120}deletedAt: null/);
    expect(REATIVAR).toMatch(/isNotNull\(pacientes\.deletedAt\)/);
    expect(REATIVAR).not.toMatch(/\.delete\(|\.insert\(pacientes\)/);
  });

  it('não reativa ficha cujo usuário foi apagado, e audita quem reativou', () => {
    expect(REATIVAR).toContain('userApagadoEm');
    expect(REATIVAR).toContain('registrarAuditoria(');
    expect(REATIVAR).toContain('reativado: true');
  });

  it('a tela oferece Reativar só para arquivado, com confirmação', () => {
    expect(TELA_PACIENTES).toContain('reativarPacienteAdmin(');
    expect(TELA_PACIENTES).toMatch(/paciente\.arquivado \? \([\s\S]{0,700}Reativar/);
    expect(TELA_PACIENTES).toContain('Sim, reativar');
  });
});
