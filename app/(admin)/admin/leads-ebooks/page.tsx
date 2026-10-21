'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listarLeadsEbook } from '@/app/(public)/_actions/ebooks';
import { toast } from 'sonner';
import {
  Mail,
  Phone,
  Search,
  BookOpen,
  Copy,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';

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
      <PageHeader
        eyebrow="Mensagens"
        title="Leads"
        description={`${leads.length} lead${leads.length !== 1 ? 's' : ''} capturado${leads.length !== 1 ? 's' : ''} no total`}
        actions={
          filteredLeads.length > 0 && (
            <Button onClick={handleCopiarEmails} variant="outline" className="gap-2">
              <Copy size={16} />
              Copiar Todos os E-mails
            </Button>
          )
        }
      />

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

      {/* Lista */}
      {filteredLeads.length === 0 ? (
        <DataEmpty
          icon={<BookOpen size={24} />}
          title="Nenhum lead encontrado"
          description={busca ? 'Tente ajustar os termos de busca.' : 'Os leads capturados no download de ebooks aparecerão aqui.'}
        />
      ) : (
        <DataList>
          {filteredLeads.map((lead) => (
            <DataRow
              key={lead.id}
              title={lead.nome}
              subtitle={
                <>
                  <Mail size={11} className="mr-1 inline" />
                  {lead.email} · <Phone size={11} className="mx-1 inline" />
                  {lead.telefone}
                </>
              }
              meta={
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary">
                    <BookOpen size={11} />
                    {lead.ebookTitle}
                  </span>
                  <div className="mt-1">
                    {new Date(lead.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </>
              }
              trailing={
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
              }
            />
          ))}
        </DataList>
      )}
    </div>
  );
}
