'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, UsersRound } from 'lucide-react';

import {
  listarResponsaveisAdmin,
  type ResponsavelDoAdmin,
} from '@/app/_actions/admin-responsaveis';
import { DataEmpty, DataList } from '@/components/shared/data-list';
import { PaginationBar } from '@/components/shared/pagination-bar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const POR_PAGINA_OPCOES = [10, 20, 50];

/**
 * A lista de RESPONSÁVEIS do admin, ao lado da de pacientes (pedido de Dryelle, 29/10/2026): quem responde por
 * alguém, com os dependentes de cada um (cada um abre a ficha do paciente). `versao` força nova busca (ex.: depois
 * de criar um responsável). Sem `<table>`, como o resto do produto.
 */
export function ListaDeResponsaveis({ versao }: { versao: number }) {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [responsaveis, setResponsaveis] = useState<ResponsavelDoAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaDebounced(busca);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let cancelado = false;
    listarResponsaveisAdmin({ busca: buscaDebounced || undefined, pagina, porPagina })
      .then((r) => {
        if (cancelado) return;
        if (r.sucesso && r.dados) {
          setResponsaveis(r.dados.responsaveis);
          setTotal(r.dados.total);
          setTotalPaginas(r.dados.totalPaginas);
          setErro(null);
        } else {
          setErro(r.erro ?? 'Erro ao listar responsáveis');
        }
      })
      .catch(() => !cancelado && setErro('Erro ao listar responsáveis'))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [buscaDebounced, pagina, porPagina, versao]);

  return (
    <div className="space-y-6">
      <Card className="border-border/40 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search
              size={16}
              className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
            />
            <Input
              placeholder="Buscar responsável por nome ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {carregando ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="text-primary animate-spin" />
        </div>
      ) : erro ? (
        <DataEmpty
          icon={<UsersRound size={24} />}
          title="Não foi possível carregar"
          description={erro}
        />
      ) : responsaveis.length === 0 ? (
        <DataEmpty
          icon={<UsersRound size={24} />}
          title="Nenhum responsável encontrado"
          description={
            buscaDebounced
              ? 'Tente outra busca'
              : 'Use "Novo responsável" para cadastrar o primeiro'
          }
        />
      ) : (
        <DataList>
          {responsaveis.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start">
              <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                <span className="font-heading text-secondary text-sm font-semibold">
                  {r.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-foreground truncate text-sm font-semibold">{r.nome}</p>
                  {r.papel === 'paciente' && (
                    <Badge variant="outline" className="text-[11px]">
                      Também é paciente
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {r.email}
                  {r.telefone && ` · ${r.telefone}`}
                  {r.cpfMascarado && ` · CPF ${r.cpfMascarado}`}
                </p>
                {r.dependentes.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Ainda sem dependentes cadastrados.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-muted-foreground text-xs">
                      {r.dependentes.length === 1 ? 'Dependente:' : 'Dependentes:'}
                    </span>
                    {r.dependentes.map((d) => (
                      <Link
                        key={d.pacienteId}
                        href={`/admin/pacientes/${d.pacienteId}`}
                        className="bg-secondary/10 text-secondary hover:bg-secondary/20 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors"
                      >
                        {d.nome}
                        <span className="text-muted-foreground font-normal">· {d.parentesco}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </DataList>
      )}

      {!carregando && !erro && responsaveis.length > 0 && (
        <PaginationBar
          page={pagina}
          totalPages={totalPaginas}
          onPageChange={setPagina}
          totalItems={total}
          itemLabel="responsável"
          pageSize={porPagina}
          onPageSizeChange={(n) => {
            setPorPagina(n);
            setPagina(1);
          }}
          pageSizeOptions={POR_PAGINA_OPCOES}
        />
      )}
    </div>
  );
}
