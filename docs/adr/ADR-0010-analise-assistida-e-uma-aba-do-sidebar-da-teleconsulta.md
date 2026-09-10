# ADR-0010 — A análise assistida é **mais uma aba** do sidebar da teleconsulta, com etapas dentro dela

> **Status:** ✅ **decidida pelo dono** — 24/08/2026 (`DO-39`).
> **Contexto:** o modo `denso` de `AnaliseAssistida` foi construído em 24/08 para caber numa
> coluna estreita, mas **onde** ele entra na teleconsulta estava em aberto. Eu levantei a dúvida
> como escolha entre aba nova e empilhamento sob a transcrição.
> **Decisão do dono, literal:** _"ele é mais uma aba no sidebar da teleconsulta, não vamos fugir
> desse design que meu chefe fez, isso se torna uma nova aba em etapas dentro dessa mesma aba"_.

---

## §1 — Por que isto é ADR e não só um ticket

Porque é **decisão de navegação em superfície de decisão clínica**, e porque tem um rejeitado
que importa: o `DO-12` já dizia que _"a teleconsulta da BeHemp mantém o design atual"_, e havia
um caminho tentador de violar isso sem parecer que violava — acrescentar uma coluna, um painel
flutuante ou um drawer "só para a IA". O dono fechou a porta: **aba, dentro do que existe.**

## §2 — As decisões

### D-01 — Uma aba nova no sidebar existente, não uma superfície nova

A análise entra na mesma barra de abas que a teleconsulta já tem. Nada de coluna extra, drawer,
modal ou painel flutuante.

**Rejeitado: empilhar abaixo da transcrição.** Foi a alternativa que eu apresentei. Ela faz a
coluna crescer indefinidamente e coloca duas coisas de natureza diferente — o que foi dito e o
que o modelo concluiu — no mesmo fluxo de rolagem, onde se leem como continuidade. Numa tela que
precisa separar **fato** de **sugestão** (proibição nº 2), isso é o oposto do desejado.
**Rejeitado: painel flutuante ou drawer sobre o vídeo.** Cobre a imagem do paciente durante a
consulta. E introduz superfície visual que o design do chefe não tem.

### D-02 — As etapas vivem **dentro** da aba, não como abas irmãs

_"isso se torna uma nova aba em etapas dentro dessa mesma aba"_. A sequência — hipóteses →
evidência → decisão — acontece dentro do espaço da aba.

**Rejeitado: uma aba por etapa.** Multiplicaria as abas do chefe por três e faria o médico
navegar entre abas no meio de um raciocínio único. A sequência **é** o conteúdo: a ADR-0006 D-01
e a ADR-0009 já estabelecem que a ordem sustenta-contradiz-lacuna-opções é a ordem do raciocínio.
Quebrá-la em abas separadas permitiria pular direto para a conduta sem passar pelo argumento.

### D-03 — O modo `denso` é o único ajuste, e ele encolhe a caixa, nunca o conteúdo

Já decidido na ADR-0009 D-07 e reafirmado aqui: cartões nascem fechados, tipografia cai um passo,
rótulo do botão vira ícone com `aria-label`. **Nenhuma** ressalva, contradição ou rótulo de
procedência some por falta de espaço.

**Rejeitado: versão "resumida" da análise para o sidebar.** A coluna estreita é onde a pressa é
maior — ou seja, exatamente onde a objeção precisa continuar visível.

## §3 — O que fica de fora

- **Qualquer mudança no design do sidebar** — cores, altura, comportamento das abas existentes.
  `DO-12` e `DO-39`.
- A **transcrição** e o **consentimento de IA** seguem onde estão. A aba nova consome a saída;
  não muda quem a produz.

## §4 — O que ainda não está decidido

- **O rótulo da aba.** "Análise", "IA", "Apoio"? Não foi dito, e nomear superfície de IA clínica
  tem peso: o `CFM-03` exige que se registre que é _"apenas uma impressão diagnóstica"_.
  Pergunta para o dono antes de implementar.
- **A posição da aba** na barra — primeira, última, ao lado de qual. Idem.

---

## §5 — RESOLVIDO em 25/08/2026: rótulo e posição (`DO-49`, `DO-50`)

A §4 deixou em aberto o rótulo e a posição da aba. Perguntado ao dev Davi, com 4 e 3 opções
comparadas:

- **Rótulo: `IA Clínica`** (`DO-49`) — o mesmo do item no sidebar principal do médico. Duas
  superfícies, um nome. As rejeitadas: "Análise IA" (curto, mas nome novo), "Análise assistida"
  (preciso, mas largo demais para a barra de abas) e "Hipóteses" (esconde a origem).
- **Posição: ÚLTIMA**, depois de Prescrição (`DO-50`) — **nenhuma aba existente muda de lugar**.
  Rejeitado pôr entre Prontuário e Prescrição, que seguiria o fluxo clínico mas empurraria
  Prescrição da 3ª para a 4ª posição; e rejeitado pôr em primeiro, que contraria o P1 do VidAI
  (a IA **conclui** a coleta, não abre a tela).

**Implementado**: `components/teleconsulta/PainelClinicoLateral.tsx` monta o **componente real**
`AnaliseAssistida` em modo `denso` — não uma cópia, pela mesma razão do `/preview`.

⚠️ **`grafo={null}` hoje**, e é honesto: o motor é a Metade 2 (`DO-06`). O componente mostra o
estado vazio explicando o que virá, **sem botão inerte** — botão que não faz nada é a tela
prometendo o que não entrega.

O guarda `divergencia-alimenta-o-rag-sem-ingerir` cobra os quatro pontos: a aba existe, o rótulo
é o decidido, a ordem é `paciente → prontuario → prescricao → ia`, e o modo é `denso`. A
sabotagem que trocou a ordem ficou vermelha.
