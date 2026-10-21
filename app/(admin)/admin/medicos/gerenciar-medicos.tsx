'use client';

/**
 * A coluna da lista e a coluna do formulário compartilham um estado — qual médico está
 * em edição —, e por isso moram no mesmo componente cliente (23/09/2026).
 *
 * 🔴 A LINHA DEIXOU DE SER UM LINK INTEIRO. Antes, `DataRow href=` embrulhava tudo num
 * `<Link>`; um botão dentro dele seria `<button>` dentro de `<a>`, que é conteúdo
 * interativo aninhado — HTML inválido, e o clique sobe para o link e navega. O padrão do
 * próprio produto para linha com ação é não ter `href`: ver
 * `app/(paciente)/paciente/documentos/page.tsx:245`, onde a linha tem "Ver" e "Baixar" e
 * nenhum `href` de linha. As duas ações ficam explícitas em `trailing`.
 */

import * as React from 'react';
import Link from 'next/link';
import type { MedicoResumo } from '@/app/_actions/admin-medicos';
import { FormMedico } from './form-criar-medico';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Pencil, Stethoscope } from 'lucide-react';
import { DataList, DataRow } from '@/components/shared/data-list';

interface GerenciarMedicosProps {
  medicos: MedicoResumo[];
  /**
   * `medicoId` → conta do Mercado Pago ativa. Vem pronto do servidor: a consulta é do
   * `obterStatus` (`lib/mercadopago/conta.ts:117`), que lê só metadado e **não decifra**.
   */
  mpConectado: Record<string, boolean>;
}

export function GerenciarMedicos({ medicos, mpConectado }: GerenciarMedicosProps) {
  const [editandoId, setEditandoId] = React.useState<string | null>(null);

  // Deriva do `medicos` em vez de guardar o objeto: depois de salvar, o `router.refresh()`
  // traz a linha nova e a edição continua apontando para o dado atual. Guardar uma cópia
  // deixaria a tela exibindo o valor velho até alguém trocar de médico.
  const emEdicao = editandoId ? (medicos.find((m) => m.medicoId === editandoId) ?? null) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Lista de médicos cadastrados */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Médicos cadastrados</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              &quot;Editar&quot; altera o perfil aqui mesmo. &quot;Ver&quot; abre detalhes,
              pacientes e agenda.
            </p>
          </div>
          <Badge variant="secondary">{medicos.length}</Badge>
        </CardHeader>
        <CardContent>
          {medicos.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Nenhum médico cadastrado.
            </p>
          ) : (
            <DataList className="border-border/50">
              {medicos.map((m) => (
                <DataRow
                  key={m.medicoId}
                  className={m.medicoId === editandoId ? 'bg-primary-soft/40' : undefined}
                  icon={
                    m.avatarUrl ? (
                      <img
                        src={m.avatarUrl}
                        alt={m.nome}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <Stethoscope size={20} className="text-violet-600" />
                    )
                  }
                  title={m.nome}
                  subtitle={
                    <>
                      {m.especialidade}
                      {m.crm && <span className="text-primary ml-1.5 font-medium">{m.crm}</span>}
                      {m.valorConsulta !== null && (
                        <span className="ml-1.5">
                          ·{' '}
                          {m.valorConsulta.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      )}
                    </>
                  }
                  meta={`${m.totalPacientes} paciente${m.totalPacientes !== 1 ? 's' : ''}`}
                  trailing={
                    <>
                      {/*
                        O selo diz se o médico consegue RECEBER. Sem conta conectada o
                        agendamento pode estar bloqueado (`lib/mercadopago/conta.ts:110`),
                        e o admin não tinha como ver isso desta tela.
                      */}
                      <Badge
                        variant="outline"
                        className={
                          mpConectado[m.medicoId]
                            ? 'shrink-0 border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700'
                            : 'shrink-0 border-amber-300 bg-amber-50 text-[10px] text-amber-700'
                        }
                      >
                        {mpConectado[m.medicoId] ? 'MP conectado' : 'MP pendente'}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-full text-xs"
                        onClick={() =>
                          setEditandoId((atual) => (atual === m.medicoId ? null : m.medicoId))
                        }
                      >
                        <Pencil size={13} />
                        {m.medicoId === editandoId ? 'Editando' : 'Editar'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 rounded-full text-xs"
                        render={<Link href={`/admin/medicos/${m.medicoId}`} />}
                      >
                        Ver
                        <ChevronRight size={14} />
                      </Button>
                    </>
                  }
                />
              ))}
            </DataList>
          )}
        </CardContent>
      </Card>

      {/*
        A `key` remonta o formulário ao trocar de médico (e ao sair da edição). Os campos
        são não-controlados, com `defaultValue` — sem remontar, o React manteria na tela os
        valores do médico anterior, que é a forma mais rápida de gravar dado na ficha errada.
      */}
      <FormMedico
        key={emEdicao?.medicoId ?? 'novo'}
        medico={emEdicao ?? undefined}
        aoCancelar={() => setEditandoId(null)}
      />
    </div>
  );
}
