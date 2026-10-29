import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  FileText,
  IdCard,
  PackagePlus,
  Pill,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { RecompraDoDependente, ResumoDoDependente } from '@/lib/dependentes/leituras';
import {
  LABEL_ANVISA,
  LABEL_CONSULTA,
  LABEL_RECOMPRA,
  LABEL_STATUS_DO_PACIENTE,
  caminhoDoDependente,
  formatarDataISO,
  formatarDiaPorExtenso,
  formatarHora,
  primeiroNome,
} from '@/lib/dependentes/rotulos';

/**
 * Os blocos do painel de UM dependente na página inicial do responsável (ADR-0033). Só apresentação: recebem o que
 * a página já leu depois de provar o vínculo, e todo texto diz DE QUEM é pelo primeiro nome. Nada é somado entre
 * dependentes.
 */

const CARTAO = 'border-border/20 grain overflow-hidden rounded-[1.75rem] border bg-white shadow-sm';

function Icone({ icone: I }: { icone: LucideIcon }) {
  return (
    <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl">
      <I className="h-4.5 w-4.5" />
    </div>
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '?';
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}

/** Quem é o dependente: avatar, nome, parentesco, idade, situação e o caminho para a ficha. */
export function CabecalhoDoPainel({
  pacienteId,
  nome,
  parentesco,
  idade,
  status,
}: {
  pacienteId: string;
  nome: string;
  parentesco: string;
  idade: number | null;
  status: string;
}) {
  return (
    <Card className={CARTAO}>
      <CardContent className="flex flex-wrap items-center gap-4 p-5">
        <div className="bg-primary text-primary-foreground font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold">
          {iniciais(nome)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-foreground truncate text-xl font-bold">{nome}</h2>
          <p className="text-muted-foreground text-sm">
            {parentesco}
            {idade !== null && ` · ${idade} ${idade === 1 ? 'ano' : 'anos'}`}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[11px] font-bold">
          {LABEL_STATUS_DO_PACIENTE[status] ?? status}
        </Badge>
        <Link
          href={caminhoDoDependente(pacienteId)}
          className="text-primary hover:text-primary/80 flex shrink-0 items-center gap-1 text-sm font-semibold"
        >
          Abrir ficha <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

/** A próxima consulta em destaque: o dia por extenso, a hora e o médico. */
export function CartaoDaProximaConsulta({
  pacienteId,
  nome,
  consulta,
}: {
  pacienteId: string;
  nome: string;
  consulta: ResumoDoDependente['proximaConsulta'];
}) {
  return (
    <Card className={CARTAO}>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <Icone icone={CalendarDays} />
          <h3 className="font-display text-foreground text-base font-bold">Próxima consulta</h3>
        </div>

        {consulta ? (
          <div className="flex-1 space-y-1">
            <p className="font-display text-foreground text-2xl leading-tight font-bold first-letter:uppercase">
              {formatarDiaPorExtenso(consulta.dataHora)}
            </p>
            <p className="text-primary text-lg font-bold">às {formatarHora(consulta.dataHora)}</p>
            <p className="text-muted-foreground text-sm">com {consulta.medicoNome}</p>
            <Badge variant="secondary" className="mt-1 text-[11px] font-bold">
              {LABEL_CONSULTA[consulta.status] ?? consulta.status}
            </Badge>
          </div>
        ) : (
          <p className="text-muted-foreground flex-1 text-sm leading-relaxed">
            Nenhuma consulta agendada para {primeiroNome(nome)} no momento.
          </p>
        )}

        <Link
          href={caminhoDoDependente(pacienteId, '/consultas')}
          className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm font-semibold"
        >
          Ver consultas <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

function CartaoDeAcompanhamento({
  icone,
  titulo,
  valor,
  linhas,
  href,
  acao,
}: {
  icone: LucideIcon;
  titulo: string;
  valor: string;
  linhas: Array<string | null | undefined>;
  href?: string;
  acao?: string;
}) {
  const detalhes = linhas.filter((l): l is string => !!l);
  return (
    <Card className={CARTAO}>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <Icone icone={icone} />
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            {titulo}
          </p>
        </div>
        <div className="flex-1 space-y-1">
          <p className="font-display text-foreground text-lg leading-snug font-bold wrap-break-word">
            {valor}
          </p>
          {detalhes.map((l) => (
            <p key={l} className="text-muted-foreground text-xs wrap-break-word">
              {l}
            </p>
          ))}
        </div>
        {href && acao && (
          <Link
            href={href}
            className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-semibold"
          >
            {acao} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

/** Medicamento atual, documentos e autorização ANVISA, cada um com o detalhe e o caminho para a seção. */
export function CartoesDeAcompanhamento({
  pacienteId,
  resumo,
}: {
  pacienteId: string;
  resumo: ResumoDoDependente;
}) {
  const med = resumo.medicamentoAtivo;
  const anv = resumo.autorizacaoAnvisa;
  const docs = resumo.totalDocumentos;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <CartaoDeAcompanhamento
        icone={Pill}
        titulo="Medicamento atual"
        valor={med ? med.tipoCanabinoide : 'Nenhum registrado'}
        linhas={
          med
            ? [
                `${med.novaDosagem} · ${med.frequencia}`,
                med.proximaRevisao ? `Revisão em ${formatarDataISO(med.proximaRevisao)}` : null,
              ]
            : ['O médico registra o medicamento depois da consulta.']
        }
        href={caminhoDoDependente(pacienteId, '/medicamentos')}
        acao="Ver medicamentos"
      />
      <CartaoDeAcompanhamento
        icone={FileText}
        titulo="Documentos"
        valor={`${docs} ${docs === 1 ? 'documento' : 'documentos'}`}
        linhas={[docs === 0 ? 'Nenhum documento enviado ainda.' : 'Enviados para este cadastro.']}
        href={caminhoDoDependente(pacienteId, '/documentos')}
        acao="Ver documentos"
      />
      <CartaoDeAcompanhamento
        icone={ShieldCheck}
        titulo="Autorização ANVISA"
        valor={anv ? (LABEL_ANVISA[anv.status] ?? anv.status) : 'Sem solicitação'}
        linhas={[anv?.dataValidade ? `Válida até ${formatarDataISO(anv.dataValidade)}` : null]}
      />
    </div>
  );
}

/** As últimas solicitações de recompra DESTE dependente (a página manda no máximo três). */
export function SolicitacoesRecentes({
  pacienteId,
  nome,
  recompras,
}: {
  pacienteId: string;
  nome: string;
  recompras: RecompraDoDependente[];
}) {
  const href = caminhoDoDependente(pacienteId, '/solicitacoes');
  return (
    <Card className={CARTAO}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Icone icone={PackagePlus} />
            <h3 className="font-display text-foreground text-base font-bold">
              Solicitações de {primeiroNome(nome)}
            </h3>
          </div>
          <Link
            href={href}
            className="text-primary hover:text-primary/80 flex shrink-0 items-center gap-1 text-sm font-semibold"
          >
            {recompras.length === 0 ? 'Pedir recompra' : 'Ver todas'}{' '}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {recompras.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma solicitação para {primeiroNome(nome)} até agora.
          </p>
        ) : (
          <ul className="divide-border/40 divide-y">
            {recompras.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-semibold">
                    {r.medicamentoNome ?? 'Medicamento'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {r.mlFrasco ? `${r.mlFrasco} ml · ` : ''}previsão{' '}
                    {formatarDataISO(r.dataPrevista)}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[11px] font-bold">
                  {LABEL_RECOMPRA[r.status] ?? r.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Atalhos para as seções de UM dependente: os links levam o id dele. */
export function AtalhosDoDependente({ pacienteId, nome }: { pacienteId: string; nome: string }) {
  const atalhos: Array<{ icone: LucideIcon; rotulo: string; href: string }> = [
    {
      icone: PackagePlus,
      rotulo: 'Pedir recompra',
      href: caminhoDoDependente(pacienteId, '/solicitacoes'),
    },
    { icone: FileText, rotulo: 'Documentos', href: caminhoDoDependente(pacienteId, '/documentos') },
    { icone: Pill, rotulo: 'Medicamentos', href: caminhoDoDependente(pacienteId, '/medicamentos') },
    { icone: IdCard, rotulo: 'Dados cadastrais', href: caminhoDoDependente(pacienteId) },
  ];

  return (
    <Card className={CARTAO}>
      <CardContent className="space-y-3 p-5">
        <h3 className="font-display text-foreground text-base font-bold">
          Atalhos de {primeiroNome(nome)}
        </h3>
        <ul className="space-y-1.5">
          {atalhos.map((a) => (
            <li key={a.rotulo}>
              <Link
                href={a.href}
                className="hover:bg-primary/5 text-foreground flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-semibold transition-colors"
              >
                <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <a.icone className="h-4 w-4" />
                </span>
                <span className="flex-1">{a.rotulo}</span>
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
