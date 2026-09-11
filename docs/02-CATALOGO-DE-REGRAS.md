# Catálogo de regras externas — Be4Hope / BeHemp

> **Cite o ID, nunca a paráfrase.** O ID entra no commit, no comentário do código e na ADR.
> Paráfrase de terceira mão é onde a alucinação nasce.

**Aberto em 20/08/2026, aguardando a demanda em definição.**

---

## Para que este arquivo existe

Este projeto opera sob **regra externa de verdade** — não só boas práticas. Quando uma regra
vem de norma, contrato ou documento de terceiro, ela entra aqui como **linha atômica com ID
citável**, com a fonte e a página.

Sem isso, a regra chega ao código como paráfrase, e ninguém consegue conferir se está certa.

E o ID habilita o guarda mais útil desta família: **quebrar o build se alguém citar um ID que
não existe neste arquivo.** Isso pega a citação inventada, que é sutil e corrói a confiança em
todas as outras.

---

## O formato

| ID             | regra                   | fonte                       | página | situação |
| -------------- | ----------------------- | --------------------------- | ------ | -------- |
| `{PREFIXO}-01` | {a regra, em uma frase} | {norma / manual / contrato} | p.14   | ✅       |

**Prefixos sugeridos**, um por corpo de regra:

| prefixo   | corpo de regra                                   | onde ela já aparece no projeto                 |
| --------- | ------------------------------------------------ | ---------------------------------------------- |
| `ANV-nn`  | ANVISA — autorização de importação, RDC          | `autorizacoes-anvisa`, formulário 8833, ofício |
| `CFM-nn`  | CFM — teleconsulta, prontuário, receituário      | CFM 2.299/21, disclaimer de teleconsulta       |
| `RDC-nn`  | RDC ANVISA 1.000/25 — receituário e SNCR         | `lib/receituario/`, prescrições                |
| `LGPD-nn` | LGPD — base legal, retenção, direitos do titular | auditoria, soft delete, mascaramento de PII    |
| `ICP-nn`  | ICP-Brasil — assinatura digital                  | DT-002, provedores BirdID/VIDaaS               |

⚠️ **Nenhuma regra foi transcrita ainda.** As normas acima estão citadas em código e em
`DECISOES_TECNICAS.md`, mas **não** existem como linha consultável com ID. Transcrever é
trabalho próprio, e vale começar pela que mais aparece em decisão.

---

## Duas armadilhas medidas na prática

- **"fonte esgotada" que não foi aberta.** Antes de declarar uma norma coberta, **liste os
  documentos que ela contém e marque os lidos**.
- **"lido" ≠ "transcrito".** Ao declarar cobertura, separe as duas colunas: quantas foram
  **lidas** × quantas viraram **linha consultável**.

## As outras famílias de ID

Além das regras externas, este catálogo também recebe:

| prefixo  | o que é                                                                 |
| -------- | ----------------------------------------------------------------------- |
| `CF-nn`  | **conflito** entre duas fontes que dizem coisas diferentes              |
| `GAP-nn` | **falta insumo** — diga de quem, e o que bloqueia                       |
| `PD-nn`  | **pendência** declarada pela própria fonte                              |
| `DO-nn`  | **decisão do dono** sem documento de origem — com data e a frase citada |

⚠️ Default proposto por TI é **proposta**, nunca decisão. Vai marcado como tal, e vira código
só depois do aceite.

---

## Registrado na sessão de 20/08/2026

### Decisões do dono, sem documento de origem

| ID      | decisão                                                                                                                                                                                                                                                                           | quem/quando                  | frase citada                                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DO-01` | O código do **VidAI** pertence ao chefe do dono do produto, **não** à RR Tecnologia — apesar do `README.md` do VidAI declarar _"Projeto proprietário © 2025–2026 RR Tecnologia, todos os direitos reservados"_. A importação da inteligência **não** está bloqueada por licença. | dono do produto · 20/08/2026 | _"é do meu chefe, não da RR-tecnol, esqueça tudo relacionado a isso."_                                                                                       |
| `DO-02` | A **teleconsulta da BeHemp nunca foi usada de verdade.** Não há uso clínico real em produção. Isso reduz o perigo de mexer: correção agressiva passa a ser admissível onde antes exigiria guarda prévio.                                                                          | dono do produto · 20/08/2026 | resposta _"Nunca foi usada de verdade"_                                                                                                                      |
| `DO-03` | As decisões de produto, clínicas e de dado pessoal são tomadas por **quatro pessoas**: o dono do produto, o chefe, a chefa e o **farmacêutico**.                                                                                                                                  | dono do produto · 20/08/2026 | _"eu, meu chefe, minha chefa e o farmaceutico ficam a par dessas questões"_                                                                                  |
| `DO-04` | A inteligência do VidAI deve ser preservada **idêntica**, em Python. Não há tempo para refazer a rodada de treinamento e testes que o VidAI já fez.                                                                                                                               | dono do produto · 20/08/2026 | _"tem que estar em python e ser 'idêntico' ao que existe no vid-ai pq não temos o tempo de fazer toda rodada de treinamento e testes que fizemos no vid-ai"_ |

| `DO-05` | **ADR-0001 aprovada.** O motor de IA roda em Python, na **mesma máquina** da BeHemp, como serviço próprio consumido por HTTP interno. | dono do produto · 20/08/2026 | _"que bom que podemos manter a infraestrutura com essas técnicas inclusive quero que você registre a adr pois é isso que faremos"_ · _"será tudo na mesma maquina"_ |
| `DO-06` | **A ordem de execução muda.** Primeiro as telas e o "backend dos botões"; a conexão com IA, RAG e arquivos complementares fica **inteiramente** para a segunda metade das sprints, depois do upgrade de RAM na AWS. | dono do produto · 20/08/2026 | _"as sprints iniciais focarão em design, front end e backend dos botões e outros, a segunda metade das sprints são inteiramente voltadas à conexão dessas telas com a IA, RAG, e os outros arquivos"_ |
| `DO-07` | O design da UI importada deve ficar **muito superior** ao do VidAI, adaptado às cores da BeHemp. Critério tornado verificável em [ADR-0003](../docs/adr/ADR-0003-a-ui-importada-nasce-no-sistema-visual-da-behemp.md) D-03. | dono do produto · 20/08/2026 | _"com design MUITO superior ao vid-ai"_ · _"são dois escopos diferentes do mesmo nicho"_ |

| `DO-08` | A IA opera no escopo **máximo**: levanta **hipóteses e conduta**, direcionada ao **canabidiol** — não apenas estrutura o que o médico ditou. Aprovação humana (HITL) é obrigatória em toda saída. | dono do produto · 20/08/2026 | _"hipótese + conduta só que voltada para o ramo de canabidiol"_ |
| `DO-09` | O **farmacêutico não é papel na plataforma.** Valida conteúdo clínico e corpus **fora** do sistema. O `userRoleEnum` permanece com 3 valores. | dono do produto · 20/08/2026 | resposta _"Não — aprova fora da plataforma"_ |
| `DO-10` | 🔴 O módulo de **exames com IA de imagem entra no escopo** (Dual-Motor, ABCDE, viewer split, HITL de exame). | dono do produto · 20/08/2026 | resposta _"Entra — é parte do valor"_ |
| `DO-11` | A área nova mora **dentro de `app/(medico)`**. Não há sexto route group. | dono do produto · 20/08/2026 | resposta _"Dentro de (medico)"_ |

| `DO-12` | 🔴 **O que se copia do VidAI é a lógica de construção, não a stack nem as cores** — como o fluxo foi feito e **por quê**, e como é a navegação. E o recorte: a **teleconsulta da BeHemp mantém o design atual**; **anamnese, prescrição e exames** seguem a lógica de construção e de design do VidAI. | dono do produto · 20/08/2026 | _"não é a stack e sim a lógica por trás dela, como ela foi feita, porque ela foi feita assim, como é a navegação"_ · _"o design da teleconsulta continua igual na behemp mas anamnese, prescrição, exames, eles têm que seguir a mesma lógica de construção e design do vid-ai"_ |

| `DO-13` | **Exames é a última tela da Metade 1.** É tópico sensível; o dono conversa com o chefe antes de definir como proceder. | dono do produto · 20/08/2026 | _"como exames é tópico sensível ele será a última tela que criaremos, focaremos nas outras e no final eu discuto com meu chefe como vamos proceder em relação a isso"_ |
| `DO-14` | **A anamnese é preenchida só pelo médico**, como no VidAI. Não há pré-preenchimento pelo paciente nesta fase. | dono do produto · 20/08/2026 | resposta _"Só o médico, como no VidAI"_ |
| `DO-15` | A **área do paciente** recebe três coisas: **diário de sintomas / check-in**, **acompanhamento de dose e titulação** e **resumo de saúde sanitizado**. | dono do produto · 20/08/2026 | seleção múltipla · _"creio que como o design foi projetado na tela é o mais interessante"_ |
| `DO-16` | Conduta → prescrição → dosagem → titulação são **sequenciais**, não alternativas. | dono do produto · 20/08/2026 | _"acho que a 1 e a segunda são sequenciais não?"_ — registrado em [ADR-0005](adr/ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md) |
| `DO-17` | **Dúvida de regra de negócio → perguntar. Dúvida de programação → rodada de pesquisa, apresentando opções comparadas.** Vale como regra permanente de trabalho. | dono do produto · 20/08/2026 | _"se tiver uma dúvida de 'REGRA DE NEGOCIO' você me pergunta agora, se for relacionada a programação, você deve fazer uma rodada de pesquisa e me apresentar diferentes opções comparando elas (isso até deveria virar regra no claude.md)"_ — virou regra no `CLAUDE.md` |
| `DO-18` | **O portão de qualidade entra no CI em dois lugares:** `ci.yml` (PR e push de branch) **e** enxertado no `deploy.yml`, antes do build. | dono do produto · 20/08/2026 | escolha entre 4 opções comparadas, na execução da Sprint 0 — _"push direto em main não passa por PR"_. Autorização escrita em `.claude/autorizacoes.txt` |
| `DO-19` | **Os dois guardas dos hooks ficam**: o `.sh` e o `.ts` convivem indefinidamente. O `.sh` roda **sem `node_modules`**. | dono do produto · 20/08/2026 | escolha _"manter os dois indefinidamente"_. Consequência implementada: caso de **paridade** no guarda em Vitest, que fica vermelho nomeando o caso que faltar |
| `DO-20` | **Nada é commitado sem ordem expressa do dono**, mesmo com o trabalho pronto e verde. | dono do produto · 20/08/2026 | _"sem commit ate eu mandar"_ |
| `DO-21` | **O TURN da teleconsulta é a Cloudflare Realtime TURN**, com credencial efêmera gerada no servidor. | dono do produto · 20/08/2026 | _"eu gostei da escolha agora que você me explicou bem melhor (…) eu aprovo a decisão tomada, seguiremos com a claudflare"_ — [ADR-0008](adr/ADR-0008-turn-contratado-para-a-midia-da-teleconsulta.md) |
| `DO-23` | ✅ **VERSÃO FINAL do consentimento:** o aceite é bloqueante para a **transcrição e a IA**, **não** para a consulta. Botão grande, aviso explícito, aceite dos **dois** lados. A videochamada tem base legal própria — LGPD art. 11, II, "f" (tutela da saúde, em procedimento realizado por profissional de saúde), que dispensa consentimento. | dono do produto · 20/08/2026 | _"temos que sermos inteligentes e estratégicos (…) por isso a estratégia de remediação contra lgpd tem que ser criativa e palpável"_ — **substitui `DO-22`**, que fica registrada na [ADR-0007](adr/ADR-0007-consentimento-da-gravacao-de-teleconsulta.md) D-03 |
| `DO-24` | **Cinco medidas repetíveis de desfecho:** dor (0–10) · qualidade do sono · ansiedade/humor · qualidade de vida global · frequência de crises/espasmos. | dono do produto · 20/08/2026 | responde `GAP-12`. As duas primeiras já existem no schema; as três novas usam 0–10 por consistência, e crises guarda **contagem + período** para não presumir a janela |
| `DO-25` | **Dois sinais vitais**, opcionais: **pressão arterial** e **peso**. Os outros 6 do VidAI ficam fora. | dono do produto · 20/08/2026 | responde `GAP-13`. PA interage com hipotensores; peso é a referência de dose por kg. Campo sem consumidor é coleta sem finalidade |
| `DO-26` | **O rastreio do uso do medicamento substitui o boolean `usoPrevioCannabis`:** produto, proporção CBD:THC, dose atual, via, desde quando, efeito percebido, efeito adverso, origem — **e adesão**, o que o paciente de fato tomou. | dono do produto · 20/08/2026 | _"além de perguntas clínicas padrão tem que ter o rastreio do uso do remédio"_. Adesão em tabela própria: `dosagens` guarda o **prescrito**, e sobrescrever isso perderia a base de comparação da titulação |
| `DO-27` | 🔴 **O PRIMEIRO USO é caminho de primeira classe, não o "não" de uma pergunta.** A tela ramifica: nunca usou → expectativa e receio; já usa → o rastreio de `DO-26`. | dono do produto · 20/08/2026 | _"nem todo paciente que chegar já usa medicação, temos que nos preparar para esses que são o primeiro uso, ainda mais se o paciente está vindo para fazer a consulta médica para conseguir o remédio"_ |
| `DO-28` | ⛔ **Fora de escopo agora:** fluxo de comprovação de renda / medicamento gratuito. | dono do produto · 20/08/2026 | _"que já existe no sistema, se não existir ainda não é nosso dever fazer agora"_. **Medido:** a página `programa-acesso-solidario` é institucional (zero formulário) e `pacientes.rendaFamilia` é texto livre sem elegibilidade. **Não existe** — logo, não se faz |
| `DO-29` | 🔴 **O que a IA clínica faz, definido pelo dono:** dá o **diagnóstico direcionado ao canabidiol**, recomenda o **medicamento** mais adequado ao que foi preenchido, e oferece **3 hipóteses** ao médico com argumentação estruturada como no VidAI — específica a cannabis. **Nunca substitui o médico:** ajuda no diagnóstico e na análise, e **toda ação dela exige confirmação humana (HITL)**. | dono do produto · 20/08/2026 | _"ela dará os diagnosticos baseado no ramo de canabidiol recomendando o melhor médicamento (…) oferecendo 3 hipoteses para o médico com suas argumentações estruturada como no vid-ai mas especifica ao ramo de cannabis, nunca substituindo o médico e sim o ajudando (…) aonde toda ação dela precisa de uma confirmação human in the looping"_ |
| `DO-30` | ⛔ **Não criar documento visual (página, artifact, relatório desenhado) a menos que o dono peça.** | dono do produto · 20/08/2026 | _"não crie documentos como esse ao menos que eu peça"_. O que foi pedido fica em `docs/decisoes-visuais/` |
| `DO-31` | 🔴 **Toda base pesquisada entra em regra de negócio, com ID citável, no mesmo movimento da pesquisa.** Pesquisa que não vira regra se perde. | dono do produto · 20/08/2026 | _"sobre essas bases que estamos utilizando todas tem que estarem sendo postas em regras de negócio sempre que nós pesquisarmos"_ |
| `DO-32` | 🔴 **`docs/decisoes-visuais/ia-clinica-e-anvisa.html` é leitura obrigatória antes de cada sprint.** | dono do produto · 20/08/2026 | _"é estreitamente importante que esse doc seja lida sempre que nós formos fazer alguma sprint"_ |
| `DO-33` | **As telas de evidência, hipóteses e prescrição seguem o desenho aprovado** no documento visual — o layout "que informa", não o "que dirige". | dono do produto · 20/08/2026 | _"eu concordo totalmente com o desenho apresentado no documento"_ · _"em anamnese nós já devemos criar o layout das evidências, prescrição e etc como foi desenhado"_ |
| `DO-34` | **Migration pode ser aplicada em localhost**, em banco local dedicado — nunca no Neon, nunca a partir de `main`. | dono do produto · 20/08/2026 | _"você pode aplicar contanto que esteja em localhost, não esteja na main ou não suba para neon"_. Container `behemp-postgres-dev` na porta 5436, criado para isto |
| `DO-35` | ⛔ **Não reformatar arquivo de produção que não precisa mudar.** Mudar só as linhas do conteúdo; formatador em arquivo inteiro só se o arquivo for novo, ou em tarefa própria. | dono do produto · 20/08/2026 | _"não faça isso, tem que manter o mesmo padrão de produção, alterar essas coisas é mudança de padrão já existente e pode dar problema para mim"_. Incidente: `GlobalTeleconsultaHost.tsx` com **+755/−644** para ~40 linhas de conteúdo, por reordenação de classe Tailwind |
| `DO-36` | **Cada hipótese mostra até 3 medicamentos ranqueados**, com o porquê da posição. | dono do produto · 24/08/2026 | _"ao clicar em uma das hipoteses (…) tem que aparecer a médicação daquele caso (…) vamos colocar no maximo 3 remedios por hipotese ranquando qual é melhor e porque mantendo o design"_ — desenho e fronteira regulatória em [ADR-0009](adr/ADR-0009-recomendacao-de-medicamento-informa-sem-posologia.md) |
| `DO-37` | **Cada opção da tela "Sua decisão" tem botão que expande a MESMA evidência do painel**, para o médico revisar na hora de decidir. | dono do produto · 24/08/2026 | _"em Sua decisão deve ter um botão dentro de cada uma das opções na qual vai expandir e mostrar o mesmo dado que há em 'Hipóteses sugeridas pela IA' (…) para o médico querer revisar nessa parte do processo"_ — ADR-0009 D-05/D-06 |
| `DO-38` | **O preview fica, e separado por perfil**, com switch Médico · Paciente · Admin. | dono do produto · 24/08/2026 | _"eu gostei muito do jeito do preview de apresentar, já que você me garantiu que é confiável prefiro manter assim"_ · _"pra deixar organizado eu preferia separar tipo, essa aqui é tela do médico, quando formos para a do paciente tem que ter um botão swich a mesma coisa pro ADMIN"_ |
| `DO-39` | 🔴 **A análise assistida entra como MAIS UMA ABA no sidebar da teleconsulta**, com as etapas dentro dessa mesma aba. **O design do sidebar não se altera** — é do chefe. | dono do produto · 24/08/2026 | _"ele é mais uma aba no sidebar da teleconsulta, não vamos fugir desse design que meu chefe fez, isso se torna uma nova aba em etapas dentro dessa mesma aba"_ |
| `DO-40` | 🔴 **Divergir alimenta o RAG.** Ao divergir, o médico pode escrever (opcional) **por que a IA errou**, e informa **qual medicamento vai prescrever**. Os dois viram insumo do RAG. | dono do produto · 24/08/2026 | _"a hipotese manual em divirjo ela tem que ter também a alimentação do rag ou seja precisa de um texto explicando porque a ia errou (opcional) além de ter também o medicamento na qual o médico vai prescrever"_ |
| `DO-41` | 🔴 **O rascunho da revisão é obrigatório e tem histórico**, como no VidAI — o médico pode sair sem querer e o dado não pode se perder. | dono do produto · 24/08/2026 | _"no E7 nós precisamos fazer isso pois o médico pode sair sem querer e esse dado precisa ficar salvo, ou seja precisa ter um historico assim como tem no vid-ai"_ |
| `DO-42` | 🔴 **Os gatilhos de urgência entram na tela, e a anamnese precisa ser específica** — para evitar que medicamento errado seja prescrito, tanto por erro humano quanto por falta de gatilho para a IA. | dono do produto · 24/08/2026 | _"o E8 também precisa entrar ainda mais no quesito prescrição de médicamento por isso a anamnese precisa ser bem especifica para evitar que medicamentos errados sejam prescritos pela IA para evitar erro humano e evitar que a IA erre justamente por falta desses gatilhos, ou seja precisamos disso na tela"_ |
| `DO-43` | **A Sprint 5 segue a do VidAI, adaptada ao escopo de cannabis.** | dono do produto · 24/08/2026 | _"vamos fazer parecido com a do vidai so que adaptada para o escopo de cannabis"_ |
| `DO-44` | 🔴 **RESOLVE `GAP-14` — ajuste de dose.** O médico **pode** ajustar. Mas: (a) o ajuste é **notificado ao paciente**; (b) a dosagem/medicamento **anterior fica no histórico** — do paciente **e** do histórico de prescrições **sob o nome do paciente**; (c) a tela **separa por paciente**, com um **filtro geral** que mostra todos os medicamentos prescritos; (d) desenho **intuitivo e não sobrecarregado**. | dono do produto · 24/08/2026 | _"o médico pode ajustar claro, mas isso tem que ser notificado pelo paciente e a dosagem ou medicamento anterior tem que ficar no historico tanto do paciente quanto no historico de prescrições dentro do nome do paciente, creio que o certo era separar por paciente além de ter o filtro de geral aonde vê todos os medicamentos prescritos, tem que ta bem desenhado intuitivo e nada muito cheio pra nao bagunçar a mente do médico"_ |
| `DO-45` | **Transcrever as RDC 327/2019, 660/2022 e 1.000/2025 agora**, não depois. | dono do produto · 24/08/2026 | _"faça isso, temos que ter essas pesquisas se não ficamos atrás"_ |
| `DO-46` | 🔴 **O teor de THC quem preenche é o MÉDICO, não o sistema** — e levantar os teores do catálogo Greens está **fora do escopo** desta sprint: fica com o chefe, junto da implementação de IA. Nosso trabalho é **construir a tela onde isso ficará**. | dono do produto · 25/08/2026 | _"Isso ficará junto com a implementação das IA com meu chefe, essas questões são fora do nosso escopo, o nosso foco é construir a tela aonde isso ficará, além de que isso é algo que o 'MÉDICO' preenche não o SISTEMA."_ — **reverte** a leitura de que a tela **derivaria** o tipo de receituário (entregável 9 da Sprint 5). Ver [ADR-0012](adr/ADR-0012-o-sistema-avisa-o-medico-decide-na-cadeia-da-conduta.md) |
| `DO-47` | 🔴 **RESOLVE a pergunta aberta da ADR-0005 D-03.** Ajuste que troca o produto para outra faixa de THC — e portanto muda o tipo de receituário (`CAN-04`) — **continua opcional, com aviso**. O sistema avisa; quem segue o procedimento é o médico. | dono do produto · 25/08/2026 | _"isso é opcional com aviso, o médico quem deve seguir o procedimento correto, o sistema avisa."_ — [ADR-0005](adr/ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md) D-03, **terceira versão** |
| `DO-48` | **A tela de dosagem que já existe (`tab-dosagem.tsx`) convive com a nova e vira somente leitura** do histórico já digitado. O caminho novo é o único que aceita dado novo. | dono do produto · 25/08/2026 | _"Vamos na opção B."_ — em resposta a: _"(b) as duas convivem, e a antiga vira só leitura do histórico"_ |
| `DO-49` | **A aba nova do sidebar da teleconsulta chama `IA Clínica`** — o mesmo rótulo do item no sidebar principal do médico. Consistência de nomenclatura entre as duas superfícies. | dev Davi · 25/08/2026 | escolhido entre 4 opções comparadas ("Análise IA", "Análise assistida", "IA Clínica", "Hipóteses") — fecha a pendência da [ADR-0010](adr/ADR-0010-analise-assistida-e-uma-aba-do-sidebar-da-teleconsulta.md) §4 |
| `DO-50` | **A aba entra por ÚLTIMO**, depois de Prescrição. Nenhuma aba existente muda de posição. | dev Davi · 25/08/2026 | escolhido entre 3 opções — preserva a memória muscular do médico e é o menor risco de mexer no design do sidebar, que é do chefe (`DO-39`) |
| `DO-51` | 🔴 **A urgência tem 4 níveis, e o 4º NÃO vem de `urgencia`** — vem de `red_flags_nao_explicadas > 0` combinado com emergência. O contrato só sustenta 3 níveis a partir de `UrgenciaAnalise`; o 4º é **derivado de outro campo que já existe**. | dev Davi · 25/08/2026 | escolhido entre 3 opções, depois de eu medir que o mapa é **7→3** e não 7→4 — o "código roxo" de 4 níveis que eu havia escrito veio do VidAI, não do nosso contrato |
| `DO-52` | 🔴 **A Sprint 6 (área do paciente) só começa DEPOIS do QA e da visualização das telas.** A ordem passa a ser: mapear os dados → seeds → QA de ponta a ponta → visualizar as telas → GAPs + transcrições → Sprint 6. | dev Davi · 25/08/2026 | _"a área do perfil do paciente fica após QA das telas e visualização das telas"_ · _"são muitas etapas em sequencia antes de iniciarmos"_ |
| `DO-53` | 🔴 **O QA vem junto com SEEDS, e antes dos seeds vem o MAPEAMENTO dos dados.** Sem dado no sistema os bloqueios de fluxo impedem testar — paciente sem triagem não chega à teleconsulta, sem conduta não há titulação. | dev Davi · 25/08/2026 | _"o qa vem junto com seeds para podermos termos dados no sistema se não os bloqueios não deixarão a gente testar completamente, logo antes mesmo do qa tem todo mapeamento dos dados que entrarão no seeds para fins de testes completo das sprints de ponta a ponta"_ |
| `DO-54` | **Os `GAP-nn` viram UM cartão só** no Trello, não um por GAP. | dev Davi · 25/08/2026 | _"os gaps (que nos vamos englobar em um card so)"_ |
| `DO-55` | **As transcrições de norma precisam ser pesquisadas E referenciadas no código** — não basta a linha no catálogo; o ID tem de aparecer onde a regra é aplicada. | dev Davi · 25/08/2026 | _"as transcirções que nos temos que pesquisar e referenciar no código"_ |
| `DO-56` | 🔴 **Texto de cartão do Trello é para HUMANO, não para quem tem o código aberto.** Cada cartão explica: por que foi feito assim, qual decisão foi tomada, **em que tela aparece**, e **como impacta** paciente, médico, admin ou vários. Referência a doc e índice **fica** (ajuda a buscar no código), mas nunca substitui a explicação. | dev Davi · 25/08/2026 | _"os textos não podem ficar em aberto, eles tem que ter a lógica textual das implementações evitando que o meu chef dev (gabriel) e a outra dev (dryelle) peguem textos incompletos com referencias que so dariam para entender olhando o código, tem que estar tudo explicado"_ |
| ~~`DO-22`~~ ⛔ substituída por `DO-23` | 🔴 **O consentimento LGPD é BLOQUEANTE e dos DOIS lados** — paciente **e** médico. Sem os dois, a sala não abre. O botão é **grande e destacado**. | dono do produto · 20/08/2026 | _"temos que deixar o botão de consentimento bem grande e com bloqueio na teleconsulta, se nem o médico e o paciente fizerem isso, não terá a teleconsulta, temos que nos proteger da lgpd por completo"_ — **inverte** a D-03 original da [ADR-0007](adr/ADR-0007-consentimento-da-gravacao-de-teleconsulta.md), que fica registrada |

⚠️ `DO-01` é a única base registrada para usar o código do VidAI, e ela **contradiz o aviso de
copyright do próprio repositório de origem**. Registrada como decisão do dono, com a frase e a
data, exatamente para que ninguém a reabra por conta própria nem a trate como verificada.

### Normas transcritas — CFM (20/08/2026)

🔴 **Transcritas de fonte primária**, dos PDFs oficiais em `sistemas.cfm.org.br`. O que está
abaixo foi **lido**, não localizado.

⚠️ **CORREÇÃO DO CATÁLOGO:** este documento atribuía _"teleconsulta e responsabilidade do ato
médico"_ à **CFM 2.299/2021**. Está errado. Os objetos reais, no texto oficial:

| norma              | objeto, textual                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **CFM 2.299/2021** | _"Regulamenta, disciplina e normatiza a emissão de **documentos médicos eletrônicos**"_                             |
| **CFM 2.314/2022** | _"Define e regulamenta a **telemedicina**, como forma de serviços médicos mediados por tecnologias de comunicação"_ |

A norma da teleconsulta é a **2.314/2022** — posterior, e não citada no plano até agora. A 2.299
vale para o **receituário** (Sprint 5), não para a Sprint 4.

| ID       | o que a norma diz                                                                                                                                                                                                                                                                                           | artigo                        | consequência no produto                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `CFM-01` | 🔴 _"O paciente ou seu representante legal **deverá autorizar** o atendimento por telemedicina e a transmissão das suas imagens e dados por meio de (termo de concordância e autorização) consentimento, livre e esclarecido (…) devendo fazer parte do **SRES** do paciente."_                             | **2.314, Art. 15**            | **o consentimento da teleconsulta é OBRIGATÓRIO** — por norma ética, não por LGPD. E tem de ficar no prontuário                |
| `CFM-02` | _"Em todo atendimento por telemedicina deve ser assegurado consentimento **explícito**, no qual o paciente (…) deve estar consciente de que suas informações pessoais podem ser compartilhadas e sobre o seu **direito de negar** permissão para isso, **salvo em situação de emergência médica**."_        | **2.314, Art. 15, § único**   | o aceite é explícito, informa o compartilhamento, e a recusa é um direito. **Emergência é a única exceção**                    |
| `CFM-03` | _"O médico deve destacar e registrar que se trata apenas de uma **impressão diagnóstica** e de gravidade, o médico tem autonomia da decisão de qual recurso será utilizado (…) não se confundindo com consulta médica."_                                                                                    | **2.314, Art. 11, §1º**       | 🎯 **fundamenta a Sprint 4**: a saída da IA é **impressão**, nunca diagnóstico — e registrar isso é obrigação, não boa prática |
| `CFM-04` | _"A autonomia médica está diretamente relacionada à **responsabilidade pelo ato médico**."_                                                                                                                                                                                                                 | **2.314, Art. 4º, §2º**       | fundamenta o HITL: quem responde é quem decide. Sistema que decide sozinho transfere responsabilidade sem transferir autonomia |
| `CFM-05` | _"Ao médico é assegurada a autonomia de decidir se utiliza ou recusa a telemedicina, indicando o atendimento presencial sempre que entender necessário."_                                                                                                                                                   | **2.314, Art. 4º**            | o médico pode recusar a via remota. A plataforma não pode forçar teleconsulta                                                  |
| `CFM-06` | _"O atendimento por telemedicina deve ser **registrado em prontuário** médico físico ou (…) em Sistema de Registro Eletrônico de Saúde (SRES)"_, atendendo a **NGS2** no padrão **ICP-Brasil**.                                                                                                             | **2.314, Art. 3º, §1º e §2º** | o registro é obrigatório, e o SRES tem requisito técnico de segurança nomeado                                                  |
| `CFM-07` | Para relatório, atestado ou prescrição à distância, consta **obrigatoriamente** em prontuário: identificação do médico com CRM e endereço · identificação e dados do paciente com local do atendimento · **data e hora** · **assinatura ICP-Brasil** · **e que foi emitido em modalidade de telemedicina**. | **2.314, Art. 13**            | 🎯 **checklist literal para a Sprint 5**. O item (e) é o mais fácil de esquecer                                                |
| `CFM-08` | _"Os serviços médicos a distância **jamais poderão substituir** o compromisso constitucional de garantir assistência presencial."_                                                                                                                                                                          | **2.314, Art. 19**            | a teleconsulta é complemento, não substituição                                                                                 |

### Normas transcritas — LGPD, arts. 8º, 9º e 11 (20/08/2026)

**Fonte primária.** É o checklist literal do que um termo de consentimento precisa dizer.

| ID        | o que a norma exige                                                                                                                                                                                                                                                                                                                                                                | artigo             | no produto                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LGPD-01` | O titular tem direito a informação _"clara, adequada e ostensiva"_ sobre: **I** finalidade específica · **II** forma e duração · **III** identificação do controlador · **IV** contato do controlador · **V** uso compartilhado **e a finalidade** · **VI** responsabilidades dos agentes · **VII** direitos do titular, _"com menção explícita aos direitos contidos no art. 18"_ | **art. 9º, I–VII** | os **sete** entram no texto do consentimento. Faltar um é faltar informação devida                                                                        |
| `LGPD-02` | 🔴 _"o consentimento será considerado **nulo** caso as informações fornecidas ao titular tenham conteúdo enganoso ou abusivo"_                                                                                                                                                                                                                                                     | **art. 9º, §1º**   | texto vago ou que promete menos do que o sistema faz **anula o aceite** — é o motivo de o texto descrever as duas saídas externas, e não só "transcrição" |
| `LGPD-03` | _"o controlador deverá informar previamente o titular sobre as mudanças de finalidade"_                                                                                                                                                                                                                                                                                            | **art. 9º, §2º**   | finalidade nova ⇒ **versão nova** do texto e aceite novo. É o que `consentimentoVersaoTexto` existe para permitir                                         |
| `LGPD-04` | Quando o tratamento é condição para o serviço, _"o titular será informado **com destaque** sobre esse fato"_                                                                                                                                                                                                                                                                       | **art. 9º, §3º**   | o consentimento de teleconsulta **é** condição para o atendimento remoto — então o texto diz isso com destaque                                            |
| `LGPD-05` | Dado sensível (saúde) por consentimento exige que ele seja **específico e destacado**, para finalidades também específicas                                                                                                                                                                                                                                                         | **art. 11, I**     | por isso são **dois** consentimentos separados, e não um genérico                                                                                         |

⚠️ **O art. 18 é citado no texto do consentimento por exigência do `LGPD-01` inciso VII**, com os
direitos nomeados — não basta remeter ao número.

### 🔴🔴 Normas transcritas — ANVISA RDC 657/2022 (SaMD), lida em 20/08/2026

**Fonte primária:** texto oficial em `anvisalegis.datalegis.net`. **Esta norma não estava no plano
até 20/08** — foi encontrada ao aplicar a regra de esgotar as fontes do domínio, depois de o
incidente do consentimento mostrar que uma norma só não fecha a questão.

| ID       | o que a norma diz, textual                                                                                                                                                                                                                                                                                                                                   | artigo                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `ANV-01` | _"Esta Resolução dispõe sobre a regularização de **software como dispositivo médico** (Software as a Medical Device - SaMD)."_                                                                                                                                                                                                                               | **657/2022, Art. 1º** |
| `ANV-02` | _"software como um dispositivo médico (…): Software que atende à definição de dispositivo médico (…) sendo destinado a **uma ou mais indicações médicas**, e que realizam essas finalidades sem fazer parte de hardware de dispositivo médico."_                                                                                                             | **Art. 2º, VII**      |
| `ANV-03` | **Não** são abrangidos os softwares: _"para bem-estar"_ · de lista de não regulados da Anvisa · _"utilizado **exclusivamente** para gerenciamento administrativo e financeiro"_ · _"que processa dados médicos demográficos e epidemiológicos, **sem qualquer finalidade clínica diagnóstica ou terapêutica**"_ · embarcado em dispositivo já sob vigilância | **Art. 1º, § 2º**     |
| `ANV-04` | _"O SaMD deve ser **enquadrado nas regras e classes** de acordo com a (…) RDC nº 185, de 22 de outubro de 2001, ou regulamentos posteriores."_                                                                                                                                                                                                               | **Art. 4º**           |

#### 🔴 O que isso significa para esta demanda

O módulo de IA clínica desta demanda **sugere hipóteses diagnósticas ranqueadas** e **fornece
informação para decisão clínica**. Confrontado com o `ANV-03`, **não se encaixa em nenhuma
exclusão**: não é bem-estar, não é administrativo-financeiro exclusivo, e tem finalidade clínica
diagnóstica declarada.

**Leitura direta do texto:** o produto, quando o motor estiver ligado, tende a ser **SaMD** — e
SaMD exige **regularização** na ANVISA, com classe determinada pela RDC 185/2001 (`ANV-04`).

⚠️ **Isto é leitura do texto, não parecer regulatório.** Enquadramento e classe são determinação
de **Assuntos Regulatórios**, não de engenharia. O que a engenharia pode afirmar é o que está
acima: o escopo alcança, e a exclusão não cobre.

🎯 **A boa notícia, e ela é consequência acidental da ADR-0002:** o que existe **hoje** no
repositório não analisa nada — o motor não está ligado, e as telas sem motor não têm finalidade
diagnóstica em operação. **Há tempo para resolver antes de o risco existir.** Se a ordem tivesse
sido "motor primeiro", o produto já estaria operando como dispositivo médico não regularizado.

⚠️ **Ainda não transcritas:** a RDC 185/2001 (classes, necessária para o enquadramento de
`ANV-04`) e a CFM 2.299/2021 na parte de documento eletrônico — desta última só o **objeto** foi
lido.

### 🔴 Produtos de Cannabis — RDC 1.015/2026 (a 327/2019 está REVOGADA)

Transcrito em 24/08/2026 por ordem do dono (`DO-45`). **E a primeira coisa que a transcrição
achou foi um erro nosso:** este catálogo, o plano de sprints e a Sprint 5 citavam a **RDC
327/2019** como a norma de produtos de Cannabis. Ela **não vale mais**.

> `CAN-00` — _"Fica revogada a Resolução da Diretoria Colegiada - RDC nº 327, de 9 de dezembro
> de 2019, publicada no Diário Oficial da União nº 239, de 11 de dezembro de 2019, Seção 1,
> pág. 194."_ — **RDC 1.015/2026, Art. 76**

É o segundo caso da mesma classe: em 20/08 a teleconsulta estava atribuída à CFM 2.299/2021,
cujo objeto é outro. Agora, uma norma **revogada**. A regra do `CLAUDE.md` — _conferir o objeto
da norma antes de citá-la_ — precisa de um segundo passo: **conferir se ela ainda está em
vigor**.

| ID       | o que a norma diz, textual                                                                                                                                                                                                                                                                                           | artigo                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `CAN-01` | _"Dispõe sobre a Autorização Sanitária para fabricação e importação de produtos de Cannabis para uso medicinal humano e estabelece requisitos relativos à sua comercialização, e dá outras providências."_                                                                                                           | **1.015/2026**, ementa  |
| `CAN-02` | 🔴 _"A prescrição dos produtos de Cannabis é restrita aos profissionais médicos e cirurgiões-dentistas **que acompanham clinicamente o paciente** e estejam legalmente habilitados pelos seus respectivos Conselhos de Classe (…)"_                                                                                  | **Art. 36**             |
| `CAN-03` | 🔴 _"O **nome completo do produto** de Cannabis e a sua **concentração**, conforme a Autorização Sanitária concedida pela Anvisa, devem ser descritos na prescrição."_                                                                                                                                               | **Art. 37, caput**      |
| `CAN-04` | 🔴 _"Para produtos de Cannabis com teor de THC **menor ou igual a 0,2%** deve ser utilizada a **Receita de Controle Especial** (…). Para produtos de Cannabis contendo **acima de 0,2% de THC**, a prescrição deve ser acompanhada da **Notificação de Receita 'A'** (…)"_ — Portaria SVS/MS 344/1998                | **Art. 37, §§ 1º e 2º** |
| `CAN-05` | 🔴 _"Os produtos de Cannabis podem conter THC em concentração **acima de 0,2%** quando desenvolvidos **exclusivamente para o tratamento de pacientes portadores de doenças debilitantes graves**, conforme definição dada pela RDC nº 38, de 12 de agosto de 2013, e suas atualizações, **ou que ameacem a vida**."_ | **Art. 5º**             |
| `CAN-06` | _"Os produtos de Cannabis devem conter, como IFA ou IFAV, **exclusivamente o fitofármaco CBD ou o extrato obtido a partir de quimiotipo CBD-dominante** de Cannabis sativa L."_                                                                                                                                      | **Art. 4º**             |

#### 🔴 O que `CAN-04` e `CAN-05` mudam nas nossas telas — e é muito

**1. O tipo de receituário é função do teor de THC do produto.** Não é escolha do médico nem
configuração: ≤ 0,2 % → Receita de Controle Especial; > 0,2 % → **Notificação de Receita "A"**.
A tela de conduta (Sprint 5) precisa **derivar** isso do produto escolhido, e o schema
`medicamentos` precisa carregar o teor de THC para que a derivação seja possível.

**2. THC acima de 0,2 % tem indicação restrita.** Só para doença **debilitante grave** ou que
ameace a vida. Isso é exatamente o gatilho que o `DO-42` pede: a tela precisa impedir que uma
opção com THC alto seja oferecida sem que a condição se qualifique.

⚠️ **Isto atinge o nosso próprio fixture de exemplo.** Ele sugere `CBD:THC 1:1` — muito acima de
0,2 % — para polineuropatia diabética dolorosa. Se essa condição se qualifica como "debilitante
grave" pela RDC 38/2013 é **determinação clínica**, não presunção de engenharia. O fixture ficou
com a ressalva escrita; a **RDC 38/2013 ainda não foi lida** e entra na fila.

**3. `CAN-02` alinha com o que já construímos.** Só prescreve quem **acompanha clinicamente** o
paciente — que é exatamente o escopo de objeto do `garantirMedicoDoPaciente`, já usado nas 5
actions da anamnese. A norma confirma o padrão, não o contradiz.

#### 🔴 RETIFICAÇÃO, 25/08/2026 — `DO-46` e `DO-47` mudam **quem** aplica o `CAN-04`

Os pontos **1** e **2** acima escreveram _"a tela precisa **derivar** isso do produto"_ e _"a tela
precisa **impedir** que uma opção com THC alto seja oferecida"_. **A norma continua valendo
inteira; o que muda é o agente.** O dono decidiu que o teor é **campo do médico**, e que diante de
divergência **o sistema avisa em vez de impor**:

| o que eu escrevi                                   | o que vale, por `DO-46` + `DO-47`                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| a tela **deriva** o tipo de receituário do produto | o **médico preenche** o teor; a tela **calcula o aviso** e mostra o tipo que corresponde |
| a tela **impede** a oferta                         | a tela **avisa**; a decisão e a responsabilidade são do médico                           |

**Por que isto não é afrouxar a norma.** A `RDC 1.015/2026` obriga **a prescrição** a usar o
receituário certo — ela dirige o **ato médico**, não o software. Um sistema que derivasse o tipo
sozinho a partir de um campo que ninguém preencheu estaria **afirmando um fato regulatório que não
tem**, e um que travasse a oferta estaria **dirigindo a conduta** — que é exatamente a fronteira
`IMD-01` × `IMD-02` (informar × dirigir) e a proibição nº 2 do `CLAUDE.md`. Avisar informa sem
dirigir, e mantém o ato humano registrado.

⚠️ **O `CAN-05` (THC > 0,2 % só para doença debilitante grave) NÃO foi perguntado ao dono.** A
lógica de `DO-46` + `DO-47` sugere que também seja aviso, mas **sugestão não é decisão** — a
pergunta vai ao dono antes do entregável 10 da Sprint 5, junto com a leitura da RDC 38/2013.

⚠️ **E o cálculo que motivou a pergunta fica registrado**, porque ele não some com a decisão: pelo
seed real (`db/seed-produtos.ts:6-14`), o **Greens MED 6300mg Full Spectrum** tem
`0,330 mg/gota × 900 gotas ÷ 30 ml ≈ 9,9 mg/ml` — cerca de **0,99 % (m/v)**, ou ~1,1 % se a base
for m/m com densidade ~0,9. **Nas duas leituras plausíveis o produto passa de 0,2 %.** Isto **não
é conclusão regulatória** — `CAN-03` diz que a concentração válida é a da **Autorização Sanitária**
— mas é o motivo pelo qual o campo de teor **existe na tela** e não sai de um cálculo nosso.

### 🔴 Validade da receita — as duas normas respondem coisas diferentes (10/09/2026)

**Levantado pelo lado da Greens durante a integração**, e confirmado por pesquisa aqui. Não é
divergência de opinião: são **dois caminhos regulatórios distintos**, e o mesmo papel tem
resposta diferente em cada um.

| ID       | o que a norma diz                                                                                                                                                                                           | fonte                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `VAL-01` | Para **dispensação em farmácia**, a receita de produto de Cannabis tem **validade de 30 dias** — Receita de Controle Especial, produtos até 0,2 % de THC                                                    | **RDC 1.015/2026**              |
| `VAL-02` | Para **importação por pessoa física**, o que vale 2 anos é o **cadastro/autorização**, não a receita. A norma lista o conteúdo obrigatório da prescrição (Art. 7º) e **não declara prazo de validade dela** | **RDC 660/2022**, Arts. 7º e 8º |

⚠️ **O nosso código diz 6 meses, e esse número não tem fonte.**
`lib/documentos/validade.ts` usa `receita_medica: +6 meses`. A pesquisa de 10/09/2026 **não
encontrou norma que sustente 6 meses para produto de Cannabis** — é o prazo de praxe para
receita **simples**, e produto de Cannabis não é receita simples: exige Receita de Controle
Especial ou Notificação A, conforme o teor.

### A consequência, concreta

O médico da Be4Hope emite a receita hoje. No **dia 45**, o paciente tenta comprar:

| sistema | resposta    | efeito                       |
| ------- | ----------- | ---------------------------- |
| Be4Hope | **válida**  | o paciente acredita que pode |
| Greens  | **vencida** | o despacho é **bloqueado**   |

**O mesmo documento, duas respostas opostas** — e quem descobre é o paciente, na hora da
compra. É exatamente o que a ADR-0016 D-10 previu: _"duas regras de validade em dois sistemas
divergem no primeiro ajuste, e o paciente vê respostas diferentes em cada um"_.

### 🔴 Decisão pendente do dono

Isto é **regra de negócio em matéria regulada** — não se presume (`DO-17`). As opções, com o
custo de cada uma:

| #   | opção                                                                            | custo                                                                                           |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A   | adotar **30 dias**, alinhando com `VAL-01` e com a Greens                        | o paciente vê "vencida" antes; é o que a farmácia vai dizer de qualquer jeito                   |
| B   | validade **por finalidade**: 30 dias para dispensação, sem prazo para importação | é o mais correto tecnicamente, e exige saber a finalidade no momento da emissão                 |
| C   | manter 6 meses                                                                   | **não recomendado** — sem fonte, e diverge da farmácia. Se ficar, precisa de fonte que sustente |

⚠️ **Nenhuma delas se decide sem o médico responsável.** Validade de receita é ato médico com
consequência assistencial: encurtar faz o paciente voltar mais cedo; alongar faz ele ser
recusado no balcão.

### Importação por pessoa física — RDC 660/2022

| ID       | o que a norma diz, textual                                                                                                                                                                                                  | artigo           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `IMP-01` | _"Define os critérios e os procedimentos para a **importação de Produto derivado de Cannabis, por pessoa física, para uso próprio**, mediante prescrição de profissional legalmente habilitado, para tratamento de saúde."_ | ementa e Art. 1º |
| `IMP-02` | 🔴 A prescrição contém **obrigatoriamente**: _"o nome do paciente e do produto, posologia, data, assinatura e número do registro do profissional prescritor em seu conselho de classe."_                                    | **Art. 7º**      |
| `IMP-03` | _"O cadastro é válido por **2 (dois) anos**."_                                                                                                                                                                              | **Art. 8º**      |
| `IMP-04` | _"As quantidades efetivamente importadas devem ser **compatíveis com a prescrição** do produto."_ — não há teto numérico fixo                                                                                               | **Art. 13**      |

⚠️ O texto usa _"profissional legalmente habilitado"_ de forma genérica, **sem** nomear a
categoria — diferente do `CAN-02`, que é explícito. Registrado como está: não se completa norma
com suposição.

### Receituário eletrônico e SNCR — RDC 1.000/2025

| ID       | o que a norma diz, textual                                                                                                                                                          | artigo                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `REC-01` | _"Dispõe sobre os requisitos de controle para **Notificações de Receita, Receitas de Controle Especial e Receitas sujeitas à retenção emitidas em meio eletrônico**."_              | ementa                           |
| `REC-02` | 🔴 _"Cada receituário eletrônico deve conter a **numeração individualizada previamente concedida por meio do SNCR**."_                                                              | **Art. 7º**                      |
| `REC-03` | 🔴 Os receituários eletrônicos devem _"ser subscritos com **assinatura eletrônica qualificada**"_ — definida como _"a que utiliza certificado digital emitido pela **ICP-Brasil**"_ | **Art. 8º, I** + **Art. 3º, II** |
| `REC-04` | _"O serviço de prescrição eletrônica deverá: I - **requisitar ao SNCR a numeração** necessária à emissão dos receituários eletrônicos"_                                             | **Art. 5º, I**                   |
| `REC-05` | _"SNCR: Sistema Nacional de Controle de Receituários, **instituído pela RDC nº 873, de 27 de maio de 2024**, ou norma que vier a substituí-la."_                                    | **Art. 3º, VIII**                |
| `REC-06` | _"As Receitas de Controle Especial (…) **não estão sujeitas à emissão em duas vias**."_ · _"As Notificações de Receita (…) **não precisam estar acompanhadas da receita**."_        | **Arts. 10 e 9º**                |

⚠️ **A RDC 873/2024, que institui o SNCR, ainda não foi lida** — o `REC-05` a nomeia, e ela é
quem define o funcionamento do sistema. Entra na fila junto com a RDC 38/2013.

🎯 **Para a Sprint 5:** o `REC-02` e o `REC-03` são checklist literal da ponte para a prescrição.
O que existe hoje em `lib/receituario/` **precisa ser conferido contra eles** antes de a Sprint 5
ligar a conduta à prescrição — e essa conferência é **achado a catalogar**, não conserto de
passagem.

### IMDRF — o critério que decide se a tela **informa** ou **dirige**

Pesquisado em 24/08/2026, ao desenhar a **recomendação de medicamento** dentro de cada hipótese
(pedido do dono). O `ANV-04` manda enquadrar por classe de risco, e a categorização de risco de
SaMD adotada internacionalmente vem do **IMDRF/SaMD WG/N12 FINAL:2014**. Ele define três níveis
de _significância da informação_, e a diferença entre dois deles é exatamente onde esta tela
mora. Redação confirmada em duas fontes independentes com texto idêntico.

| ID       | o que o documento diz, textual                                                                                                                                                                                                                                         | origem           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `IMD-01` | _"To **inform** clinical management: when SaMD is used to inform health care providers of **treatment options** or to aggregate relevant data to provide health care providers with clinical information."_                                                            | **N12:2014**, §5 |
| `IMD-02` | _"To **drive** clinical management: when SaMD is used to identify early signs of a disease or condition, to aid in making a conclusive diagnosis or to **aid in treatment by providing enhanced support in the safe and effective use of drugs** or medical devices."_ | **N12:2014**, §5 |
| `IMD-03` | _"To **treat or diagnose**"_ — a categoria de maior risco: o software faz a predição sobre a doença, a gravidade ou **o plano de tratamento**.                                                                                                                         | **N12:2014**, §5 |

#### 🔴 A regra de desenho que sai daí: **opção sim, posologia não**

Isto resolve uma dúvida que parecia insolúvel: o `DO-29` manda a IA _"recomendar o medicamento
mais adequado"_, e a proibição nº 2 do `CLAUDE.md` proíbe a tela de **dirigir** a conduta. As
duas coisas cabem juntas, e o `IMD-01` diz por quê:

- **Listar opções de tratamento ranqueadas, com a justificativa de cada uma, é literalmente a
  definição de `inform`** — _"inform health care providers of treatment options"_. É a categoria
  de **menor** risco das três, não uma zona cinzenta.
- **O que escala para `drive` é dose.** _"Enhanced support in the safe and effective use of
  drugs"_ (`IMD-02`) é o que descreve calcular posologia, mg, frequência, esquema de titulação
  ou checagem de interação. Uma tela que diz **quanto** dar deixou de informar.

**Portanto, no cartão de medicamento sugerido:** entra o produto, a proporção CBD:THC, por que
ele vem antes ou depois dos outros, e o que pesa contra. **Não entra** mg, frequência, nem
esquema de titulação — isso é o médico, na prescrição, e é matéria da Sprint 5.

⚠️ **`GAP-03` continua aberto e agora bloqueia dado, não desenho.** A estrutura da tela está
fundamentada; **de onde vêm os produtos** (corpus de canabidiol validado por farmacêutico) não
está decidido. Até estar, a tela mostra o que o motor mandar e **rotula a procedência** — e o
fixture do preview traz exemplo declarado como exemplo.

### Conflitos entre fontes

| ID      | conflito                                                                                                                                                                                                                                                                                                        | os dois lados                                                                                                                                         | situação                                                                                                                                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CF-01` | 🔴 **Imagem clínica enviada a provedor externo.** `DO-10` inclui exames com IA de imagem no escopo. Mas `.claude/rules/seguranca-lgpd.md` registra que _"a extração automática de documento com dado de saúde foi recusada por esse motivo em 19/08/2026"_ — porque **texto se mascara por regex, imagem não**. | **Lado A** (19/08): recusado, pois não há como mascarar PII em imagem antes de enviá-la ao LLM. **Lado B** (`DO-10`, 20/08): entra, é parte do valor. | ⚠️ **`DO-10` é mais recente e é decisão do dono, então prevalece** — mas _não_ resolve o lado A. O que o lado A levantava continua verdadeiro e **vira requisito do Jurídico** (`GAP-06`), não desaparece. A regra em `.claude/rules/seguranca-lgpd.md` **não foi editada**: alterá-la exige autorização própria. |

### Regras externas a transcrever — identificadas, **nenhuma lida ainda**

`DO-08` (hipótese + conduta) e `DO-10` (imagem clínica) trazem regulação que hoje **não existe
como linha citável** neste catálogo. Identificadas, para que ninguém as cite de memória:

| ID previsto         | corpo de regra                                                       | por que entrou                                                           | situação                        |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| `CFM-nn`            | CFM 2.299/21 — teleconsulta e responsabilidade do ato médico         | `DO-08`: sistema que sugere conduta interage com responsabilidade médica | ⏳ **não lida, não transcrita** |
| `CFM-nn`            | CFM — prontuário e registro do que foi decidido por quem             | HITL: é preciso registrar que a decisão foi humana                       | ⏳ **não lida**                 |
| `ANV-nn` / `RDC-nn` | RDC ANVISA 327/2019 e 660/2022 — produtos de _Cannabis_ e importação | `DO-08`: a conduta é direcionada ao canabidiol                           | ⏳ **não lidas**                |
| `RDC-nn`            | RDC ANVISA 1.000/25 — receituário e SNCR                             | conduta que desemboca em prescrição                                      | ⏳ **não lida**                 |
| `LGPD-nn`           | LGPD — base legal, operador, dado de saúde como dado sensível        | `DO-10` + provedores de LLM novos                                        | ⏳ **não lida**                 |

🔴 **Nenhuma foi aberta.** Estão aqui como _identificadas_, não como cobertas — a distinção que
este catálogo exige em _"'lido' ≠ 'transcrito'"_. Transcrevê-las é trabalho próprio, e deve
acontecer **antes** da tela de conduta ser desenhada.

### Falta insumo — de quem, e o que bloqueia

| ID                                                         | o que falta                                                                                                                                                                                                                                                                                                                                                                                                                                                  | de quem                | o que bloqueia                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~`GAP-01`~~ ✅                                            | ~~Qual é a **área nova** da demanda: sexto route group ou dentro de `(medico)`?~~                                                                                                                                                                                                                                                                                                                                                                            | —                      | **resolvido por `DO-11`**                                                                                                                                |
| ~~`GAP-02`~~ ✅                                            | ~~A IA vai **sugerir conduta/prescrição** (DDx, hipóteses, `prescricao_sugerida`) ou só estruturar o que o médico ditou?~~                                                                                                                                                                                                                                                                                                                                   | —                      | **resolvido por `DO-08`** — escopo máximo                                                                                                                |
| `GAP-03`                                                   | Origem do **corpus de canabidiol** para o RAG (RDC 327, RDC 660, literatura, material interno) e quem o valida clinicamente                                                                                                                                                                                                                                                                                                                                  | farmacêutico           | sprint de RAG; sem corpus não há "direcionar ao canabidiol"                                                                                              |
| ~~`GAP-04`~~ ✅                                            | ~~O **farmacêutico** é papel no sistema (4º valor no `userRoleEnum`) ou aprovador fora da plataforma?~~                                                                                                                                                                                                                                                                                                                                                      | —                      | **resolvido por `DO-09`** — fora da plataforma                                                                                                           |
| `GAP-10`                                                   | Quais das **44 páginas** do VidAI entram no escopo. **Parcialmente resolvido:** exames com IA entram (`DO-10`), área em `(medico)` (`DO-11`). Falta confirmar o inventário tela a tela                                                                                                                                                                                                                                                                       | dono                   | fechamento do escopo de cada sprint da Metade 1                                                                                                          |
| `GAP-11`                                                   | Prazo ou previsão do **upgrade de RAM na AWS**                                                                                                                                                                                                                                                                                                                                                                                                               | dono / AWS             | define quando a segunda metade pode começar                                                                                                              |
| `GAP-12`                                                   | 🔴 Quais **escalas de desfecho** entram como medida repetível de baseline (dor 0–10 e qualidade do sono já existem; a literatura oferece dezenas)                                                                                                                                                                                                                                                                                                            | médico                 | Sprints 3, 4 e 6 — o diário mede as mesmas do baseline                                                                                                   |
| `GAP-13`                                                   | Quais **sinais vitais** entram, e se são obrigatórios. O VidAI mede 8 porque é clínica geral; para canabidiol ambulatorial boa parte não muda conduta                                                                                                                                                                                                                                                                                                        | médico                 | Sprint 3 · campo sem consumidor é coleta sem finalidade                                                                                                  |
| ~~`GAP-14`~~ ✅                                            | ~~**Quando um ajuste de dose exige prescrição nova** e quando basta atualizar o plano~~                                                                                                                                                                                                                                                                                                                                                                      | —                      | **resolvido por `DO-44`** em 24/08/2026 — o médico ajusta, notifica o paciente, e o anterior fica no histórico em dois lugares                           |
| `GAP-16`                                                   | 🔴 **Base legal para o uso SECUNDÁRIO do juízo do médico** — a divergência registrada vira insumo de RAG (`DO-40`). O dado foi coletado para tratar aquele paciente; usá-lo para melhorar o modelo é finalidade nova (LGPD art. 7º e art. 11 para dado de saúde)                                                                                                                                                                                             | **Jurídico**           | bloqueia a **ingestão** no corpus (Sprint 10), não a construção dos campos — ver [ADR-0011](adr/ADR-0011-a-divergencia-do-medico-alimenta-o-rag.md) D-02 |
| `GAP-17`                                                   | 🔴 **O `CAN-05` também é AVISO, como o `CAN-04`?** THC acima de 0,2 % é restrito a **doença debilitante grave** ou que ameace a vida. O dono decidiu em `DO-46`/`DO-47` que o teor é campo do médico e que o sistema **avisa** — mas o `CAN-05` **não foi perguntado**, e presumir a resposta seria regra presumida. ⚠️ Depende também de ler a **RDC 38/2013**, que é quem define o termo                                                                   | **dono** (+ médico)    | bloqueia o **entregável 10 da Sprint 5**. Não bloqueia nada do que já foi entregue                                                                       |
| `GAP-18`                                                   | 🔴 **A Be4Hope pode emitir Notificação de Receita "A"?** O `CAN-04` a exige para THC > 0,2 %, e `prescricaoTipoEnum` **não tem esse valor** (`db/schema/enums.ts:107`). Hoje a ponte grava `controle_especial` e **denuncia na tela** que a Notificação precisa sair por fora. Acrescentar o valor ao enum é `ALTER TYPE` **irreversível** em tabela que alimenta PDF assinado e SNCR — a pergunta de negócio vem antes do código                            | **dono** + Regulatório | bloqueia corrigir o [`04` Item 13.6](04-LISTA-DE-AFAZERES.md). O guarda já fica vermelho quando o enum mudar, nomeando o contorno a remover              |
| ~~`GAP-15`~~ ✅ **RESPONDIDA por consequência de `DO-23`** | **Quem recusar o consentimento tem outra via real de atendimento?** — deixou de ser bloqueante: com `DO-23` ninguém deixa de ser atendido, então não é preciso haver alternativa. ⚠️ Fica o **fato medido em 20/08**: o agendamento presencial **não existe** no código — `db/schema/consultas.ts` sem campo de modalidade, sem enum presencial × remota, e a única menção a "presencial" está em `app/(public)/termos-de-uso`. Criar isso é sprint própria. | dono — respondida      |
| `GAP-05`                                                   | Registrar decisão do dono por **nome** ou por **papel**? Este catálogo usa papel até segunda ordem.                                                                                                                                                                                                                                                                                                                                                          | dono                   | forma dos futuros `DO-nn`                                                                                                                                |
| `GAP-06`                                                   | 🔴 Base legal e contrato de operador para os **provedores de LLM novos** (Groq, OpenAI, Anthropic) — hoje só o Google/Gemini recebe dado. **Ampliado por `DO-10`:** inclui **enviar imagem clínica** a provedor externo, que é o ponto não resolvido de `CF-01`                                                                                                                                                                                              | Jurídico               | toda a Metade 2; nenhum provedor novo, e nenhuma imagem, sai sem isso                                                                                    |
| `GAP-07`                                                   | Escopo de _"completamente funcional"_ na teleconsulta: só a chamada de vídeo, ou o pacote inteiro (transcrição, anamnese inline, prescrição inline, evolução)?                                                                                                                                                                                                                                                                                               | dono                   | escopo da Sprint 1                                                                                                                                       |
| `GAP-08`                                                   | Navegador e dispositivo alvo do paciente (Safari/iOS muda substancialmente o teste de WebRTC)                                                                                                                                                                                                                                                                                                                                                                | dono                   | matriz de teste da Sprint 1                                                                                                                              |
| `GAP-09`                                                   | Credenciais de ambiente de desenvolvimento (Pusher, Gemini, Clerk, Neon) para subir a teleconsulta local                                                                                                                                                                                                                                                                                                                                                     | dono                   | qualquer teste que não seja estático                                                                                                                     |
