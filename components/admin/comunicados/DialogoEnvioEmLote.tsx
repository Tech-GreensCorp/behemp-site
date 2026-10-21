'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, Send, XCircle, AlertTriangle, MinusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  enviarComunicadoAtualizacaoDoacao,
  previaDoLoteDeComunicados,
} from '@/app/_actions/comunicados';
import { TITULO_ATUALIZACAO_PROGRAMA_DOACAO } from '@/lib/comunicados/catalogo';
import { ROTULO_DA_SITUACAO, type SituacaoNoLote } from '@/lib/comunicados/lote';

/**
 * Envio em lote do comunicado "Atualização do Programa de Doação" (telas de Pacientes e Triagens).
 *
 * 🔴 NÃO é um caminho novo de envio. Cada paciente passa, UM POR VEZ, pela mesma action do botão
 * individual (`enviarComunicadoAtualizacaoDoacao`): mesma autorização de admin, mesma trava de
 * envio duplicado no banco, mesma auditoria por envelope. O lote só organiza a fila e mostra o
 * resultado de cada linha. Sequencial de propósito: cada envio é um envelope no DocuSign, e uma
 * falha em um não pode afetar os outros.
 */

export interface AlvoDoLote {
  /** Identifica a linha na tela (id do paciente ou da triagem). */
  chave: string;
  nome: string;
  /** null = a pessoa não tem cadastro de paciente (só acontece na triagem). */
  pacienteId: string | null;
}

type Resultado = { tipo: 'ok' | 'aviso' | 'falha'; texto: string };

export interface LinhaDoLote {
  chave: string;
  nome: string;
  pacienteId: string | null;
  situacao: SituacaoNoLote;
  resultado?: Resultado;
}

/**
 * Monta a pré-checagem: marca quem não tem cadastro e quem está repetido, e pergunta ao servidor
 * quem pode mesmo receber. Chamada pela tela ao clicar no botão — antes de abrir o diálogo.
 */
export async function montarLinhasDoLote(
  alvos: AlvoDoLote[],
): Promise<{ sucesso: true; linhas: LinhaDoLote[] } | { sucesso: false; erro: string }> {
  const vistos = new Set<string>();
  const unicos: string[] = [];
  for (const a of alvos) {
    if (a.pacienteId && !vistos.has(a.pacienteId)) {
      vistos.add(a.pacienteId);
      unicos.push(a.pacienteId);
    }
  }

  const porPaciente = new Map<string, SituacaoNoLote>();
  if (unicos.length > 0) {
    const previa = await previaDoLoteDeComunicados(unicos);
    if (!previa.sucesso) return { sucesso: false, erro: previa.erro };
    for (const p of previa.dados) porPaciente.set(p.pacienteId, p.situacao);
  }

  const jaListados = new Set<string>();
  const linhas = alvos.map((a): LinhaDoLote => {
    let situacao: SituacaoNoLote;
    if (!a.pacienteId) situacao = 'sem_cadastro';
    else if (jaListados.has(a.pacienteId)) situacao = 'duplicado';
    else situacao = porPaciente.get(a.pacienteId) ?? 'nao_encontrado';
    if (a.pacienteId) jaListados.add(a.pacienteId);
    return { chave: a.chave, nome: a.nome, pacienteId: a.pacienteId, situacao };
  });
  return { sucesso: true, linhas };
}

type Fase = 'previa' | 'enviando' | 'fim';

export function DialogoEnvioEmLote({
  linhasIniciais,
  onFechar,
}: {
  linhasIniciais: LinhaDoLote[];
  /** `limpar` = o envio aconteceu; a tela pode limpar a seleção. */
  onFechar: (limpar: boolean) => void;
}) {
  const [linhas, setLinhas] = useState<LinhaDoLote[]>(linhasIniciais);
  const [fase, setFase] = useState<Fase>('previa');
  const [atual, setAtual] = useState(0);
  const pararRef = useRef(false);

  const elegiveis = linhas.filter((l) => l.situacao === 'elegivel');
  const excluidas = linhas.filter((l) => l.situacao !== 'elegivel');

  function registrar(chave: string, resultado: Resultado) {
    setLinhas((prev) => prev.map((l) => (l.chave === chave ? { ...l, resultado } : l)));
  }

  async function enviar() {
    pararRef.current = false;
    setFase('enviando');
    for (let i = 0; i < elegiveis.length; i++) {
      if (pararRef.current) break;
      const alvo = elegiveis[i];
      setAtual(i + 1);
      try {
        const res = await enviarComunicadoAtualizacaoDoacao(alvo.pacienteId as string);
        if (!res.sucesso) registrar(alvo.chave, { tipo: 'falha', texto: res.erro });
        else if (res.dados.emailEnviado) registrar(alvo.chave, { tipo: 'ok', texto: 'Enviado' });
        else {
          registrar(alvo.chave, {
            tipo: 'aviso',
            texto: 'Enviado, mas o e-mail de aviso falhou (use "Reenviar e-mail" no paciente)',
          });
        }
      } catch {
        registrar(alvo.chave, { tipo: 'falha', texto: 'Falha inesperada. Confira no paciente.' });
      }
    }
    setFase('fim');
  }

  const enviados = linhas.filter((l) => l.resultado && l.resultado.tipo !== 'falha').length;
  const falhas = linhas.filter((l) => l.resultado?.tipo === 'falha').length;
  const naoProcessados = elegiveis.filter((l) => !l.resultado).length;
  const ocupado = fase === 'enviando';

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        // Não se fecha no meio do envio: o botão "Parar" é o jeito de interromper.
        if (!aberto && !ocupado) onFechar(fase === 'fim');
      }}
    >
      <DialogContent className="max-w-lg" showCloseButton={!ocupado}>
        <DialogHeader>
          <DialogTitle>
            {fase === 'fim' ? 'Envio concluído' : `Enviar "${TITULO_ATUALIZACAO_PROGRAMA_DOACAO}"`}
          </DialogTitle>
          <DialogDescription>
            {fase === 'previa' &&
              (elegiveis.length > 0
                ? `${elegiveis.length} paciente${elegiveis.length !== 1 ? 's' : ''} receber${elegiveis.length !== 1 ? 'ão' : 'á'} o e-mail de aviso e o comunicado passará a aparecer em Documentos. Cada envio é individual e fica registrado com o seu nome.`
                : 'Nenhum dos selecionados pode receber o comunicado agora.')}
            {fase === 'enviando' &&
              `Enviando ${atual} de ${elegiveis.length}. Não feche esta janela.`}
            {fase === 'fim' &&
              `${enviados} enviado${enviados !== 1 ? 's' : ''}` +
                (falhas > 0 ? `, ${falhas} com falha` : '') +
                (naoProcessados > 0
                  ? `, ${naoProcessados} não processado${naoProcessados !== 1 ? 's' : ''} (interrompido)`
                  : '') +
                '.'}
          </DialogDescription>
        </DialogHeader>

        <ul className="border-border/40 max-h-72 divide-y overflow-y-auto rounded-xl border text-sm">
          {linhas.map((l) => (
            <li key={l.chave} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate font-medium">{l.nome || 'Sem nome'}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-right text-xs">
                {l.resultado ? (
                  <>
                    {l.resultado.tipo === 'ok' && (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    )}
                    {l.resultado.tipo === 'aviso' && (
                      <AlertTriangle size={14} className="text-[#C08E3A]" />
                    )}
                    {l.resultado.tipo === 'falha' && (
                      <XCircle size={14} className="text-destructive" />
                    )}
                    <span className={l.resultado.tipo === 'falha' ? 'text-destructive' : ''}>
                      {l.resultado.texto}
                    </span>
                  </>
                ) : l.situacao === 'elegivel' ? (
                  <>
                    {ocupado && elegiveis[atual - 1]?.chave === l.chave ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} className="text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">
                      {fase === 'fim' ? 'Não processado' : ROTULO_DA_SITUACAO.elegivel}
                    </span>
                  </>
                ) : (
                  <>
                    <MinusCircle size={14} className="text-muted-foreground" />
                    <span className="text-muted-foreground">{ROTULO_DA_SITUACAO[l.situacao]}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>

        {fase === 'previa' && excluidas.length > 0 && elegiveis.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {excluidas.length} selecionado{excluidas.length !== 1 ? 's' : ''} não será
            {excluidas.length !== 1 ? 'ão' : ''} enviado{excluidas.length !== 1 ? 's' : ''}, pelo
            motivo indicado em cada linha.
          </p>
        )}

        <DialogFooter>
          {fase === 'previa' && (
            <>
              <Button variant="outline" onClick={() => onFechar(false)}>
                Cancelar
              </Button>
              <Button onClick={enviar} disabled={elegiveis.length === 0} className="gap-1.5">
                <Send size={14} />
                {`Enviar a ${elegiveis.length} paciente${elegiveis.length !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
          {fase === 'enviando' && (
            <Button variant="outline" onClick={() => (pararRef.current = true)}>
              Parar depois deste
            </Button>
          )}
          {fase === 'fim' && <Button onClick={() => onFechar(true)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
