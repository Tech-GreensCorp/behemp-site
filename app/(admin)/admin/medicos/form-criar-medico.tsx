'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { criarMedico } from '@/app/_actions/admin-medicos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Stethoscope, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type Estado =
  | { tipo: 'idle' }
  | { tipo: 'carregando' }
  | { tipo: 'sucesso'; medicoId: string }
  | { tipo: 'erro'; mensagem: string };

export function FormCriarMedico() {
  const router = useRouter();
  const [estado, setEstado] = React.useState<Estado>({ tipo: 'idle' });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEstado({ tipo: 'carregando' });

    const form = e.currentTarget;
    const data = new FormData(form);

    const ordemStr = data.get('ordem') as string;

    const resultado = await criarMedico({
      email: (data.get('email') as string).trim().toLowerCase(),
      especialidade: (data.get('especialidade') as string).trim(),
      crm: (data.get('crm') as string).trim() || undefined,
      bio: (data.get('bio') as string).trim() || undefined,
      ordem: ordemStr ? parseInt(ordemStr, 10) : undefined,
    });

    if (resultado.sucesso && resultado.dados) {
      setEstado({ tipo: 'sucesso', medicoId: resultado.dados.medicoId });
      form.reset();
      // Redireciona para a página do médico após 1.5s
      setTimeout(() => {
        router.push(`/admin/medicos/${resultado.dados!.medicoId}`);
        router.refresh();
      }, 1500);
    } else {
      setEstado({ tipo: 'erro', mensagem: resultado.erro ?? 'Erro desconhecido' });
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
            <Stethoscope size={20} className="text-violet-600" />
          </div>
          <div>
            <CardTitle className="text-base">Cadastrar novo médico</CardTitle>
            <CardDescription className="text-xs">
              O usuário precisa ter conta criada no sistema. O e-mail deve corresponder ao cadastro
              existente.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* E-mail */}
          <div className="space-y-1.5">
            <Label htmlFor="email">
              E-mail do usuário <span className="text-primary">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="medico@exemplo.com"
              required
              disabled={estado.tipo === 'carregando'}
            />
            <p className="text-muted-foreground text-xs">
              O e-mail deve corresponder a um usuário já cadastrado no sistema.
            </p>
          </div>

          {/* Especialidade */}
          <div className="space-y-1.5">
            <Label htmlFor="especialidade">
              Especialidade <span className="text-primary">*</span>
            </Label>
            <Input
              id="especialidade"
              name="especialidade"
              placeholder="Ex: Neurologia, Clínico Geral, Medicina Endocanabinóide"
              required
              disabled={estado.tipo === 'carregando'}
            />
          </div>

          {/* CRM e Ordem */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="crm">CRM</Label>
              <Input
                id="crm"
                name="crm"
                placeholder="Ex: CRM/SP 123456"
                disabled={estado.tipo === 'carregando'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ordem">Ordem de exibição</Label>
              <Input
                id="ordem"
                name="ordem"
                type="number"
                min={1}
                placeholder="Ex: 1, 2, 3..."
                disabled={estado.tipo === 'carregando'}
              />
              <p className="text-muted-foreground text-xs">
                Determina a ordem na homepage.
              </p>
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label htmlFor="bio">Biografia (opcional)</Label>
            <Textarea
              id="bio"
              name="bio"
              placeholder="Breve apresentação do médico..."
              rows={3}
              disabled={estado.tipo === 'carregando'}
            />
          </div>

          {/* Feedback de estado */}
          {estado.tipo === 'erro' && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{estado.mensagem}</span>
            </div>
          )}

          {estado.tipo === 'sucesso' && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Médico cadastrado com sucesso! Redirecionando...</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={estado.tipo === 'carregando' || estado.tipo === 'sucesso'}
            className="w-full gap-2"
          >
            {estado.tipo === 'carregando' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Cadastrando...
              </>
            ) : (
              <>
                <Stethoscope size={16} />
                Cadastrar médico
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
