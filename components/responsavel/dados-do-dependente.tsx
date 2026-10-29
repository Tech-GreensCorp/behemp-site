import { HeartPulse, Hospital, IdCard, MapPin, type LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { FichaDoDependenteLida } from '@/lib/dependentes/leituras';
import { idadeEmAnos } from '@/lib/dependentes/regras';
import { LABEL_TRATAMENTO, formatarDataISO } from '@/lib/dependentes/rotulos';
import { formatarCpf } from '@/lib/validacao/cpf';

const SIM_NAO: Record<string, string> = { sim: 'Sim', nao: 'Não' };
const GENERO: Record<string, string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  outro: 'Outro',
  nao_informado: 'Prefere não informar',
};

interface Item {
  rotulo: string;
  valor: string | null;
  /** Texto longo (histórico, patologia): ocupa a linha inteira. */
  largo?: boolean;
}

interface Grupo {
  titulo: string;
  icone: LucideIcon;
  itens: Item[];
}

const preenchido = (v: string | null | undefined): string | null =>
  v && v.trim() ? v.trim() : null;
const simNao = (v: string | null) => (v ? (SIM_NAO[v] ?? v) : null);

/** Junta só o que existe: `["32 kg", null, "1,40 m"]` → `"32 kg · 1,40 m"`. */
const juntar = (partes: Array<string | null>, sep = ' · ') => {
  const ok = partes.filter((p): p is string => !!p);
  return ok.length ? ok.join(sep) : null;
};

/** Os campos do dependente, em quatro grupos. Pura: nada de banco, nada de rede. */
export function agruparDadosDoDependente(f: FichaDoDependenteLida): Grupo[] {
  const idade = idadeEmAnos(f.dataNascimento);
  const nascimento = f.dataNascimento
    ? juntar(
        [
          formatarDataISO(f.dataNascimento),
          idade !== null ? `${idade} ${idade === 1 ? 'ano' : 'anos'}` : null,
        ],
        ' — ',
      )
    : null;

  return [
    {
      titulo: 'Identificação',
      icone: IdCard,
      itens: [
        { rotulo: 'Nome completo', valor: preenchido(f.nome) },
        { rotulo: 'Nascimento', valor: nascimento },
        { rotulo: 'Gênero', valor: f.genero ? (GENERO[f.genero] ?? f.genero) : null },
        { rotulo: 'CPF', valor: f.cpf ? formatarCpf(f.cpf) : null },
        { rotulo: 'RG', valor: preenchido(f.rg) },
      ],
    },
    {
      titulo: 'Endereço',
      icone: MapPin,
      itens: [
        { rotulo: 'Endereço', valor: preenchido(f.endereco), largo: true },
        { rotulo: 'Cidade / UF', valor: juntar([preenchido(f.cidade), preenchido(f.uf)], ' / ') },
        { rotulo: 'CEP', valor: preenchido(f.cep) },
      ],
    },
    {
      titulo: 'Saúde',
      icone: HeartPulse,
      itens: [
        {
          rotulo: 'Tratamento',
          valor: f.tratamentoTipo ? (LABEL_TRATAMENTO[f.tratamentoTipo] ?? f.tratamentoTipo) : null,
        },
        {
          rotulo: 'Peso e altura',
          valor: juntar([f.peso ? `${f.peso} kg` : null, f.altura ? `${f.altura} cm` : null]),
        },
        { rotulo: 'CID', valor: preenchido(f.cid) },
        { rotulo: 'Patologia', valor: preenchido(f.patologia), largo: true },
        { rotulo: 'Histórico médico', valor: preenchido(f.historicoMedico), largo: true },
      ],
    },
    {
      titulo: 'Atendimento e plano de saúde',
      icone: Hospital,
      itens: [
        { rotulo: 'Hospital mais próximo', valor: preenchido(f.hospitalProximo), largo: true },
        { rotulo: 'Home Care', valor: simNao(f.homeCare) },
        {
          rotulo: 'Plano de saúde',
          valor: f.possuiPlanoSaude === 'nao' ? 'Não possui' : preenchido(f.planoSaude),
        },
        { rotulo: 'Renda da família', valor: preenchido(f.rendaFamilia) },
        { rotulo: 'Como conheceu a Be4Hope', valor: preenchido(f.comoConheceu) },
        {
          rotulo: 'Advogado',
          valor:
            f.temAdvogado === 'nao'
              ? 'Não possui'
              : (preenchido(f.nomeAdvogado) ?? (f.temAdvogado === 'sim' ? 'Sim' : null)),
        },
        {
          rotulo: 'Processo de judicialização',
          valor: preenchido(f.processoJudicializacao),
          largo: true,
        },
      ],
    },
  ];
}

/**
 * Os dados do dependente numa leitura limpa: só o que foi informado aparece, com valor em destaque; o que ficou
 * em branco vira UMA linha ao final ("Não informado: …"), em vez de uma coluna de traços. Só mostra o que o
 * responsável declarou (nunca os campos internos da associação).
 */
export function DadosDoDependente({ ficha }: { ficha: FichaDoDependenteLida }) {
  const grupos = agruparDadosDoDependente(ficha);
  const naoInformados = grupos.flatMap((g) => g.itens.filter((i) => !i.valor).map((i) => i.rotulo));

  return (
    <section aria-label="Dados do dependente" className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {grupos.map((g) => {
          const preenchidos = g.itens.filter((i) => i.valor);
          if (preenchidos.length === 0) return null;
          const Icone = g.icone;
          return (
            <Card key={g.titulo} className="border-border/50 rounded-[1.75rem] shadow-sm">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-xl">
                    <Icone className="h-4 w-4" />
                  </div>
                  <h3 className="font-display text-foreground text-base font-bold">{g.titulo}</h3>
                </div>
                <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5">
                  {preenchidos.map((i) => (
                    <div key={i.rotulo} className={i.largo ? 'col-span-2' : undefined}>
                      <dt className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                        {i.rotulo}
                      </dt>
                      <dd className="text-foreground mt-0.5 text-sm font-medium wrap-break-word whitespace-pre-line">
                        {i.valor}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {naoInformados.length > 0 && (
        <p className="text-muted-foreground px-1 text-xs">
          <span className="font-semibold">Não informado:</span> {naoInformados.join(', ')}.
        </p>
      )}
    </section>
  );
}
