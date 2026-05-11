'use client';

import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Camera,
  Mail,
  Smartphone,
  User,
} from 'lucide-react';
/**
 * Página de perfil do paciente.
 * Mostra dados do Clerk e permite edição básica.
 */
export default function PerfilPacientePage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize e gerencie suas informações pessoais
        </p>
      </div>

      {/* Card do perfil */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            {/* Avatar */}
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={40} className="text-primary" />
                )}
              </div>
              <button className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105">
                <Camera size={14} />
              </button>
            </div>

            {/* Dados */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">Paciente</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações de contato */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Informações de Contato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Mail size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm font-medium">
                  {user?.emailAddresses[0]?.emailAddress || 'Não informado'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Smartphone size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="text-sm font-medium">
                  {user?.phoneNumbers?.[0]?.phoneNumber || 'Não informado'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados clínicos — vinculados ao banco */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Dados Clínicos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seus dados clínicos são gerenciados pelo seu médico responsável.
            Para alterações, entre em contato com a equipe médica.
          </p>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => window.open('https://accounts.clerk.dev/user', '_blank')}
        >
          Gerenciar conta
        </Button>
      </div>
    </div>
  );
}
