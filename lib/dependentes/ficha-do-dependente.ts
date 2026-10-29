/**
 * A ficha do DEPENDENTE: os MESMOS campos e regras do cadastro administrativo (`/admin/pacientes/novo`),
 * menos o que não é do responsável. ADR-0033, decisão de Dryelle em 29/10/2026.
 *
 * Parte de `criarPacienteSchema` (`lib/pacientes/ficha.ts`), o mesmo que `criarPaciente` usa: nenhum campo e
 * nenhuma regra é reescrito aqui. O que muda é o que SAI e o que se EXIGE:
 *
 * 🔴 SAEM, no SERVIDOR (não só da tela — mass assignment, OWASP API3): os campos INTERNOS da associação, que a
 * equipe preenche e que mexem em fluxo e em dinheiro (`valorContribuicao`, `termoAssociado`, `categorizacao`,
 * `etapa`, `atendimento`, `entradaPaciente`, `dataAssociacao`). Um responsável que os mande por fora da tela
 * tem o valor DESCARTADO pelo Zod. A lista é `CAMPOS_INTERNOS_DA_ASSOCIACAO`: uma só, e o teste de integração
 * a percorre.
 *
 * Saem também `email` e `telefone`: o dependente não tem login, nem e-mail, nem telefone (P-04 e P-09). O contato
 * do aviso é o do RESPONSÁVEL. E `responsavelNome`/`responsavelCpf`: vêm do vínculo, não do que o formulário
 * digitar (senão o responsável nomearia outra pessoa).
 *
 * SE EXIGE: a data de nascimento (dado do prontuário), que precisa ser plausível (D-05, retificada).
 *
 * ⚠️ DECISÃO ABERTA do dono: se algum campo interno deve passar a ser do responsável. Hoje nenhum é.
 */
import { z } from 'zod';

import { dataDeNascimentoPlausivel } from '@/lib/dependentes/regras';
import { criarPacienteSchema } from '@/lib/pacientes/ficha';
import { cpfEhValido } from '@/lib/validacao/cpf';

/** Campos que a EQUIPE preenche. O responsável nunca os grava, nem por fora da tela. */
export const CAMPOS_INTERNOS_DA_ASSOCIACAO = [
  'atendimento',
  'categorizacao',
  'dataAssociacao',
  'entradaPaciente',
  'etapa',
  'termoAssociado',
  'valorContribuicao',
] as const;

/** Campos que o dependente não tem (contato) ou que vêm do vínculo (responsável). */
const CAMPOS_DO_VINCULO_E_CONTATO = [
  'email',
  'telefone',
  'responsavelNome',
  'responsavelCpf',
] as const;

const omitir = Object.fromEntries(
  [...CAMPOS_INTERNOS_DA_ASSOCIACAO, ...CAMPOS_DO_VINCULO_E_CONTATO].map((k) => [k, true]),
) as Record<
  (typeof CAMPOS_INTERNOS_DA_ASSOCIACAO)[number] | (typeof CAMPOS_DO_VINCULO_E_CONTATO)[number],
  true
>;

export const fichaDoDependenteSchema = criarPacienteSchema.omit(omitir).extend({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome completo do dependente.')
    .max(120, 'O nome é longo demais.'),
  dataNascimento: z
    .string()
    .refine(
      (v) => dataDeNascimentoPlausivel(v),
      'Informe uma data de nascimento válida: ela não pode ser no futuro.',
    ),
  // O CPF do próprio dependente é opcional (a criança pode não ter), mas, se vier, tem de ser válido.
  cpf: z
    .string()
    .optional()
    .refine((v) => !v || v.trim() === '' || cpfEhValido(v), 'O CPF do dependente é inválido.'),
});

export type FichaDoDependente = z.infer<typeof fichaDoDependenteSchema>;

/** O pedido completo: a ficha, mais o que vincula quem cadastra. */
export const cadastroDeDependenteSchema = fichaDoDependenteSchema.extend({
  parentesco: z
    .string()
    .trim()
    .min(2, 'Informe o parentesco.')
    .max(40, 'O parentesco é longo demais.'),
  cpfDoResponsavel: z.string().refine((v) => cpfEhValido(v), 'CPF inválido.'),
});

export type CadastroDeDependente = z.infer<typeof cadastroDeDependenteSchema>;
