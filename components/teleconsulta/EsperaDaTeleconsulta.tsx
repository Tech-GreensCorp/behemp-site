'use client';

/**
 * A espera da teleconsulta — ADR-0029 D-30 (Davi, 01/10/2026: _"aplicar as mesmas telas de animações
 * que montamos aqui na teleconsulta, só que personalizado o texto para médico paciente"_).
 *
 * São as MESMAS peças da espera do atendimento (`components/atendimento/EsperaDaChamada.tsx`), no
 * fundo escuro que a sala já usa. Três diferenças, escolhidas por Davi entre opções:
 *   · sem "Na sala há m:ss": o cabeçalho já mostra "AO VIVO mm:ss", e dois relógios confundem;
 *   · o indicador do microfone fica no fluxo, centrado: o canto é da própria câmera (PiP);
 *   · não há "conectando" nem "sem câmera": a teleconsulta só sabe que o outro chegou quando o vídeo
 *     dele chega, e não avisa quando a câmera desliga. Criar esses estados é mexer na sinalização.
 */
import { ShieldCheck, Stethoscope, User } from 'lucide-react';

import {
  Dica,
  IndicadorDoMicrofone,
  OrbeDaEspera,
  Textos,
} from '@/components/atendimento/EsperaDaChamada';

interface Props {
  /** Quem está olhando esta tela. */
  quem: 'medico' | 'paciente';
  /** `abrindo`: o médico abriu e a sala ainda está conectando; `aguardando`: o outro não chegou. */
  fase: 'abrindo' | 'aguardando';
  /** O nome de quem se espera, quando a tela já o tem; sem ele, o texto diz "o médico"/"o paciente". */
  nomeDoOutro?: string | null;
  /** A faixa do microfone desta tela; `null` sem microfone, e aí o indicador não aparece. */
  microfone: MediaStreamTrack | null;
  mudo: boolean;
}

export function EsperaDaTeleconsulta({ quem, fase, nomeDoOutro, microfone, mudo }: Props) {
  const medico = quem === 'medico';
  const nome = nomeDoOutro?.trim() || null;

  return (
    <div className="espera-palco-escuro relative box-border flex h-full w-full flex-col items-center justify-center gap-[22px] overflow-clip p-6 md:gap-[26px]">
      <OrbeDaEspera icone={fase === 'abrindo' ? null : medico ? User : Stethoscope} />

      {fase === 'abrindo' ? (
        <Textos titulo="Abrindo a sala…" tom="escuro" />
      ) : medico ? (
        <Textos titulo="O paciente ainda não entrou" tom="escuro">
          {`A consulta começa sozinha quando ${nome ?? 'o paciente'} abrir a sala. Ele já foi avisado.`}
        </Textos>
      ) : (
        <Textos titulo="Você já está na sala" tom="escuro">
          {`Assim que ${nome ? `o(a) Dr(a). ${nome}` : 'o médico'} entrar, a consulta começa sozinha. Não precisa recarregar a página.`}
        </Textos>
      )}

      {fase === 'aguardando' &&
        (medico ? (
          <Dica icone={User} tom="escuro">
            Enquanto espera, você pode abrir o prontuário pelo botão Paciente, à esquerda.
          </Dica>
        ) : (
          <Dica icone={ShieldCheck} tom="escuro" tambemNoCelular>
            Enquanto espera, confira se você está num lugar reservado e com a internet estável.
          </Dica>
        ))}

      {fase === 'aguardando' && microfone && (
        <IndicadorDoMicrofone microfone={microfone} mudo={mudo} tom="escuro" noFluxo />
      )}
    </div>
  );
}
