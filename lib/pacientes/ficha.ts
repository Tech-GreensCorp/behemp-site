/**
 * A FICHA do paciente: os campos e as regras do cadastro, num lugar só.
 *
 * 🔴 POR QUE ESTE MÓDULO EXISTE (29/10/2026). O schema e o mapeamento de colunas moravam DENTRO de
 * `criarPaciente` (`app/_actions/pacientes.ts`), um arquivo `'use server'` — e esse tipo de arquivo só pode
 * exportar funções `async`. O cadastro do DEPENDENTE (`lib/dependentes/`) precisa dos MESMOS campos e das
 * MESMAS regras do cadastro administrativo (`/admin/pacientes/novo`); sem esta extração a opção era copiar o
 * schema, e duas cópias divergem na regra. Sem `db`, sem `auth`, sem `next/*`.
 *
 * ⚠️ É extração, não mudança: o schema e o mapeamento são os de `criarPaciente`, linha a linha.
 */
import { z } from 'zod';

export const criarPacienteSchema = z.object({
  // Dados pessoais
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  genero: z.string().optional(),
  // Endereço
  cep: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  // Dados clínicos
  peso: z.string().optional(),
  altura: z.string().optional(),
  historicoMedico: z.string().optional(),
  patologia: z.string().optional(),
  // Dados da associação
  atendimento: z.string().optional(),
  temAdvogado: z.string().optional(),
  nomeAdvogado: z.string().optional(),
  cid: z.string().optional(),
  categorizacao: z.string().optional(),
  comoConheceu: z.string().optional(),
  dataAssociacao: z.string().optional(),
  entradaPaciente: z.string().optional(),
  etapa: z.string().optional(),
  hospitalProximo: z.string().optional(),
  homeCare: z.string().optional(),
  planoSaude: z.string().optional(),
  possuiPlanoSaude: z.string().optional(),
  rendaFamilia: z.string().optional(),
  termoAssociado: z.string().optional(),
  valorContribuicao: z.string().optional(),
  processoJudicializacao: z.string().optional(),
  // Responsável
  responsavelNome: z.string().optional(),
  responsavelCpf: z.string().optional(),
  // Tratamento
  tratamentoTipo: z.enum(['cbd', 'thc', 'cbd_thc']).optional(),
});

export type DadosDaFicha = z.infer<typeof criarPacienteSchema>;

/**
 * Os campos de `pacientes` que o cadastro preenche, a partir dos dados já validados (e já sem os campos
 * vazios, `semCamposVazios`). NÃO inclui `userId`, `medicoId` nem `status`: quem cria a ficha decide.
 */
export function camposDaFicha(d: Partial<DadosDaFicha>) {
  return {
    dataNascimento: d.dataNascimento,
    cpf: d.cpf,
    rg: d.rg,
    genero: d.genero,
    cep: d.cep,
    endereco: d.endereco,
    cidade: d.cidade,
    uf: d.uf,
    peso: d.peso,
    altura: d.altura,
    historicoMedico: d.historicoMedico,
    patologia: d.patologia,
    atendimento: d.atendimento,
    temAdvogado: d.temAdvogado,
    nomeAdvogado: d.nomeAdvogado,
    cid: d.cid,
    categorizacao: d.categorizacao,
    comoConheceu: d.comoConheceu,
    dataAssociacao: d.dataAssociacao,
    entradaPaciente: d.entradaPaciente,
    etapa: d.etapa,
    hospitalProximo: d.hospitalProximo,
    homeCare: d.homeCare,
    planoSaude: d.planoSaude,
    possuiPlanoSaude: d.possuiPlanoSaude,
    rendaFamilia: d.rendaFamilia,
    termoAssociado: d.termoAssociado,
    valorContribuicao: d.valorContribuicao,
    processoJudicializacao: d.processoJudicializacao,
    responsavelNome: d.responsavelNome,
    responsavelCpf: d.responsavelCpf,
    tratamentoTipo: d.tratamentoTipo,
  };
}
