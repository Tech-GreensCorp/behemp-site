'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { cadastrarDependente } from '@/app/_actions/dependentes';
import { CepRapido, type ValoresDeEndereco } from '@/components/paciente/CepRapido';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PARENTESCOS_SUGERIDOS } from '@/lib/dependentes/regras';
import { caminhoDoDependente } from '@/lib/dependentes/rotulos';
import { mascaraCpf } from '@/lib/validacao/mascaras';

const CAMPO_SELECT =
  'h-10 w-full rounded-xl border border-border/60 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

const SIM_NAO = [
  { valor: '', rotulo: 'Selecione' },
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
];

/** Os campos de texto da ficha. As chaves são as do `criarPacienteSchema` (cadastro da equipe). */
interface Campos {
  nome: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  genero: string;
  peso: string;
  altura: string;
  historicoMedico: string;
  patologia: string;
  cid: string;
  tratamentoTipo: string;
  hospitalProximo: string;
  homeCare: string;
  possuiPlanoSaude: string;
  planoSaude: string;
  rendaFamilia: string;
  comoConheceu: string;
  temAdvogado: string;
  nomeAdvogado: string;
  processoJudicializacao: string;
  parentesco: string;
  cpfDoResponsavel: string;
}

const INICIAL: Campos = {
  nome: '',
  cpf: '',
  rg: '',
  dataNascimento: '',
  genero: '',
  peso: '',
  altura: '',
  historicoMedico: '',
  patologia: '',
  cid: '',
  tratamentoTipo: '',
  hospitalProximo: '',
  homeCare: '',
  possuiPlanoSaude: '',
  planoSaude: '',
  rendaFamilia: '',
  comoConheceu: '',
  temAdvogado: '',
  nomeAdvogado: '',
  processoJudicializacao: '',
  parentesco: PARENTESCOS_SUGERIDOS[0],
  cpfDoResponsavel: '',
};

/**
 * O cadastro do dependente — os MESMOS campos do cadastro administrativo (`/admin/pacientes/novo`), por
 * pedido de Dryelle (29/10/2026), SEM os campos internos da associação (valor de contribuição, termo, etapa,
 * categorização…) e sem e-mail e telefone do dependente (ele não tem; o contato é o do responsável).
 *
 * As regras são as do SERVIDOR (`lib/dependentes/ficha-do-dependente.ts`, que parte do mesmo schema do cadastro
 * da equipe). O que há aqui é só conforto de quem preenche: o servidor valida TUDO de novo e descarta o que não
 * conhece.
 */
export function FormularioDeDependente() {
  const router = useRouter();
  const [c, setC] = useState<Campos>(INICIAL);
  const [endereco, setEndereco] = useState<ValoresDeEndereco | null>(null);
  const [enviando, setEnviando] = useState(false);

  const hoje = new Date().toISOString().slice(0, 10);
  const set = (campo: keyof Campos) => (valor: string) =>
    setC((atual) => ({ ...atual, [campo]: valor }));
  const input = (campo: keyof Campos) => ({
    value: c[campo],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(campo)(e.target.value),
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const res = await cadastrarDependente({
      ...c,
      cep: endereco?.cep || undefined,
      endereco: endereco?.endereco || undefined,
      cidade: endereco?.cidade || undefined,
      uf: endereco?.uf || undefined,
    });
    setEnviando(false);

    if (!res.sucesso) {
      toast.error(res.erro ?? 'Não foi possível cadastrar o dependente.');
      return;
    }
    toast.success('Dependente cadastrado.');
    router.push(caminhoDoDependente(res.dados!.pacienteId));
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="space-y-6">
      <Card className="border-border/50 rounded-[1.75rem] shadow-sm">
        <CardHeader className="border-border/30 border-b pb-4">
          <CardTitle className="font-display text-lg">Dados pessoais do dependente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="d-nome">Nome completo *</Label>
            <Input
              id="d-nome"
              required
              minLength={2}
              maxLength={120}
              className="h-10 rounded-xl"
              {...input('nome')}
            />
          </div>
          <div>
            <Label htmlFor="d-nasc">Data de nascimento *</Label>
            <Input
              id="d-nasc"
              type="date"
              required
              min="1900-01-01"
              max={hoje}
              className="h-10 rounded-xl"
              {...input('dataNascimento')}
            />
          </div>
          <div>
            <Label htmlFor="d-genero">Gênero</Label>
            <select id="d-genero" className={CAMPO_SELECT} {...input('genero')}>
              <option value="">Selecione</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outro">Outro</option>
              <option value="nao_informado">Prefiro não informar</option>
            </select>
          </div>
          <div>
            <Label htmlFor="d-cpf">CPF do dependente</Label>
            <Input
              id="d-cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              className="h-10 rounded-xl"
              value={c.cpf}
              onChange={(e) => set('cpf')(mascaraCpf(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="d-rg">RG</Label>
            <Input
              id="d-rg"
              placeholder="00.000.000-0"
              className="h-10 rounded-xl"
              {...input('rg')}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 rounded-[1.75rem] shadow-sm">
        <CardHeader className="border-border/30 border-b pb-4">
          <CardTitle className="font-display text-lg">Endereço</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <CepRapido modoControlado aoMudarValores={setEndereco} />
        </CardContent>
      </Card>

      <Card className="border-border/50 rounded-[1.75rem] shadow-sm">
        <CardHeader className="border-border/30 border-b pb-4">
          <CardTitle className="font-display text-lg">Dados clínicos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="d-peso">Peso (kg)</Label>
            <Input id="d-peso" placeholder="70" className="h-10 rounded-xl" {...input('peso')} />
          </div>
          <div>
            <Label htmlFor="d-altura">Altura (cm)</Label>
            <Input
              id="d-altura"
              placeholder="170"
              className="h-10 rounded-xl"
              {...input('altura')}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="d-hist">Histórico médico</Label>
            <Textarea
              id="d-hist"
              rows={3}
              placeholder="Doenças pré-existentes, cirurgias, alergias..."
              {...input('historicoMedico')}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="d-pat">Patologia</Label>
            <Textarea
              id="d-pat"
              rows={3}
              placeholder="Diagnóstico e condições clínicas relevantes..."
              {...input('patologia')}
            />
          </div>
          <div>
            <Label htmlFor="d-cid">CID</Label>
            <Input
              id="d-cid"
              placeholder="Ex: F32.0"
              className="h-10 rounded-xl"
              {...input('cid')}
            />
          </div>
          <div>
            <Label htmlFor="d-trat">Tipo de tratamento</Label>
            <select id="d-trat" className={CAMPO_SELECT} {...input('tratamentoTipo')}>
              <option value="">Selecione</option>
              <option value="cbd">CBD</option>
              <option value="thc">THC</option>
              <option value="cbd_thc">CBD + THC</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 rounded-[1.75rem] shadow-sm">
        <CardHeader className="border-border/30 border-b pb-4">
          <CardTitle className="font-display text-lg">Atendimento e plano de saúde</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="d-hosp">Hospital mais próximo</Label>
            <Input
              id="d-hosp"
              placeholder="Nome e endereço do hospital"
              className="h-10 rounded-xl"
              {...input('hospitalProximo')}
            />
          </div>
          <div>
            <Label htmlFor="d-home">Em Home Care?</Label>
            <select id="d-home" className={CAMPO_SELECT} {...input('homeCare')}>
              {SIM_NAO.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="d-possui">Possui plano de saúde?</Label>
            <select
              id="d-possui"
              className={CAMPO_SELECT}
              value={c.possuiPlanoSaude}
              onChange={(e) => {
                set('possuiPlanoSaude')(e.target.value);
                if (e.target.value === 'nao') set('planoSaude')('');
              }}
            >
              {SIM_NAO.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </div>
          {c.possuiPlanoSaude === 'sim' && (
            <div className="sm:col-span-2">
              <Label htmlFor="d-plano">Qual o plano de saúde?</Label>
              <Input
                id="d-plano"
                placeholder="Nome do plano de saúde"
                className="h-10 rounded-xl"
                {...input('planoSaude')}
              />
            </div>
          )}
          <div>
            <Label htmlFor="d-renda">Renda da família</Label>
            <Input
              id="d-renda"
              placeholder="Faixa de renda familiar"
              className="h-10 rounded-xl"
              {...input('rendaFamilia')}
            />
          </div>
          <div>
            <Label htmlFor="d-como">Como conheceu a BeHemp?</Label>
            <Input
              id="d-como"
              placeholder="Indicação, redes sociais..."
              className="h-10 rounded-xl"
              {...input('comoConheceu')}
            />
          </div>
          <div>
            <Label htmlFor="d-adv">Possui advogado?</Label>
            <select
              id="d-adv"
              className={CAMPO_SELECT}
              value={c.temAdvogado}
              onChange={(e) => {
                set('temAdvogado')(e.target.value);
                if (e.target.value === 'nao') set('nomeAdvogado')('');
              }}
            >
              {SIM_NAO.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </div>
          {c.temAdvogado === 'sim' && (
            <div>
              <Label htmlFor="d-nadv">Nome do advogado</Label>
              <Input
                id="d-nadv"
                placeholder="Nome completo do advogado"
                className="h-10 rounded-xl"
                {...input('nomeAdvogado')}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label htmlFor="d-proc">Processo de judicialização</Label>
            <Textarea
              id="d-proc"
              rows={2}
              placeholder="Descreva o processo de judicialização, se houver..."
              {...input('processoJudicializacao')}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 rounded-[1.75rem] shadow-sm">
        <CardHeader className="border-border/30 border-b pb-4">
          <CardTitle className="font-display text-lg">Você, o responsável</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="d-par">Seu parentesco *</Label>
            <select id="d-par" className={CAMPO_SELECT} {...input('parentesco')}>
              {PARENTESCOS_SUGERIDOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="d-cpfr">Seu CPF *</Label>
            <Input
              id="d-cpfr"
              required
              inputMode="numeric"
              placeholder="000.000.000-00"
              className="h-10 rounded-xl"
              value={c.cpfDoResponsavel}
              onChange={(e) => set('cpfDoResponsavel')(mascaraCpf(e.target.value))}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              O CPF é o seu, não o do dependente. Só é usado na documentação do atendimento.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={enviando}
          className="h-11 rounded-full px-8 text-sm font-semibold"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cadastrar dependente'}
        </Button>
      </div>
    </form>
  );
}
