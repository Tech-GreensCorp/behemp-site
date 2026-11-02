/**
 * Traduz as respostas de uma triagem para os campos de um novo paciente.
 *
 * Puro de propósito: sem `db`, sem `auth`, sem `next/*`. Só leva o que o formulário público
 * pergunta e a ficha tem coluna para guardar (minimização: campo sem consumidor não é copiado).
 * Resposta ausente ou em formato duvidoso fica de fora — o admin completa na ficha, e uma data
 * adivinhada errada em prontuário é pior que data em branco.
 */

export type DadosParaOPaciente = {
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  dataNascimento?: string;
  peso?: string;
  altura?: string;
  cep?: string;
  endereco?: string;
  uf?: string;
  patologia?: string;
  comoConheceu?: string;
};

type Triagem = {
  nomeContato: string | null;
  emailContato: string | null;
  telefoneContato: string | null;
  dados: Record<string, unknown>;
};

function texto(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim();
  return limpo ? limpo : undefined;
}

/** Aceita `AAAA-MM-DD` e `DD/MM/AAAA` (importação do Elementor). Qualquer outra forma é descartada. */
export function dataDeNascimento(valor: unknown): string | undefined {
  const t = texto(valor);
  if (!t) return undefined;
  let ano: string, mes: string, dia: string;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (iso) [, ano, mes, dia] = iso;
  else if (br) [, dia, mes, ano] = br;
  else return undefined;
  const d = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
  const confere =
    !Number.isNaN(d.getTime()) &&
    d.getUTCFullYear() === Number(ano) &&
    d.getUTCMonth() + 1 === Number(mes) &&
    d.getUTCDate() === Number(dia);
  return confere && Number(ano) > 1900 && d.getTime() <= Date.now()
    ? `${ano}-${mes}-${dia}`
    : undefined;
}

export function dadosDoPacienteDaTriagem(t: Triagem): DadosParaOPaciente | null {
  const email = (texto(t.emailContato) ?? texto(t.dados['email']))?.toLowerCase();
  if (!email) return null;

  const nome = texto(t.nomeContato) ?? texto(t.dados['nome_paciente']);
  if (!nome || nome.length < 2) return null;

  const uf = texto(t.dados['estado']);
  return {
    nome,
    email,
    telefone: texto(t.telefoneContato) ?? texto(t.dados['telefone']),
    cpf: texto(t.dados['cpf']),
    dataNascimento: dataDeNascimento(t.dados['data_nascimento']),
    peso: texto(t.dados['peso']),
    altura: texto(t.dados['altura']),
    cep: texto(t.dados['cep']),
    endereco: texto(t.dados['endereco']),
    uf: uf && /^[A-Za-z]{2}$/.test(uf) ? uf.toUpperCase() : undefined,
    patologia: texto(t.dados['diagnostico_principal']),
    comoConheceu: texto(t.dados['como_chegou']),
  };
}
