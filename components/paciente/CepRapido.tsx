/**
 * CEP RÁPIDO — um campo, endereço inteiro.
 *
 * Mesmo padrão de busca já usado em `components/shared/triagem-form.tsx`: ViaCEP no
 * client, sem chave de API, disparado ao completar os 8 dígitos. Reusado aqui em vez de
 * reinventado — dois lugares (o cadastro e o painel) chamam o mesmo componente.
 *
 * Salva via `atualizarPerfilCompletoPaciente`, a mesma action que `/paciente/perfil` já usa
 * para editar CEP/endereço/cidade/UF — nenhuma superfície de escrita nova.
 *
 * ⚠️ NUNCA BLOQUEIA: falha na busca do CEP deixa os campos editáveis manualmente, e o
 * chamador decide o que fazer se o paciente preferir pular.
 *
 * Dois modos: o padrão salva sozinho (`atualizarPerfilCompletoPaciente`) e mostra seu
 * próprio botão; `modoControlado` só reporta os valores via `aoMudarValores`, para quando
 * o CEP precisa ser coletado ANTES de existir sessão para salvar (`/registrar-se`).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

import { atualizarPerfilCompletoPaciente } from '@/app/_actions/perfil-paciente';

function mascararCep(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

export interface ValoresDeEndereco {
  cep: string;
  numero: string;
  /** Logradouro + bairro (ViaCEP) já com "nº <numero>" anexado — pronto para gravar em `pacientes.endereco`. */
  endereco: string;
  cidade: string;
  uf: string;
  /** CEP com 8 dígitos e número preenchido. */
  completo: boolean;
}

export interface CepRapidoProps {
  /** Chamado depois de um salvamento bem-sucedido. Ignorado em modo controlado. */
  onSalvo?: () => void;
  /** Chamado na primeira interação do paciente com o campo — o chamador decide o que fazer (ex: pausar um redirect automático). */
  onInteracao?: () => void;
  /** Rótulo do botão de salvar. Default: "Salvar endereço". Ignorado em modo controlado. */
  rotuloBotao?: string;
  /**
   * 🔴 MODO CONTROLADO — sem botão de salvar próprio, sem chamar
   * `atualizarPerfilCompletoPaciente` sozinho. Existe para o `/registrar-se`: ali o CEP
   * precisa ser exigido ANTES de a conta existir (antes de `signUp.create`), e a essa
   * altura não há `clerkId` nenhum para a action gravar — quem decide quando salvar e com
   * qual sessão é o chamador, via `aoMudarValores`.
   */
  modoControlado?: boolean;
  /** Só em modo controlado: chamado a cada mudança, com o valor já pronto para gravar. */
  aoMudarValores?: (valores: ValoresDeEndereco) => void;
}

export function CepRapido({
  onSalvo,
  onInteracao,
  rotuloBotao,
  modoControlado = false,
  aoMudarValores,
}: CepRapidoProps) {
  const [cep, setCep] = useState('');
  const [numero, setNumero] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [encontrado, setEncontrado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const jaInteragiu = useRef(false);

  async function buscarCep(valorMascarado: string) {
    const digitos = valorMascarado.replace(/\D/g, '');
    if (digitos.length !== 8) {
      setEncontrado(false);
      return;
    }

    setBuscando(true);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      if (!resposta.ok) throw new Error('falha na consulta');
      const dados = await resposta.json();

      if (dados.erro) {
        toast.error('CEP não encontrado. Confira os números ou preencha manualmente.');
        setEncontrado(false);
        return;
      }

      const enderecoMontado = `${dados.logradouro || ''}${dados.bairro ? `, ${dados.bairro}` : ''}`
        .trim()
        .replace(/^,\s*/, '');

      setEndereco(enderecoMontado);
      setCidade(dados.localidade || '');
      setUf(dados.uf || '');
      setEncontrado(true);
    } catch {
      toast.error('Não conseguimos buscar esse CEP agora.');
      setEncontrado(false);
    } finally {
      setBuscando(false);
    }
  }

  function aoDigitarCep(valor: string) {
    if (!jaInteragiu.current) {
      jaInteragiu.current = true;
      onInteracao?.();
    }
    const mascarado = mascararCep(valor);
    setCep(mascarado);
    if (mascarado.replace(/\D/g, '').length === 8) {
      buscarCep(mascarado);
    } else {
      setEncontrado(false);
    }
  }

  const cepCompleto = cep.replace(/\D/g, '').length === 8;
  const podeSalvar = cepCompleto && numero.trim().length > 0 && !salvando;

  /**
   * 🔴 O NÚMERO ENTRA NO MESMO CAMPO DE TEXTO — `pacientes.endereco` é uma coluna só, sem
   * coluna dedicada para número. CEP e logradouro sem número não localizam a casa; por isso
   * ele é exigido junto (ver `podeSalvar`), e vai anexado ao final do texto.
   */
  const enderecoComNumero = [endereco.trim(), numero.trim() ? `nº ${numero.trim()}` : '']
    .filter(Boolean)
    .join(', ');

  // Só em modo controlado: o pai lê o valor pronto a cada mudança, sem action nenhuma aqui.
  useEffect(() => {
    if (!modoControlado) return;
    aoMudarValores?.({
      cep: cep.trim(),
      numero: numero.trim(),
      endereco: enderecoComNumero,
      cidade: cidade.trim(),
      uf: uf.trim(),
      completo: podeSalvar,
    });
  }, [modoControlado, cep, numero, enderecoComNumero, cidade, uf, podeSalvar, aoMudarValores]);

  async function salvar() {
    setSalvando(true);
    const resultado = await atualizarPerfilCompletoPaciente({
      cep: cep.trim() || null,
      endereco: enderecoComNumero || null,
      cidade: cidade.trim() || null,
      uf: uf.trim() || null,
    });
    setSalvando(false);

    if (resultado.sucesso) {
      toast.success('Endereço salvo!');
      onSalvo?.();
    } else {
      toast.error(resultado.erro || 'Não foi possível salvar o endereço agora.');
    }
  }

  return (
    <div className="space-y-3 text-left">
      <div className="space-y-1">
        <Label htmlFor="cep-rapido" className="text-muted-foreground text-xs">
          CEP
        </Label>
        <div className="relative">
          <Input
            id="cep-rapido"
            value={cep}
            onChange={(e) => aoDigitarCep(e.target.value)}
            placeholder="00000-000"
            inputMode="numeric"
            autoComplete="postal-code"
            className="h-10 rounded-xl pr-9 text-sm"
          />
          {buscando && (
            <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
          )}
        </div>
      </div>

      {encontrado && (
        <div className="animate-fade-in border-secondary/30 bg-secondary/5 rounded-xl border px-3 py-2 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="text-secondary mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="text-foreground leading-relaxed">
              {endereco || 'Endereço não detalhado pelo CEP'}
              {cidade ? ` — ${cidade}` : ''}
              {uf ? `/${uf}` : ''}
            </p>
          </div>
        </div>
      )}

      {/*
        🔴 SEM NÚMERO, O ENDEREÇO NÃO LOCALIZA NADA. O ViaCEP devolve logradouro e bairro,
        nunca o número da casa — ele não existe na base de CEPs. Exigido junto do CEP
        (ver `podeSalvar`), nunca só depois de encontrar o endereço: em CEP de zona rural
        ou condomínio, `encontrado` pode nem preencher logradouro nenhum.
      */}
      <div className="space-y-1">
        <Label htmlFor="numero-rapido" className="text-muted-foreground text-xs">
          Número
        </Label>
        <Input
          id="numero-rapido"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="Nº da casa ou apto"
          inputMode="numeric"
          autoComplete="address-line2"
          className="h-10 rounded-xl text-sm"
        />
      </div>

      {!modoControlado && (
        <Button
          type="button"
          size="sm"
          onClick={salvar}
          disabled={!podeSalvar}
          className="w-full gap-1.5 rounded-xl"
        >
          {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {rotuloBotao ?? 'Salvar endereço'}
        </Button>
      )}
    </div>
  );
}
