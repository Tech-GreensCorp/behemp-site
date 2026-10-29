/**
 * Os grupos do menu lateral do responsável — puro (sem `db`, `auth` nem `next/*`), para o teste conferir de
 * verdade o que o menu mostra e para quem. A barra lateral só DESENHA o que esta função devolve.
 *
 * 🔴 IDENTIFICAÇÃO DE A QUEM PERTENCE (pedido de Dryelle, 29/10/2026):
 *   · os dependentes são itens do menu, cada um com o NOME;
 *   · ao abrir um, o menu mostra as seções DAQUELE dependente sob o título "Dados de <primeiro nome>", com o
 *     id DELE nos links; nunca uma lista de "Medicamentos" solta que não diga de quem é;
 *   · SEM dependentes, não há grupo de dependentes nem seção de paciente nenhuma.
 */
import { caminhoDoDependente, primeiroNome, SECOES_DO_DEPENDENTE } from '@/lib/dependentes/rotulos';

export type IconeDoMenu = 'inicio' | 'dependentes' | 'pessoa';

export interface ItemDoMenu {
  label: string;
  href: string;
  icone?: IconeDoMenu;
  /** Só o caminho exato marca como ativo (a raiz de uma seção). */
  exato?: boolean;
}

export interface GrupoDoMenu {
  title: string;
  items: ItemDoMenu[];
}

export interface DependenteDoMenu {
  pacienteId: string;
  nome: string;
}

export function montarGruposDoMenu(entrada: {
  dependentes: DependenteDoMenu[];
  pathname: string;
  /** O `paciente` que também é responsável ganha o caminho de volta à própria área. */
  temAreaDePaciente: boolean;
}): GrupoDoMenu[] {
  const { dependentes, pathname, temAreaDePaciente } = entrada;

  const grupos: GrupoDoMenu[] = [
    {
      title: 'Geral',
      items: [
        { label: 'Início', href: '/responsavel', icone: 'inicio', exato: true },
        {
          label: 'Seus dependentes',
          href: '/responsavel/dependentes',
          icone: 'dependentes',
          exato: true,
        },
      ],
    },
  ];

  if (dependentes.length > 0) {
    grupos.push({
      title: 'Dependentes',
      items: dependentes.map((d) => ({
        label: d.nome,
        href: caminhoDoDependente(d.pacienteId),
        icone: 'pessoa' as const,
        exato: true,
      })),
    });
  }

  const idAberto = pathname.match(/^\/responsavel\/dependentes\/([^/]+)/)?.[1];
  const aberto = dependentes.find((d) => d.pacienteId === idAberto);
  if (aberto) {
    grupos.push({
      title: `Dados de ${primeiroNome(aberto.nome)}`,
      items: SECOES_DO_DEPENDENTE.filter((s) => s.sufixo !== '').map((s) => ({
        label: s.rotulo,
        href: caminhoDoDependente(aberto.pacienteId, s.sufixo),
      })),
    });
  }

  if (temAreaDePaciente) {
    grupos.push({
      title: 'Minha conta',
      items: [{ label: 'Minha área de paciente', href: '/paciente', icone: 'pessoa', exato: true }],
    });
  }

  return grupos;
}
