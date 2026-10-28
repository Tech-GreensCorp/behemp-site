'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { cadastrarDependente } from '@/app/_actions/dependentes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PARENTESCOS_SUGERIDOS } from '@/lib/dependentes/regras';

const CAMPO_SELECT =
  'h-10 w-full rounded-xl border border-border/60 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

/** `AAAA-MM-DD`: de 1900 até hoje. O dependente pode ter qualquer idade; o servidor valida de novo. */
function limitesDaData() {
  const max = new Date().toISOString().slice(0, 10);
  return { min: '1900-01-01', max };
}

function mascararCpfDigitado(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Cadastro de um dependente (ADR-0033 D-09). O servidor valida TUDO de novo (data de nascimento válida, CPF): os
 * limites do campo de data e a máscara do CPF são só conforto de quem preenche.
 */
export function FormularioDeDependente() {
  const router = useRouter();
  const { min, max } = limitesDaData();
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [parentesco, setParentesco] = useState<string>(PARENTESCOS_SUGERIDOS[0]);
  const [cpf, setCpf] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const res = await cadastrarDependente({
      nome,
      dataNascimento,
      parentesco,
      cpfDoResponsavel: cpf,
    });
    setEnviando(false);

    if (!res.sucesso) {
      toast.error(res.erro ?? 'Não foi possível cadastrar o dependente.');
      return;
    }
    toast.success('Dependente cadastrado.');
    setNome('');
    setDataNascimento('');
    setCpf('');
    router.refresh();
  }

  return (
    <Card className="border-border/50 rounded-[1.75rem] shadow-sm">
      <CardContent className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-2xl">
            <UserPlus className="text-primary h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-foreground text-lg font-bold">Cadastrar dependente</h2>
            <p className="text-muted-foreground text-xs">
              Para quem está sob a sua responsabilidade, de qualquer idade.
            </p>
          </div>
        </div>

        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="dependente-nome">Nome completo do dependente</Label>
            <Input
              id="dependente-nome"
              required
              minLength={2}
              maxLength={120}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="dependente-nascimento">Data de nascimento</Label>
            <Input
              id="dependente-nascimento"
              type="date"
              required
              min={min}
              max={max}
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="dependente-parentesco">Seu parentesco</Label>
            <select
              id="dependente-parentesco"
              value={parentesco}
              onChange={(e) => setParentesco(e.target.value)}
              className={CAMPO_SELECT}
            >
              {PARENTESCOS_SUGERIDOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="dependente-cpf">Seu CPF (o do responsável)</Label>
            <Input
              id="dependente-cpf"
              required
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(mascararCpfDigitado(e.target.value))}
              className="h-10 rounded-xl"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              O CPF é o seu, não o da criança. Ele só é usado na documentação do atendimento.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={enviando}
              className="h-10 w-full rounded-full px-6 text-xs font-semibold sm:w-auto"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cadastrar dependente'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
