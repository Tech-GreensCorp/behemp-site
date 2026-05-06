'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';
import { criarPaciente } from '@/app/_actions/pacientes';
import { toast } from 'sonner';
import Link from 'next/link';

/**
 * Página de criação de novo paciente pelo médico.
 * Formulário com validação e Server Action real.
 */
export default function NovoPacientePage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [dados, setDados] = useState({
    nome: '',
    email: '',
    telefone: '',
    dataNascimento: '',
    cpf: '',
    responsavelNome: '',
    responsavelCpf: '',
    tratamentoTipo: '' as '' | 'cbd' | 'thc' | 'cbd_thc',
    endereco: '',
  });

  function updateField(campo: string, valor: string) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);

    const resultado = await criarPaciente({
      ...dados,
      tratamentoTipo: dados.tratamentoTipo || undefined,
    });

    setSalvando(false);

    if (resultado.sucesso) {
      toast.success('Paciente criado com sucesso!');
      router.push('/medico/pacientes');
    } else {
      toast.error(resultado.erro || 'Erro ao criar paciente');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/medico/pacientes">
          <Button variant="ghost" size="icon" nativeButton={false}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Paciente</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre um novo paciente no sistema
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados pessoais */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input
                id="nome"
                value={dados.nome}
                onChange={(e) => updateField('nome', e.target.value)}
                placeholder="Nome completo do paciente"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={dados.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="paciente@email.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={dados.telefone}
                onChange={(e) => updateField('telefone', e.target.value)}
                placeholder="(11) 99999-1234"
              />
            </div>
            <div>
              <Label htmlFor="dataNascimento">Data de Nascimento</Label>
              <Input
                id="dataNascimento"
                type="date"
                value={dados.dataNascimento}
                onChange={(e) => updateField('dataNascimento', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={dados.cpf}
                onChange={(e) => updateField('cpf', e.target.value)}
                placeholder="123.456.789-00"
              />
            </div>
          </CardContent>
        </Card>

        {/* Responsável (se menor) */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Responsável (se menor de idade)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="responsavelNome">Nome do Responsável</Label>
              <Input
                id="responsavelNome"
                value={dados.responsavelNome}
                onChange={(e) => updateField('responsavelNome', e.target.value)}
                placeholder="Nome do responsável legal"
              />
            </div>
            <div>
              <Label htmlFor="responsavelCpf">CPF do Responsável</Label>
              <Input
                id="responsavelCpf"
                value={dados.responsavelCpf}
                onChange={(e) => updateField('responsavelCpf', e.target.value)}
                placeholder="123.456.789-00"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tratamento */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Tratamento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tratamentoTipo">Tipo de Tratamento</Label>
              <Select
                value={dados.tratamentoTipo}
                onValueChange={(v) => updateField('tratamentoTipo', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cbd">CBD</SelectItem>
                  <SelectItem value="thc">THC</SelectItem>
                  <SelectItem value="cbd_thc">CBD + THC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Textarea
                id="endereco"
                value={dados.endereco}
                onChange={(e) => updateField('endereco', e.target.value)}
                placeholder="Rua, número, bairro, cidade/estado"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex justify-end gap-3">
          <Link href="/medico/pacientes">
            <Button variant="outline" type="button" nativeButton={false}>
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={salvando} className="gap-2">
            {salvando ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} />
                Criar Paciente
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
