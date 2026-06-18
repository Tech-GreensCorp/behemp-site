'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listarLeadsEbook } from '@/app/(public)/_actions/ebooks';
import { toast } from 'sonner';
import {
  Calendar,
  Mail,
  Phone,
  Search,
  BookOpen,
  Copy,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface LeadEbook {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  ebookId: string;
  ebookTitle: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function LeadsEbooksAdminPage() {
  const [leads, setLeads] = useState<LeadEbook[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    carregarLeads();
  }, []);

  async function carregarLeads() {
    try {
      const resultado = await listarLeadsEbook();
      if (resultado.sucesso && resultado.dados) {
        setLeads(resultado.dados as unknown as LeadEbook[]);
      } else {
        toast.error(resultado.erro || 'Erro ao carregar leads');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar leads');
    } finally {
      setCarregando(false);
    }
  }

  const handleCopiarEmails = () => {
    const emails = filteredLeads.map((l) => l.email).join(', ');
    navigator.clipboard.writeText(emails);
    toast.success('E-mails copiados para a área de transferência!');
  };

  const formatWhatsAppLink = (tel: string) => {
    const clean = tel.replace(/\D/g, '');
    return `https://wa.me/55${clean}`;
  };

  const filteredLeads = leads.filter((lead) => {
    const term = busca.toLowerCase();
    return (
      lead.nome.toLowerCase().includes(term) ||
      lead.email.toLowerCase().includes(term) ||
      lead.telefone.includes(term) ||
      lead.ebookTitle.toLowerCase().includes(term)
    );
  });

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2D4F3C]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-secondary">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} capturado{leads.length !== 1 ? 's' : ''} no total
          </p>
        </div>
        
        {filteredLeads.length > 0 && (
          <Button
            onClick={handleCopiarEmails}
            variant="outline"
            className="gap-2 border-[#2D4F3C]/40 text-[#2D4F3C] hover:bg-[#2D4F3C] hover:text-white"
          >
            <Copy size={16} />
            Copiar Todos os E-mails
          </Button>
        )}
      </div>

      {/* Busca */}
      <div className="relative max-w-md bg-white border border-border rounded-xl">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          type="text"
          placeholder="Buscar lead por nome, e-mail ou ebook..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full h-10 border-0 bg-transparent pl-10 pr-4 text-sm text-foreground focus:ring-0 outline-none"
        />
      </div>

      {/* Lista/Tabela */}
      {filteredLeads.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen size={48} className="mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">Nenhum lead encontrado</p>
            <p className="text-sm text-muted-foreground">
              {busca ? 'Tente ajustar os termos de busca.' : 'Os leads capturados no download de ebooks aparecerão aqui.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-muted/20 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3">Nome</th>
                    <th className="px-6 py-3">Contato</th>
                    <th className="px-6 py-3">Ebook Baixado</th>
                    <th className="px-6 py-3">Data de Captura</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="transition-colors hover:bg-muted/10">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {lead.nome}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Mail size={13} className="text-muted-foreground/60" />
                          <span className="select-all">{lead.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone size={13} className="text-muted-foreground/60" />
                          <span>{lead.telefone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary">
                          <BookOpen size={12} />
                          {lead.ebookTitle}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-muted-foreground/60" />
                          <span>
                            {new Date(lead.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a
                          href={formatWhatsAppLink(lead.telefone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Falar no WhatsApp"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                          WhatsApp
                          <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
