'use client';

/**
 * A galeria de previsualização — os componentes reais, com dado de fixture, **separados por
 * perfil**.
 *
 * Pedido do dono em 24/08/2026: *"pra deixar organizado eu preferia separar tipo, essa aqui é
 * tela do médico, quando formos para a do paciente tem que ter um botão swich a mesma coisa pro
 * ADMIN"*.
 *
 * Cada bloco diz **qual arquivo** está sendo renderizado, para que a aprovação seja sobre algo
 * localizável: "aprovo o de hipóteses, mexe no de medidas" tem endereço.
 *
 * 🔴 SEPARAR POR PERFIL NÃO É SÓ ORGANIZAÇÃO. Ver as telas agrupadas pelo papel que as usa é o
 * que faz aparecer o que **não existe** — foi assim que ficou visível que o admin não tem
 * nenhuma tela de IA clínica, e a aba dele diz isso em vez de ficar vazia.
 *
 * ⚠️ Componente de desenvolvimento. A rota que o usa (`/preview`) não existe em produção.
 */

import { useState } from 'react';
import { Bot, PanelRightOpen, Stethoscope, User, Users } from 'lucide-react';

import { PainelTitulacao } from '@/components/conduta/PainelTitulacao';
import { PontePrescricao, type RascunhoParaConfirmar } from '@/components/conduta/PontePrescricao';
import { VisaoGeralTitulacao } from '@/components/conduta/VisaoGeralTitulacao';
import { AnaliseAssistida } from '@/components/ia-clinica/AnaliseAssistida';
import { AvisoDeUrgencia, SeloDeUrgencia } from '@/components/ia-clinica/SeloDeUrgencia';
import { ControleMedida, FAIXAS } from '@/components/ia-clinica/ControleMedida';
import { FormMedidas } from '@/components/ia-clinica/FormMedidas';
import { PainelHipoteses } from '@/components/ia-clinica/PainelHipoteses';
import { RastreioUso } from '@/components/ia-clinica/RastreioUso';
import { SerieDeMedidas } from '@/components/ia-clinica/SerieDeMedidas';
import { Consentimento } from '@/components/teleconsulta/Consentimento';
import { Badge } from '@/components/ui/badge';
import type { GrafoEvidencias } from '@/lib/ia-clinica/contrato';
import { cn } from '@/lib/utils';

interface Props {
  grafoCompleto: GrafoEvidencias;
  grafoParcial: GrafoEvidencias;
  /** O caso de canabidiol, com as opções de medicamento por hipótese. */
  grafoCanabidiol: GrafoEvidencias;
}

type Perfil = 'medico' | 'paciente' | 'admin';

const PERFIS: { id: Perfil; rotulo: string; icone: typeof User; nota: string }[] = [
  {
    id: 'medico',
    rotulo: 'Médico',
    icone: Stethoscope,
    nota: 'Anamnese direcionada a canabidiol, análise assistida e o passo de decisão humana.',
  },
  {
    id: 'paciente',
    rotulo: 'Paciente',
    icone: User,
    nota: 'O que o paciente vê e assina antes da teleconsulta e antes da transcrição.',
  },
  {
    id: 'admin',
    rotulo: 'Admin',
    icone: Users,
    nota: 'Ainda não há tela de IA clínica para o admin — e a aba diz por quê.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SPRINT 5 — conduta, prescrição e titulação
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * O catálogo de exemplo. Os números vêm do seed real (`db/seed-produtos.ts`).
 *
 * 🔴 O TERCEIRO PRODUTO NÃO TEM TEOR DE PROPÓSITO — e esse é o estado de TODO o catálogo hoje.
 * Levantar os teores é trabalho do chefe, fora desta sprint (`DO-46`). O preview mostra a tela
 * como ela realmente vai aparecer, não como ela ficaria num mundo em que o dado já existe.
 */
const PRODUTOS_EXEMPLO = [
  {
    id: 'med-1',
    nome: 'Greens LIFE 1500mg Isolated',
    marca: 'Greens LIFE',
    gotasPorMl: 30,
    cbdMgPorGota: '1.660',
    thcMgPorGota: '0.000',
    teorThcPercentual: '0.000',
  },
  {
    id: 'med-2',
    nome: 'Greens MED 6300mg Full Spectrum',
    marca: 'Greens MED',
    gotasPorMl: 30,
    cbdMgPorGota: '6.660',
    thcMgPorGota: '0.330',
    teorThcPercentual: '0.990',
  },
  {
    id: 'med-3',
    nome: 'Greens MED 9000mg Broad Spectrum',
    marca: 'Greens MED',
    gotasPorMl: 30,
    cbdMgPorGota: '10.000',
    thcMgPorGota: '0.000',
    teorThcPercentual: null,
  },
];

const PLANOS_EXEMPLO = [
  {
    dosagemId: 'dos-1',
    medicamentoId: 'med-1',
    medicamentoNome: 'Greens LIFE 1500mg Isolated',
    marca: 'Greens LIFE',
    gotasPorDia: 12,
    mlFrasco: 30,
    dataInicio: '2026-08-01',
    dataFimPrevista: '2026-09-14',
    cbdMgPorDia: 19.92,
    thcMgPorDia: 0,
    teorThcPercentual: '0.000',
  },
  {
    dosagemId: 'dos-2',
    medicamentoId: 'med-3',
    medicamentoNome: 'Greens MED 9000mg Broad Spectrum',
    marca: 'Greens MED',
    gotasPorDia: 6,
    mlFrasco: 30,
    dataInicio: '2026-08-20',
    dataFimPrevista: '2026-08-29',
    cbdMgPorDia: 60,
    thcMgPorDia: 0,
    teorThcPercentual: null,
  },
];

/** A curva com os dois tipos de linha: as novas, com produto do catálogo, e uma legada. */
const CURVA_EXEMPLO = [
  {
    ajusteId: 'aj-2',
    dataAjuste: '2026-08-18',
    proximaRevisao: '2026-09-15',
    motivoAjuste:
      'Dor noturna persistente apesar de duas semanas na dose anterior; sem sonolência diurna relatada.',
    medicamentoNome: 'Greens LIFE 1500mg Isolated',
    dosagemAnterior: '8 gotas/dia',
    novaDosagem: '12 gotas/dia',
    frequencia: '2x ao dia',
    viaAdministracao: 'sublingual',
    legado: false,
  },
  {
    ajusteId: 'aj-1',
    dataAjuste: '2026-08-04',
    proximaRevisao: '2026-08-18',
    motivoAjuste: 'Boa tolerância na primeira semana; subida gradual conforme plano de titulação.',
    medicamentoNome: 'Greens LIFE 1500mg Isolated',
    dosagemAnterior: '5 gotas/dia',
    novaDosagem: '8 gotas/dia',
    frequencia: '2x ao dia',
    viaAdministracao: 'sublingual',
    legado: false,
  },
  {
    ajusteId: 'aj-0',
    dataAjuste: '2026-06-12',
    proximaRevisao: null,
    motivoAjuste: 'Registro anterior à Sprint 5, digitado à mão.',
    medicamentoNome: 'CBD Full Spectrum',
    dosagemAnterior: null,
    novaDosagem: '20mg 2x/dia',
    frequencia: '2x ao dia',
    viaAdministracao: null,
    legado: true,
  },
];

const GERAL_EXEMPLO = [
  {
    pacienteId: 'pac-1',
    pacienteNome: 'Ana Ribeiro',
    medicamentoNome: 'Greens LIFE 1500mg Isolated',
    gotasPorDia: 12,
    cbdMgPorDia: 19.92,
    dataInicio: '2026-08-01',
    dataFimPrevista: '2026-09-14',
    teorThcPercentual: '0.000',
  },
  {
    pacienteId: 'pac-1',
    pacienteNome: 'Ana Ribeiro',
    medicamentoNome: 'Greens MED 9000mg Broad Spectrum',
    gotasPorDia: 6,
    cbdMgPorDia: 60,
    dataInicio: '2026-08-20',
    dataFimPrevista: '2026-08-29',
    teorThcPercentual: null,
  },
  {
    pacienteId: 'pac-2',
    pacienteNome: 'Carlos Menezes',
    medicamentoNome: 'Greens MED 6300mg Full Spectrum',
    gotasPorDia: 4,
    cbdMgPorDia: 26.64,
    dataInicio: '2026-07-22',
    dataFimPrevista: '2026-11-04',
    teorThcPercentual: '0.990',
  },
];

/**
 * O rascunho da ponte, no caso que mais importa ver: teor de THC acima de 0,2%, que pelo
 * `CAN-04` exige Notificação de Receita "A" — um tipo que `prescricaoTipoEnum` NÃO tem
 * (`04` Item 13.6). O diálogo denuncia em vez de gravar calado.
 */
const RASCUNHO_EXEMPLO: RascunhoParaConfirmar = {
  medicamentos: [
    {
      nome: 'Greens MED 6300mg Full Spectrum',
      dose: '4 gotas por dia',
      forma: 'Solução oral / extrato',
      posologia: 'Tomar 4 gotas por via sublingual, 2x ao dia (uso contínuo)',
      quantidade: '1 frasco de 30 ml (225 dias de uso)',
    },
  ],
  tipoExigido: 'notificacao_a',
  tipoQueOSistemaGrava: 'controle_especial',
  faltaTipoNoSistema: true,
  avisoDoTipo: 'Notificação de Receita "A"',
};

/** Série de exemplo, para a tabela de evolução ter mais de um ponto. */
const SERIE_EXEMPLO = [
  {
    id: '3',
    medidoEm: '2026-08-18',
    nivelDor: 4,
    qualidadeSono: 7,
    nivelAnsiedade: 3,
    qualidadeVidaGlobal: 7,
    crisesContagem: 1,
    crisesPeriodo: 'semana' as const,
    pressaoSistolica: 118,
    pressaoDiastolica: 76,
    pesoKg: '72.5',
    observacao: 'Relata sono melhor desde o ajuste.',
  },
  {
    id: '2',
    medidoEm: '2026-07-20',
    nivelDor: 6,
    qualidadeSono: 5,
    nivelAnsiedade: 5,
    qualidadeVidaGlobal: 5,
    crisesContagem: 3,
    crisesPeriodo: 'semana' as const,
    pressaoSistolica: 124,
    pressaoDiastolica: 80,
    pesoKg: '72.0',
    observacao: null,
  },
  {
    id: '1',
    medidoEm: '2026-06-22',
    nivelDor: 8,
    qualidadeSono: 3,
    nivelAnsiedade: 7,
    qualidadeVidaGlobal: 3,
    crisesContagem: 6,
    crisesPeriodo: 'semana' as const,
    pressaoSistolica: 132,
    pressaoDiastolica: 86,
    pesoKg: '71.4',
    observacao: 'Primeira avaliação — marco zero.',
  },
];

function Secao({
  titulo,
  arquivo,
  nota,
  children,
}: {
  titulo: string;
  arquivo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t pt-8 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="font-heading text-lg font-semibold">{titulo}</h2>
          <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
            {arquivo}
          </code>
        </div>
        {nota && <p className="text-muted-foreground max-w-2xl text-sm">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

function TelasDoMedico({
  grafoCompleto,
  grafoParcial,
  grafoCanabidiol,
}: {
  grafoCompleto: GrafoEvidencias;
  grafoParcial: GrafoEvidencias;
  grafoCanabidiol: GrafoEvidencias;
}) {
  const [dor, setDor] = useState<number | null>(6);
  const [qv, setQv] = useState<number | null>(4);
  // A ponte no preview ABRE o diálogo e não grava nada — é demonstração.
  const [rascunho, setRascunho] = useState<RascunhoParaConfirmar | null>(null);

  return (
    <div className="space-y-10">
      <Secao
        titulo="Hipóteses com evidência e opções de medicamento"
        arquivo="PainelHipoteses.tsx + EvidenciaDaHipotese.tsx + MedicacoesSugeridas.tsx"
        nota="Clique numa hipótese. Abaixo da evidência aparecem as opções de medicamento — no máximo 3, ranqueadas, cada uma com o porquê da posição e o que pesa contra. Note que NÃO há dose: listar opções informa (IMD-01), dizer quanto dar dirige (IMD-02). E a hipótese 3 não tem opção nenhuma, porque nela o próximo passo é investigar."
      >
        <PainelHipoteses grafo={grafoCanabidiol} />
      </Secao>

      <Secao
        titulo="Hipóteses + decisão humana, juntas"
        arquivo="AnaliseAssistida.tsx"
        nota='Escolha "Divirjo da análise" para ver os dois campos do DO-40: o medicamento que você vai prescrever (OBRIGATÓRIO — é ele que fecha o par que o RAG aprende) e "por que a análise errou" (opcional de propósito: explicação escrita às pressas ensina menos que nenhuma). Ao pé do formulário está a barra do rascunho — que salva no SERVIDOR, com histórico, porque localStorage foi rejeitado com motivo. Ou escolha "Acato uma das hipóteses" e clique em "revisar" ao lado de qualquer opção: abre o MESMO bloco de evidência e medicação do painel acima, sem sair da decisão. Abrir para reler não seleciona — são dois botões distintos de propósito.'
      >
        <AnaliseAssistida pacienteId="preview" grafo={grafoCanabidiol} ehDemonstracao />
      </Secao>

      <Secao
        titulo="Como fica no sidebar da teleconsulta"
        arquivo="AnaliseAssistida.tsx com denso"
        nota="A mesma coisa numa coluna estreita: os cartões de medicamento nascem fechados, a tipografia cai um passo, e o botão de revisar fica só com o ícone. O que NÃO muda é o conteúdo — nenhuma contradição, ressalva ou rótulo de origem desaparece para caber."
      >
        <div className="border-border max-w-[380px] rounded-xl border p-3">
          <p className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs">
            <PanelRightOpen className="size-3.5" />
            largura simulada do sidebar — 380px
          </p>
          <AnaliseAssistida pacienteId="preview" grafo={grafoCanabidiol} ehDemonstracao denso />
        </div>
      </Secao>

      <Secao
        titulo="Conduta e titulação do paciente"
        arquivo="PainelTitulacao.tsx + PlanoVigente.tsx + CurvaDeTitulacao.tsx"
        nota='É a aba "Dosagem" do prontuário, reconstruída (Sprint 5). Clique em "Prescrever" para ver a ponte: o diálogo mostra o que vai ser gravado e AVISA que a Notificação de Receita "A" exigida pelo CAN-04 não é emitida por este sistema — em vez de gravar o tipo errado calado. Clique em "Ajustar dose" num dos cartões: o formulário só existe quando chamado — numa tela que decide dose, densidade é risco clínico (DO-44 d). Repare que o segundo plano diz "Teor de THC não informado" em vez de assumir a faixa permissiva, e que a curva marca o registro antigo como "texto livre".'
      >
        <PontePrescricao
          rascunho={rascunho}
          onFechar={() => setRascunho(null)}
          onConfirmar={() => setRascunho(null)}
        />
        <PainelTitulacao
          pacienteNome="Ana Ribeiro"
          planosVigentes={PLANOS_EXEMPLO}
          curva={CURVA_EXEMPLO}
          produtos={PRODUTOS_EXEMPLO}
          onCriarConduta={() => {}}
          onAjustarDose={() => {}}
          onPrescrever={() => setRascunho(RASCUNHO_EXEMPLO)}
        />
      </Secao>

      <Secao
        titulo="O aviso do CAN-04 — quem aplica a norma é o médico"
        arquivo="FormConduta.tsx + AvisoReceituario.tsx"
        nota='Abra "Nova conduta" acima e escolha o "Greens MED 6300mg Full Spectrum": o campo de teor vem pré-preenchido com 0,990% e o aviso vira Notificação de Receita "A". Apague o campo e ele diz que NÃO SABE — nunca assume o receituário mais simples. Escolha o "9000mg Broad", que não tem teor no catálogo, e o campo nasce vazio: é o estado real de todo o catálogo hoje (DO-46). ⚠️ Nenhum botão fica desabilitado por causa disso: o sistema avisa, o médico decide (DO-47).'
      >
        <p className="text-muted-foreground max-w-2xl text-sm">
          O formulário abre dentro do painel acima — clique em <strong>Nova conduta</strong> ou em{' '}
          <strong>Ajustar dose</strong>. No ajuste, trocar para um produto de outra faixa de THC faz
          aparecer o aviso de mudança de receituário, e a prescrição nova continua{' '}
          <strong>opcional</strong>.
        </p>
      </Secao>

      <Secao
        titulo="Visão geral — o filtro de todos os pacientes"
        arquivo="VisaoGeralTitulacao.tsx · rota /medico/titulacao"
        nota="O filtro do DO-44 (c). A visão PADRÃO continua sendo a do paciente, no prontuário; esta responde “quem está tomando o quê”. Agrupada por paciente, não uma lista plana de medicamentos — e sem formulário: ajustar dose olhando a lista de todos seria a densidade que o DO-44 (d) proíbe."
      >
        <VisaoGeralTitulacao linhas={GERAL_EXEMPLO} />
      </Secao>

      <Secao
        titulo="Gatilhos de urgência — o mapa 7 para 3, mais 1 derivado"
        arquivo="SeloDeUrgencia.tsx + lib/ia-clinica/urgencia.ts"
        nota="O DO-42 pediu gatilhos na tela. Ao medir o contrato para implementar, o número não bateu: UrgenciaAnalise tem 7 valores que são DOIS vocabulários para TRÊS níveis — não sete graus, e não quatro. O quarto nível (DO-51) não vem de `urgencia`: é emergência MAIS red_flags_nao_explicadas > 0, dois campos que o motor já produz. Repare no último selo: valor fora do contrato DENUNCIA em vez de cair para rotina — afirmar 'sem urgência' a partir de algo que ninguém entendeu é a pior saída numa tela cuja função é alertar."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SeloDeUrgencia urgencia="verde" redFlagsNaoExplicadas={0} />
            <SeloDeUrgencia urgencia="ok" redFlagsNaoExplicadas={0} />
            <SeloDeUrgencia urgencia="amarelo" redFlagsNaoExplicadas={0} />
            <SeloDeUrgencia urgencia="atencao" redFlagsNaoExplicadas={0} />
            <SeloDeUrgencia urgencia="vermelho" redFlagsNaoExplicadas={0} />
            <SeloDeUrgencia urgencia="critico" redFlagsNaoExplicadas={0} />
            <SeloDeUrgencia urgencia="vermelho" redFlagsNaoExplicadas={2} />
            <SeloDeUrgencia urgencia="roxo" />
          </div>
          <p className="text-muted-foreground text-xs">
            Da esquerda para a direita: verde · ok · amarelo · atenção · vermelho · crítico ·
            <strong> vermelho com 2 red flags abertas</strong> (o 4º nível, que pulsa) · e um valor
            que o contrato não declara.
          </p>
          <div className="max-w-xl space-y-3">
            <AvisoDeUrgencia urgencia="vermelho" redFlagsNaoExplicadas={2} />
            <AvisoDeUrgencia urgencia="amarelo" redFlagsNaoExplicadas={0} />
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Rastreio do uso de cannabis"
        arquivo="RastreioUso.tsx"
        nota='O que separa esta anamnese de uma genérica. Escolha "Primeiro uso" e veja os campos de produto e dose DESAPARECEREM — perguntar a dose de quem nunca usou é o defeito que o DO-26 evita. Depois escolha "Uso atualmente" e eles voltam, com a adesão.'
      >
        <RastreioUso pacienteId="preview" />
      </Secao>

      <Secao
        titulo="Medidas de desfecho — o formulário"
        arquivo="FormMedidas.tsx"
        nota="O baseline do acompanhamento longitudinal. A data da medição é campo próprio, separada da data do registro: consulta de hoje pode registrar medida de ontem, e confundir as duas arruína a série."
      >
        <FormMedidas pacienteId="preview" />
      </Secao>

      <Secao
        titulo="Evolução das medidas"
        arquivo="SerieDeMedidas.tsx"
        nota="Sem gráfico de propósito: com poucos pontos, uma tabela mostra mais e não sugere tendência onde não há. As setas já interpretam melhora ou piora — inclusive nas escalas invertidas."
      >
        <SerieDeMedidas medidas={SERIE_EXEMPLO} />
      </Secao>

      <Secao
        titulo="Controle de medida"
        arquivo="ControleMedida.tsx"
        nota="Tente digitar 900 no campo. A faixa plausível impede. E veja o valor anterior ao lado, com a variação já interpretada — em qualidade de vida, subir é melhorar."
      >
        <div className="grid max-w-2xl gap-6 sm:grid-cols-2">
          <ControleMedida
            rotulo="Dor"
            ajuda="0 = sem dor · 10 = a pior imaginável"
            valor={dor}
            onChange={setDor}
            faixa={FAIXAS.dor}
            anterior={8}
          />
          <ControleMedida
            rotulo="Qualidade de vida"
            ajuda="0 = muito ruim · 10 = muito boa — aqui, MAIOR é melhor"
            valor={qv}
            onChange={setQv}
            faixa={FAIXAS.qualidadeVida}
            anterior={3}
            maiorEhMelhor
          />
        </div>
      </Secao>

      <Secao
        titulo="Análise incompleta"
        arquivo="PainelHipoteses.tsx — com o fixture parcial"
        nota="O caso mais comum na prática: o motor não fechou. A incompletude aparece ANTES das hipóteses, porque é o que calibra a leitura de todas elas."
      >
        <PainelHipoteses grafo={grafoParcial} />
      </Secao>

      <Secao
        titulo="O fixture do VidAI real, sem canabidiol"
        arquivo="PainelHipoteses.tsx — fixture de cardiologia"
        nota="Este é o caso que veio do motor de verdade, e fica aqui porque é ele que prova que o contrato é o real, não um inventado. Sem opções de medicamento: pendurar canabidiol numa dissecção aórtica seria clinicamente absurdo, e tela de exemplo absurda ensina a coisa errada."
      >
        <PainelHipoteses grafo={grafoCompleto} />
      </Secao>
    </div>
  );
}

function TelasDoPaciente() {
  return (
    <div className="space-y-10">
      <Secao
        titulo="Consentimento de teleconsulta"
        arquivo="Consentimento.tsx (tipo=teleconsulta)"
        nota="Exigido pela CFM 2.314/2022 Art. 15. É este que BLOQUEIA a entrada na sala — sem ele, não há consulta. Marque a caixa e clique para ver o estado seguinte."
      >
        <Consentimento
          tipo="teleconsulta"
          salaId="preview"
          previewEstado={{ autorizado: false, souOPaciente: true }}
        />
      </Secao>

      <Secao
        titulo="Consentimento de IA — no tom escuro da teleconsulta"
        arquivo="Consentimento.tsx (tipo=ia, tom=escuro)"
        nota="O tom escuro é o das telas de teleconsulta, cujo design permanece (DO-12). Este consentimento NÃO bloqueia a consulta — só a transcrição. Bloquear a consulta por causa dele tornaria o aceite nulo (LGPD art. 8º §3º), e há um guarda com 20 casos impedindo essa regressão."
      >
        <div className="rounded-xl bg-[#1A1A1A] p-6">
          <Consentimento
            tipo="ia"
            salaId="preview"
            papel="paciente"
            tom="escuro"
            previewEstado={{ autorizado: false }}
          />
        </div>
      </Secao>

      <Secao
        titulo="O que o paciente NÃO vê"
        arquivo="— decisão de desenho, não componente"
        nota="Nenhuma hipótese, nenhum medicamento sugerido e nenhum grafo de evidência chega ao paciente. Não é omissão: hipótese ranqueada sem médico ao lado é diagnóstico entregue por software, e é exatamente a fronteira que o ANV-01…ANV-04 observa."
      >
        <div className="text-muted-foreground border-border rounded-lg border border-dashed p-5 text-sm">
          Vazio de propósito. A saída da IA existe para o médico decidir; o paciente recebe a
          conduta <strong className="text-foreground">depois</strong> da decisão humana, pelos
          canais que já existem (prescrição, plano, orientação).
        </div>
      </Secao>
    </div>
  );
}

function TelasDoAdmin() {
  return (
    <div className="space-y-6">
      <Secao
        titulo="Nenhuma tela de IA clínica para o admin — ainda"
        arquivo="— nada construído"
        nota="Preferi a aba dizer isso a ficar vazia sem explicação."
      >
        <div className="border-border space-y-4 rounded-lg border border-dashed p-5 text-sm">
          <p className="text-muted-foreground">
            As Sprints 1–4 entregaram anamnese, análise assistida e decisão humana — todas do
            médico. O admin não recebeu tela porque{' '}
            <strong className="text-foreground">
              ele não é parte do cuidado, e por isso não pode ver identidade clínica
            </strong>
            : a regra do projeto é que quem não é parte do cuidado vê agregado, nunca paciente
            identificado — e a agregação acontece na query, não no componente.
          </p>
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              O que faria sentido existir aqui, quando for pedido
            </p>
            <ul className="text-muted-foreground space-y-1.5">
              <li className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Taxa de divergência</strong> — quantas vezes
                  os médicos discordaram da IA, agregado. É a medida de qualidade do modelo, e o
                  schema <code className="font-mono text-xs">revisoes-ia</code> já a guarda.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Trilha de auditoria de acesso</strong> — quem
                  leu qual prontuário e quando, que a LGPD pede e o admin precisa poder inspecionar.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Estado do consentimento</strong> — quantas
                  consultas rodaram sem aceite de IA, sem expor quem.
                </span>
              </li>
            </ul>
          </div>
          <p className="text-muted-foreground border-t pt-3 text-xs">
            Nenhuma delas foi pedida. Estão aqui como proposta, não como trabalho iniciado — e
            entram no checklist só quando você mandar.
          </p>
        </div>
      </Secao>
    </div>
  );
}

export function PreviewGaleria({ grafoCompleto, grafoParcial, grafoCanabidiol }: Props) {
  const [perfil, setPerfil] = useState<Perfil>('medico');
  const atual = PERFIS.find((p) => p.id === perfil)!;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          desenvolvimento — esta rota não existe em produção
        </Badge>
        <h1 className="font-heading text-2xl font-semibold">Preview de layout</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Os <strong className="text-foreground">componentes reais</strong>, importados dos mesmos
          arquivos que as telas usam, com dados de exemplo do contrato congelado. Não é cópia — o
          que você aprovar aqui é o que roda em produção.
        </p>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Redimensione a janela para ver o comportamento responsivo, e troque o tema do sistema para
          ver claro e escuro.
        </p>
      </header>

      {/* O switch de perfil. Fica grudado no topo porque as listas são longas e perder o contexto
          de "de quem é esta tela" no meio da rolagem é o que a separação existe para evitar. */}
      <div className="bg-background/95 sticky top-0 z-10 -mx-4 space-y-2 border-b px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div role="tablist" aria-label="Perfil das telas" className="flex flex-wrap gap-2">
          {PERFIS.map((p) => {
            const Icone = p.icone;
            const ativo = perfil === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setPerfil(p.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
                  ativo
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/40',
                )}
              >
                <Icone className={cn('size-4', ativo && 'text-primary')} />
                {p.rotulo}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">{atual.nota}</p>
      </div>

      {perfil === 'medico' && (
        <TelasDoMedico
          grafoCompleto={grafoCompleto}
          grafoParcial={grafoParcial}
          grafoCanabidiol={grafoCanabidiol}
        />
      )}
      {perfil === 'paciente' && <TelasDoPaciente />}
      {perfil === 'admin' && <TelasDoAdmin />}

      <footer className="text-muted-foreground space-y-2 border-t pt-6 text-sm">
        <p>
          Para aprovar ou pedir mudança, cite o nome do arquivo ao lado de cada seção — assim a
          alteração tem endereço.
        </p>
        <p className="flex items-start gap-1.5 text-xs">
          <Bot className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Todo dado aqui é de fixture. O motor de IA{' '}
            <strong className="text-foreground">não está ligado</strong> (ADR-0002: UI antes da
            inteligência), e o conteúdo clínico dos exemplos não foi validado — GAP-03 aberto.
          </span>
        </p>
      </footer>
    </div>
  );
}
