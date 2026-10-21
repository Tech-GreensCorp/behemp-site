'use client';

/**
 * Os dois consentimentos, num componente — porque o que muda entre eles é **conteúdo e efeito**,
 * não estrutura.
 *
 * | tipo | fundamento | quem manifesta | bloqueia |
 * |---|---|---|---|
 * | `teleconsulta` | **CFM 2.314/2022, Art. 15** (`CFM-01`) | só o **paciente** — a norma nomeia o titular | 🔴 **o atendimento remoto** |
 * | `ia` | **LGPD art. 11, I** (`LGPD-05`) | paciente **e** médico — a voz dos dois é captada | apenas a transcrição |
 *
 * POR QUE UM COMPONENTE E NÃO DOIS
 * Duplicar produziria duas telas que divergem com o tempo — e a divergência apareceria no item
 * mais sensível: o texto que a pessoa leu. O que varia é declarado nas constantes de
 * `lib/lgpd/consentimento.ts`, que é onde o Jurídico vai revisar.
 *
 * VISUAL: só componentes e tokens existentes. No tom escuro, reuso as cores que já estão nas
 * telas de teleconsulta (`DO-12` manda preservar aquele design).
 */

import { AlertTriangle, Check, Info, Loader2, ShieldCheck, Siren } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import {
  buscarEstadoConsentTeleconsulta,
  buscarEstadoConsentimento,
  registrarConsentimentoIa,
  registrarConsentimentoTeleconsulta,
} from '@/app/_actions/consentimento-teleconsulta';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  TEXTO_CONSENTIMENTO_IA,
  TEXTO_CONSENTIMENTO_TELECONSULTA,
  VERSAO_CONSENTIMENTO_IA,
  VERSAO_CONSENTIMENTO_TELECONSULTA,
} from '@/lib/lgpd/consentimento';
import { cn } from '@/lib/utils';

type Tipo = 'teleconsulta' | 'ia';

const CONTEUDO = {
  teleconsulta: {
    texto: TEXTO_CONSENTIMENTO_TELECONSULTA,
    versao: VERSAO_CONSENTIMENTO_TELECONSULTA,
    aceite: 'Li e autorizo a realização desta consulta por telemedicina.',
    botao: 'Autorizar e entrar na consulta',
    fundamento: 'CFM 2.314/2022, Art. 15',
  },
  ia: {
    texto: TEXTO_CONSENTIMENTO_IA,
    versao: VERSAO_CONSENTIMENTO_IA,
    aceite: 'Li e autorizo o processamento do áudio para gerar o resumo clínico.',
    botao: 'Autorizar o resumo automático',
    fundamento: 'LGPD, art. 11, I',
  },
} as const;

/** Classes por tom. O tom escuro reusa as cores já presentes nas telas de teleconsulta. */
const TONS = {
  claro: {
    card: 'border-primary/30',
    cardOk: 'border-secondary/30 bg-secondary/5',
    titulo: 'text-foreground',
    texto: 'text-muted-foreground',
    lista: 'border-primary/20',
    caixa: 'bg-muted/40',
    icone: 'text-primary',
    iconeOk: 'text-secondary',
    botao: '',
  },
  escuro: {
    card: 'border-[#EA5429]/40 bg-white/5 text-white',
    cardOk: 'border-[#2D4F3C]/50 bg-[#2D4F3C]/20 text-white',
    titulo: 'text-white',
    texto: 'text-slate-300',
    lista: 'border-[#EA5429]/30',
    caixa: 'bg-black/30',
    icone: 'text-[#EA5429]',
    iconeOk: 'text-green-300',
    botao: 'bg-[#EA5429] hover:bg-[#D4471E] text-white',
  },
} as const;

/** Negrito em `**texto**`, sem trazer biblioteca de markdown para sete frases. */
function comEnfase(texto: string, classe: string) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') ? (
      <strong key={i} className={cn('font-semibold', classe)}>
        {parte.slice(2, -2)}
      </strong>
    ) : (
      parte
    ),
  );
}

interface Props {
  tipo: Tipo;
  salaId: string;
  /** Só para o tipo `ia`, que precisa dos dois lados. O papel que vale vem do servidor. */
  papel?: 'paciente' | 'medico';
  tom?: 'claro' | 'escuro';
  /** Chamado quando o estado muda — a tela usa para saber se libera. */
  onMudanca?: (liberado: boolean) => void;
  /**
   * Estado injetado, para PREVISUALIZAR o layout sem sessão e sem banco.
   *
   * Quando fornecido, o componente **não busca** — renderiza este estado. É o que permite a
   * rota `/preview` mostrar o componente REAL em vez de uma cópia: cópia diverge do original,
   * e aí o que foi aprovado deixa de ser o que vai para produção.
   *
   * ⚠️ Não é atalho de produção: `/preview` só existe fora dela, e passar isto numa tela real
   * mostraria estado que não veio do servidor. O guarda cobra que só `/preview` use.
   */
  previewEstado?: { autorizado: boolean; emergencia?: boolean; souOPaciente?: boolean };
  className?: string;
}

export function Consentimento({
  tipo,
  salaId,
  papel = 'paciente',
  tom = 'claro',
  onMudanca,
  previewEstado,
  className,
}: Props) {
  const c = TONS[tom];
  const cfg = CONTEUDO[tipo];

  const [marcado, setMarcado] = useState(false);
  const [carregando, setCarregando] = useState(!previewEstado);
  const [enviando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [autorizado, setAutorizado] = useState(previewEstado?.autorizado ?? false);
  const [emergencia, setEmergencia] = useState(previewEstado?.emergencia ?? false);
  const [podeSerColetado, setPodeSerColetado] = useState(true);
  const [ehRascunho, setEhRascunho] = useState(Boolean(previewEstado));
  const [souOPaciente, setSouOPaciente] = useState(previewEstado?.souOPaciente ?? true);
  const [outroAceitou, setOutroAceitou] = useState(false);

  useEffect(() => {
    // Com estado injetado não há o que buscar — é o modo de previsualização.
    if (previewEstado) return;
    let ativo = true;
    const ler =
      tipo === 'teleconsulta' ? buscarEstadoConsentTeleconsulta : buscarEstadoConsentimento;
    ler(salaId)
      .then((r) => {
        if (!ativo) return;
        if (!r.sucesso || !r.dados) return setErro(r.erro ?? 'Não foi possível ler a autorização');
        const d = r.dados;
        setPodeSerColetado(d.podeSerColetado ?? true);
        setEhRascunho(d.ehRascunho);
        if ('autorizado' in d) {
          setAutorizado(d.autorizado);
          setEmergencia(d.emergencia);
          setSouOPaciente(d.souOPaciente);
          onMudanca?.(d.autorizado);
        } else {
          const meu = papel === 'paciente' ? d.pacienteAceitou : d.medicoAceitou;
          const outro = papel === 'paciente' ? d.medicoAceitou : d.pacienteAceitou;
          setAutorizado(meu);
          setOutroAceitou(outro);
          onMudanca?.(d.liberado);
        }
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
    // onMudanca fora das deps: função nova a cada render do pai refaria a leitura em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaId, tipo, papel, previewEstado]);

  function confirmar() {
    setErro(null);
    // No preview, o gesto é visual: mostra o estado seguinte sem gravar nada.
    if (previewEstado) {
      setAutorizado(true);
      onMudanca?.(true);
      return;
    }
    iniciar(async () => {
      const r =
        tipo === 'teleconsulta'
          ? await registrarConsentimentoTeleconsulta(salaId)
          : await registrarConsentimentoIa(salaId);
      if (r.sucesso) {
        setAutorizado(true);
        onMudanca?.(true);
      } else {
        setErro(r.erro ?? 'Não foi possível registrar');
      }
    });
  }

  if (carregando) {
    return (
      <Card className={cn('flex items-center gap-3 p-6', c.card, className)}>
        <Loader2 className={cn('size-4 animate-spin', c.texto)} />
        <span className={cn('text-sm', c.texto)}>Verificando autorização…</span>
      </Card>
    );
  }

  // Em produção com texto em revisão, o aceite não é pedido — coletar sobre texto não revisado
  // produz registro sem valor e simula conformidade.
  if (!podeSerColetado) {
    return (
      <Alert className={className}>
        <Info className="size-4" />
        <AlertTitle>
          {tipo === 'teleconsulta'
            ? 'Consulta por vídeo indisponível'
            : 'Resumo automático indisponível'}
        </AlertTitle>
        <AlertDescription>
          O recurso está desativado até a revisão do texto de autorização.
        </AlertDescription>
      </Alert>
    );
  }

  // Sala aberta sob emergência: o aceite prévio foi dispensado pela norma, e isso é dito.
  if (emergencia) {
    return (
      <Card className={cn('p-5', c.cardOk, className)}>
        <div className="flex items-start gap-3">
          <Siren className={cn('mt-0.5 size-5 shrink-0', c.iconeOk)} />
          <div className="space-y-1">
            <p className={cn('font-heading text-sm font-semibold', c.titulo)}>
              Atendimento em emergência médica
            </p>
            <p className={cn('text-sm', c.texto)}>
              A autorização prévia foi dispensada, e o motivo está registrado no prontuário.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (autorizado) {
    return (
      <Card className={cn('p-5', c.cardOk, className)}>
        <div className="flex items-start gap-3">
          <ShieldCheck className={cn('mt-0.5 size-5 shrink-0', c.iconeOk)} />
          <div className="space-y-1">
            <p className={cn('font-heading text-sm font-semibold', c.titulo)}>
              Autorização registrada
            </p>
            <p className={cn('text-sm', c.texto)}>
              {tipo === 'teleconsulta'
                ? 'Você pode entrar na consulta.'
                : outroAceitou
                  ? 'O resumo automático está ativo nesta consulta.'
                  : `Aguardando a autorização d${papel === 'paciente' ? 'o médico' : 'o paciente'}. Sem as duas não haverá resumo — e a consulta segue normalmente.`}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // O médico não autoriza teleconsulta pelo paciente: a norma nomeia o titular.
  if (tipo === 'teleconsulta' && !souOPaciente) {
    return (
      <Alert className={className}>
        <Info className="size-4" />
        <AlertTitle>Aguardando a autorização do paciente</AlertTitle>
        <AlertDescription>
          A consulta por vídeo depende da autorização dele. Só o paciente pode dá-la.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={cn('p-6', c.card, className)}>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className={cn('mt-0.5 size-6 shrink-0', c.icone)} />
          <div>
            <h3 className={cn('font-heading text-lg font-semibold', c.titulo)}>
              {cfg.texto.titulo}
            </h3>
            <p className={cn('mt-1 text-sm font-medium', c.titulo)}>
              {comEnfase(cfg.texto.destaque, c.titulo)}
            </p>
          </div>
        </div>

        <ul className={cn('space-y-2.5 border-l-2 pl-4', c.lista)}>
          {cfg.texto.itens.map((item, i) => (
            <li key={i} className={cn('text-sm leading-relaxed', c.texto)}>
              {comEnfase(item, c.titulo)}
            </li>
          ))}
        </ul>

        {/* O efeito da recusa vem ANTES da decisão — é o que torna a escolha informada, e é o
            que a CFM chama de "direito de negar". */}
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Se você não autorizar</AlertTitle>
          <AlertDescription>
            {'direitoDeNegar' in cfg.texto ? cfg.texto.direitoDeNegar : cfg.texto.seRecusar}
          </AlertDescription>
        </Alert>

        {ehRascunho && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Texto preliminar</AlertTitle>
            <AlertDescription>
              Em revisão jurídica ({cfg.versao}). Visível apenas fora de produção.
            </AlertDescription>
          </Alert>
        )}

        <label className={cn('flex cursor-pointer items-start gap-3 rounded-md p-4', c.caixa)}>
          <Checkbox
            checked={marcado}
            onCheckedChange={(v) => setMarcado(v === true)}
            className="mt-0.5 size-5"
            aria-describedby={`aceite-${tipo}`}
          />
          <span
            id={`aceite-${tipo}`}
            className={cn('text-sm leading-relaxed font-medium', c.titulo)}
          >
            {cfg.aceite}
          </span>
        </label>

        {erro && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <Button
          size="lg"
          className={cn('h-12 w-full text-base', c.botao)}
          disabled={!marcado || enviando}
          onClick={confirmar}
        >
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {cfg.botao}
        </Button>

        <p className={cn('text-center text-xs', c.texto)}>Fundamento: {cfg.fundamento}</p>
      </div>
    </Card>
  );
}
