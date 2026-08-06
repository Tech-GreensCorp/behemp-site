import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { procuracoesEspecificas, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, FileText, Download, CheckCircle2, Clock, AlertCircle, Send } from 'lucide-react';

type DocuSignStatus = 'nao_enviado' | 'enviado' | 'visualizado' | 'assinado' | 'concluido' | 'recusado' | 'expirado' | 'erro';

const STATUS_BADGE: Record<DocuSignStatus, { label: string; className: string; icon: React.ReactNode }> = {
  nao_enviado: { label: 'Pendente', className: 'bg-muted text-muted-foreground', icon: <Clock className="h-3 w-3" /> },
  enviado: { label: 'Enviado', className: 'bg-blue-100 text-blue-700', icon: <Send className="h-3 w-3" /> },
  visualizado: { label: 'Visualizado', className: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-3 w-3" /> },
  assinado: { label: 'Assinado', className: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800 font-bold', icon: <CheckCircle2 className="h-3 w-3" /> },
  recusado: { label: 'Recusado', className: 'bg-red-100 text-red-700', icon: <AlertCircle className="h-3 w-3" /> },
  expirado: { label: 'Expirado', className: 'bg-orange-100 text-orange-700', icon: <AlertCircle className="h-3 w-3" /> },
  erro: { label: 'Erro', className: 'bg-red-100 text-red-700', icon: <AlertCircle className="h-3 w-3" /> },
};

export default async function AdminProcuracoesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/entrar');

  // Validar se é admin
  const [currentUser] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (currentUser?.role !== 'admin') redirect('/admin');

  // Buscar todas as procurações geradas
  const procuracoes = await db
    .select({
      id: procuracoesEspecificas.id,
      nomeCompleto: procuracoesEspecificas.nomeCompleto,
      email: procuracoesEspecificas.email,
      cpf: procuracoesEspecificas.cpf,
      status: procuracoesEspecificas.docusignStatus,
      stubAtivo: procuracoesEspecificas.stubAtivo,
      urlPdfGerado: procuracoesEspecificas.urlPdfGerado,
      urlPdfAssinado: procuracoesEspecificas.urlPdfAssinado,
      criadoEm: procuracoesEspecificas.createdAt,
      assinadoEm: procuracoesEspecificas.assinadoEm,
    })
    .from(procuracoesEspecificas)
    .orderBy(desc(procuracoesEspecificas.createdAt));

  const totalConcluidas = procuracoes.filter(p => p.status === 'concluido').length;
  const totalPendentes = procuracoes.length - totalConcluidas;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Procurações Específicas</h1>
          <p className="text-muted-foreground mt-1">Gerencie as assinaturas digitais dos pacientes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-secondary/5 border-secondary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-display font-bold">{totalPendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                <p className="text-3xl font-display font-bold">{totalConcluidas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Data Geração</th>
                <th className="px-6 py-4">Status DocuSign</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {procuracoes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhuma Procuração Específica encontrada.
                  </td>
                </tr>
              ) : (
                procuracoes.map((proc) => {
                  const badge = STATUS_BADGE[proc.status as DocuSignStatus] ?? STATUS_BADGE.nao_enviado;
                  
                  return (
                    <tr key={proc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{proc.nomeCompleto}</p>
                        <p className="text-xs text-muted-foreground">{proc.email} • CPF: {proc.cpf}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-foreground">{format(proc.criadoEm, "dd/MM/yyyy", { locale: ptBR })}</p>
                        <p className="text-xs text-muted-foreground">{format(proc.criadoEm, "HH:mm", { locale: ptBR })}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <Badge className={badge.className + " gap-1"}>
                            {badge.icon}
                            {proc.stubAtivo && proc.status === 'nao_enviado' ? 'Em configuração' : badge.label}
                          </Badge>
                          {proc.stubAtivo && (
                            <span className="text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded font-medium">STUB</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {proc.urlPdfGerado && (
                            <a 
                              href={proc.urlPdfGerado} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              PDF Original
                            </a>
                          )}
                          {proc.urlPdfAssinado && (
                            <a 
                              href={proc.urlPdfAssinado} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              PDF Assinado
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
