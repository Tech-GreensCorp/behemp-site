'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface MedicoCardProps {
  nome: string;
  avatarUrl: string | null;
  especialidade: string;
  crm?: string | null;
  email?: string;
  valorConsulta?: string;
  curriculo?: string[];
  destaque?: boolean;
}

export function MedicoCard({
  nome,
  avatarUrl,
  especialidade,
  crm,
  email,
  valorConsulta,
  curriculo,
  destaque = false,
}: MedicoCardProps) {
  const iniciais = nome
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <Card className={cn(
      "bg-card border-0 shadow-sm transition-all hover:shadow-md relative overflow-hidden h-full w-full",
      destaque && "border-2 border-primary/20 shadow-md"
    )}>
      <CardContent className="flex flex-col items-center p-5 text-center h-full justify-between min-h-[160px]">
        {destaque && (
          <span className="absolute top-3 right-3 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
            Destaque
          </span>
        )}
        
        <div className="flex flex-col items-center w-full">
          {avatarUrl ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-primary/10">
              <Image
                src={avatarUrl}
                alt={nome}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          ) : (
            <div className="gradient-moss flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white">
              {iniciais}
            </div>
          )}
          <h3 className="mt-3 text-sm font-semibold">{nome}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">{especialidade}</p>
          {crm && (
            <p className="text-primary mt-1.5 text-xs font-semibold tracking-wide">
              {crm.startsWith('CRM') || crm.startsWith('CRO') ? crm : `CRM ${crm}`}
            </p>
          )}
        </div>

        {curriculo && curriculo.length > 0 ? (
          <Dialog>
            <DialogTrigger render={
              <Button variant="outline" size="sm" className="mt-3 btn-pill text-[10px] border-primary/30 text-secondary h-7">
                Ver Currículo
              </Button>
            } />
            <DialogContent className="p-5 sm:max-w-xl sm:p-7 max-h-[85vh] overflow-y-auto flex flex-col justify-between">
              <div>
                <DialogTitle className="font-display text-2xl font-bold mb-4">
                  {nome}
                </DialogTitle>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">{especialidade}</p>
                    {email && <p className="text-xs text-muted-foreground mt-1">E-mail: {email}</p>}
                    {valorConsulta && <p className="text-xs text-muted-foreground">Consulta: {valorConsulta}</p>}
                  </div>
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-semibold mb-2">Mini Currículo:</h4>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                      {curriculo.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end border-t border-border pt-4">
                <DialogClose render={
                  <Button variant="outline" size="sm" className="btn-pill text-xs">Fechar</Button>
                } />
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="h-[28px]" /> /* spacer to match the card height */
        )}
      </CardContent>
    </Card>
  );
}
