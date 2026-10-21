'use client';

/**
 * O CONSENTIMENTO QUE FALTOU, pedido depois — sem trancar nada.
 *
 * 🔴 Decisão do dono em 13/09/2026: _"apareça a mesma parte do consentimento do formulário, só
 * que somente a mensagem de consentimento com as caixas de seleção… claro que não pode ser
 * bloqueante, mas toda etapa que é compartilhada com a Greens deve aparecer esse modal"_.
 *
 * ## Por que ele existe
 *
 * A reconciliação automática (ADR-0022, D-09) conclui o cadastro **sem o paciente presente** e
 * por isso não consente por ele. Correto — e deixa um buraco previsível: a ficha existe, o fluxo
 * segue, e nada autoriza o envio à Greens. Sem este bloco, o paciente não sabe que falta e o
 * sistema só descobre na hora de enviar, quando a fila é barrada e o evento morre calado.
 *
 * ⚠️ REUSA `ConsentimentoDoCompartilhamento` — o MESMO componente do formulário de cadastro.
 * Não é economia de código: é garantia de que o texto que a pessoa lê aqui é o mesmo que ela
 * leria lá. Duas redações do mesmo aceite é como o registro deixa de provar o que afirma.
 *
 * 🔴 E NÃO BLOQUEIA NADA. Consentimento obtido como condição de acesso é viciado (LGPD art. 8º
 * §3º). Este bloco informa, oferece e aceita ser ignorado — inclusive "agora não", que é uma
 * resposta legítima e fica registrada como ausência, não como recusa.
 */

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConsentimentoDoCompartilhamento } from '@/components/paciente/ConsentimentoDoCompartilhamento';
import {
  oQueFaltaAutorizar,
  registrarConsentimento,
} from '@/app/(paciente)/_actions/consentimento';
import type { Finalidade } from '@/lib/parceiros/consentimento';

interface Props {
  /** De onde o pedido parte, para o registro dizer em que tela a pessoa aceitou. */
  origem: string;
}

/**
 * 🔴 ELE SE CARREGA SOZINHO, e isso é decisão de desenho, não preguiça.
 *
 * O dono pediu que apareça em _"toda etapa que é compartilhada com a Greens"_. Se cada tela
 * tivesse de buscar o estado e passar por prop, a próxima tela nasceria sem — que é exatamente
 * como o aviso da procuração passou quatro semanas importado e nunca renderizado. Basta colocar
 * `<ConsentimentoQueFaltou origem="..." />` e ele decide se aparece.
 */
export function ConsentimentoQueFaltou({ origem }: Props) {
  const [faltando, setFaltando] = useState<Finalidade[]>([]);
  const [selecionadas, setSelecionadas] = useState<Finalidade[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    void oQueFaltaAutorizar().then((r) => {
      if (vivo && r.pedir) setFaltando(r.faltando);
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (pronto || dispensado || faltando.length === 0) return null;

  async function salvar() {
    if (selecionadas.length === 0) return;
    setSalvando(true);
    setErro('');
    const r = await registrarConsentimento({ finalidades: selecionadas, origem });
    setSalvando(false);
    if (r.sucesso) setPronto(true);
    else setErro(r.erro ?? 'Não conseguimos registrar agora. Tente de novo.');
  }

  return (
    <div className="animate-fade-in border-border/60 bg-card/80 space-y-4 rounded-2xl border p-5">
      <div className="space-y-1">
        <p className="text-foreground text-sm leading-relaxed">
          <strong>Falta a sua autorização para compartilhar com a Greens.</strong>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Seu cadastro está completo e isso não trava nada — mas sem esta autorização não podemos
          devolver a sua receita nem o resultado da ANVISA para lá.
        </p>
      </div>

      {/*
        O MESMO componente do formulário de cadastro: mesmo texto, mesma versão, mesmas caixas.
        Duas redações do mesmo aceite é como o registro deixa de provar o que afirma.
      */}
      <ConsentimentoDoCompartilhamento selecionadas={selecionadas} onChange={setSelecionadas} />

      {erro && <p className="text-destructive text-sm">{erro}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="h-11 flex-1 rounded-xl"
          disabled={salvando || selecionadas.length === 0}
          onClick={salvar}
          type="button"
        >
          {salvando ? 'Registrando…' : 'Autorizar'}
        </Button>
        {/*
          🔴 "AGORA NÃO" É RESPOSTA, e precisa existir. Um aviso sem saída é pedágio disfarçado:
          quem não quer autorizar fica olhando para a mesma caixa em toda visita, até marcar por
          cansaço — e aceite por cansaço não é livre.
        */}
        <Button
          variant="ghost"
          className="h-11 rounded-xl"
          onClick={() => setDispensado(true)}
          type="button"
        >
          Agora não
        </Button>
      </div>
    </div>
  );
}
