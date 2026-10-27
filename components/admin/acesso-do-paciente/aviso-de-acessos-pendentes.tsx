'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { contarAcessosPendentes, criarAcessosPendentes } from '@/app/_actions/acesso-do-paciente';

/**
 * Faixa da tela de usuários: quantos pacientes cadastrados pela equipe ainda NÃO têm login (o motivo
 * do "usuário não encontrado" ao entrar) e o botão que cria os logins, 25 por clique.
 * Some quando não há nenhum. Criar o login não envia e-mail nem define senha.
 */
export function AvisoDeAcessosPendentes({ onCriados }: { onCriados?: () => void }) {
  const [pendentes, setPendentes] = useState(0);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    let vivo = true;
    contarAcessosPendentes().then((r) => {
      if (vivo && r.sucesso && r.dados) setPendentes(r.dados.pendentes);
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function criar() {
    setCriando(true);
    try {
      const r = await criarAcessosPendentes();
      if (!r.sucesso || !r.dados) {
        toast.error(r.erro || 'Não foi possível criar os acessos');
        return;
      }
      const { criados, vinculados, falhas, restantes } = r.dados;
      toast.success(
        `${criados} acesso(s) criado(s)` +
          (vinculados ? `, ${vinculados} religado(s)` : '') +
          (falhas.length
            ? `. ${falhas.length} não puderam ser criados (e-mail inválido ou duplicado).`
            : '.'),
      );
      setPendentes(restantes);
      onCriados?.();
    } finally {
      setCriando(false);
    }
  }

  if (pendentes === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-amber-900">
        <strong>{pendentes}</strong> paciente(s) cadastrado(s) pela equipe ainda{' '}
        <strong>não têm login</strong> e não conseguem entrar (“usuário não encontrado”).
      </p>
      <Button onClick={criar} disabled={criando} size="sm">
        {criando ? (
          <Loader2 size={14} className="mr-1.5 animate-spin" />
        ) : (
          <UserPlus size={14} className="mr-1.5" />
        )}
        Criar acessos
      </Button>
    </div>
  );
}
