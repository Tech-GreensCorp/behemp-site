import type { Metadata } from 'next';

import { FormularioDeDependente } from '@/components/responsavel/formulario-de-dependente';

export const metadata: Metadata = { title: 'Cadastrar dependente | Be4Hope' };

/**
 * O cadastro do dependente: os mesmos campos do cadastro administrativo de pacientes. O responsável que chega
 * aqui já passou pelo layout (papel); a gravação é validada de novo no servidor (`cadastrarDependente`).
 */
export default function NovoDependentePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          Cadastrar dependente
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          O dependente é registrado como paciente, com os mesmos dados do cadastro da equipe. Você
          fica como responsável por ele e recebe os avisos.
        </p>
      </div>
      <FormularioDeDependente />
    </div>
  );
}
