'use client';

/**
 * O painel que salva e revoga.
 *
 * 🔴 UM BOTÃO SÓ, e ele faz as duas coisas. Marcar e desmarcar na mesma tela, com um único
 * "salvar", é o que torna revogar tão fácil quanto consentir — e é a exigência do art. 8º §5º
 * ("procedimento gratuito e facilitado") lida como desenho de tela, não como parágrafo.
 */

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ConsentimentoDoCompartilhamento } from '@/components/paciente/ConsentimentoDoCompartilhamento';
import { Button } from '@/components/ui/button';
import { FINALIDADES, type Finalidade } from '@/lib/parceiros/consentimento';
import {
  registrarConsentimento,
  revogarConsentimento,
} from '@/app/(paciente)/_actions/consentimento';

const TODAS: Finalidade[] = [
  FINALIDADES.avaliacaoMedica,
  FINALIDADES.apoioAnvisa,
  FINALIDADES.retornoAoParceiro,
];

export function PainelDoConsentimento({ iniciais }: { iniciais: Finalidade[] }) {
  const [escolhidas, setEscolhidas] = useState<Finalidade[]>(iniciais);
  /**
   * O que está GRAVADO, como esta tela sabe. Separado de `iniciais` porque a prop do servidor
   * não volta atrás dentro do mesmo `useState` — sem este estado, o aviso de "alterações não
   * salvas" continuaria aceso depois de um salvamento que deu certo.
   */
  const [gravadas, setGravadas] = useState<Finalidade[]>(iniciais);
  const [salvando, iniciarSalvamento] = useTransition();

  /** O que mudou em relação ao que está gravado — sem isto o botão salvaria o que já existe. */
  const aConceder = escolhidas.filter((f) => !gravadas.includes(f));
  const aRevogar = TODAS.filter((f) => gravadas.includes(f) && !escolhidas.includes(f));
  const mudou = aConceder.length > 0 || aRevogar.length > 0;

  function salvar() {
    iniciarSalvamento(async () => {
      /**
       * ⚠️ REVOGA PRIMEIRO. Se a segunda chamada falhar, o estado que sobra é o mais
       * restritivo — menos autorização do que ele pediu, nunca mais.
       */
      const revogadas: Finalidade[] = [];
      for (const finalidade of aRevogar) {
        const r = await revogarConsentimento(finalidade);
        if (!r.sucesso) {
          // O que já foi revogado ANTES da falha continua revogado no banco. A tela precisa
          // dizer a verdade sobre isso, senão ela afirma um estado que não existe.
          setGravadas((atuais) => atuais.filter((f) => !revogadas.includes(f)));
          toast.error(r.erro);
          return;
        }
        revogadas.push(finalidade);
      }

      if (aConceder.length > 0) {
        const r = await registrarConsentimento({
          finalidades: aConceder,
          origem: 'painel_privacidade',
        });
        if (!r.sucesso) {
          setGravadas((atuais) => [...atuais.filter((f) => !aRevogar.includes(f))]);
          toast.error(r.erro);
          return;
        }
      }

      setGravadas(escolhidas);
      toast.success('Suas preferências foram atualizadas.');
    });
  }

  return (
    <div className="space-y-4">
      <ConsentimentoDoCompartilhamento
        selecionadas={escolhidas}
        onChange={setEscolhidas}
        desabilitado={salvando}
      />

      <div className="flex items-center justify-end gap-3">
        {mudou && !salvando && (
          <span className="text-muted-foreground text-xs">Você tem alterações não salvas.</span>
        )}
        <Button
          type="button"
          onClick={salvar}
          disabled={!mudou || salvando}
          className="h-10 rounded-xl"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
