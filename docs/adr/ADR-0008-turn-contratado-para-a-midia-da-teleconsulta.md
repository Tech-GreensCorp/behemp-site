# ADR-0008 — A mídia da teleconsulta passa por TURN contratado, com credencial efêmera

> **Status:** ✅ **aprovada em 20/08/2026** pelo dono do produto, depois de explicação em
> linguagem não técnica: _"eu gostei da escolha agora que você me explicou bem melhor (…) eu
> aprovo a decisão tomada, seguiremos com a claudflare"_.
> **Contexto:** a auditoria da [Sprint 1](../sprints/SPRINT-1-auditoria-da-teleconsulta.md)
> encontrou o relay gratuito `openrelay.metered.ca`, com credencial pública `openrelayproject`,
> escrito em **dois** arquivos do cliente. Quando a conexão direta falha, **toda** a mídia da
> consulta — áudio e vídeo de médico e paciente — atravessa esse relay: operador de dado de
> saúde **sem contrato**, sem SLA, com senha que qualquer um encontra na internet.
> **Decisão:** **Cloudflare Realtime TURN**, com credencial **efêmera gerada no servidor** e
> entregue só a quem participa da sala. O endereço nunca volta ao código do cliente.

---

## §1 — O que a medição provou

### 1.1 O problema era em dois arquivos, não um

O diagnóstico anterior (Item 8 do `04`) dizia **um** ponto de chamada. Eram **dois**:

| arquivo                                                  | lado     |
| -------------------------------------------------------- | -------- |
| `components/teleconsulta/GlobalTeleconsultaHost.tsx`     | médico   |
| `app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx` | paciente |

E existe uma **terceira** implementação de `RTCPeerConnection` em
`app/(medico)/medico/teleconsulta/page.tsx:160`, só com STUN — provável código legado, que
nenhuma correção do TURN alcançaria. **A duplicação foi o que escondeu metade do problema**, e é
o argumento central de D-02 abaixo.

### 1.2 O preço, medido em fonte primária

Premissa explícita: vídeo WebRTC consome ~1,2 Mbps por direção (720p típico); uma consulta de
30 min relayada gasta ≈ **0,54 GB** (1,2 Mbps × 1800 s × 2 sentidos).

| provedor                        | preço                                        | fonte                                                               |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| **Cloudflare Realtime TURN**    | **US$ 0,05/GB**, com **1.000 GB/mês grátis** | [doc oficial](https://developers.cloudflare.com/realtime/turn/faq/) |
| Twilio NTS — São Paulo          | US$ 0,80/GB                                  | [pricing oficial](https://www.twilio.com/en-us/stun-turn/pricing)   |
| Twilio NTS — US West / Alemanha | US$ 0,40/GB                                  | idem                                                                |
| `coturn` próprio na AWS         | US$ 0,09/GB de banda + instância + operação  | pesquisa de custo AWS                                               |

🎯 **A conclusão não depende da premissa incerta.** Mesmo supondo que **100 %** das consultas
precisem de relay — o que nunca acontece —, 1.000 consultas/mês dão **540 GB**, ainda **dentro
do free tier**. No Twilio-SP, o mesmo volume custaria **US$ 432/mês**.

### 1.3 A Cloudflare não lê a mídia, mas vê o IP

A doc oficial declara que o WebRTC é cifrado com DTLS e que a Cloudflare **relaya pacotes
cifrados, sem poder inspecionar o conteúdo**; processa apenas metadados — IP, porta, tempo de
sessão. ⚠️ **IP é dado pessoal.** Ela é **operadora**, e não deixa de ser por não ver conteúdo.

### 1.4 O que não foi confirmado

O preço da instância em **sa-east-1**, para o cenário `coturn`. O valor localizado
(**US$ 15,18/mês** para `t3.small`) é de **us-east-1**; São Paulo é mais caro e o número exato
**não foi lido**. Registrado para não ser citado como se tivesse sido.

---

## §2 — As decisões

### D-01 — Cloudflare Realtime TURN

**Rejeitado: Twilio NTS.** Funciona e tem contrato, mas custa **16×** mais no PoP de São Paulo
(US$ 0,80/GB contra US$ 0,05/GB) e não tem free tier de TURN. O custo concreto de escolhê-lo:
~US$ 432/mês no cenário de 1.000 consultas, contra zero.

**Rejeitado: `coturn` próprio na AWS.** É a única opção **sem operador externo novo**, portanto
sem base legal a obter — e esse é um argumento real. Mas: não elimina o problema de dado pessoal
(o servidor ainda vê os IPs), custa mais que zero, exige **instância própria** porque a máquina
de produção é uma `t2.small` de 2 GB que já não cabe o motor de IA (ADR-0001), e transfere para
a equipe a disponibilidade de um componente sem o qual a consulta cai. **Hoje não há ninguém
designado para operar um `coturn`.**

**Rejeitado: manter o relay público.** É o estado que esta ADR existe para encerrar.

### D-02 — A lista de servidores vive em **um** lugar, no servidor

`/api/teleconsulta/ice-servers` devolve a configuração; o cliente nunca a escreve.

**Rejeitado: a lista no cliente, com o endereço em variável de ambiente pública.** Resolveria a
senha versionada, mas manteria a lista **duplicada** nas duas telas — e foi exatamente a
duplicação que fez o diagnóstico contar 1 quando havia 2 (§1.1). Trocar de provedor voltaria a
ser mexer em tela.

### D-03 — A credencial é **efêmera**, gerada no servidor

TTL de **2 horas**, via `POST /v1/turn/keys/{id}/credentials/generate-ice-servers`. O token de
conta fica só no servidor.

**Rejeitado: credencial permanente entregue ao cliente.** Credencial que chega ao navegador é
credencial vazada — é literalmente o defeito do `openrelayproject`, com outro nome.

### D-04 — Só quem está na sala recebe credencial

O endpoint chama `garantirDonoDaSala({ roomId })` antes de gerar.

**Rejeitado: exigir apenas autenticação.** Qualquer usuário autenticado poderia queimar a cota
paga da conta — e foi essa exata falha de escopo que produziu o Item 11.

### D-05 — Sem configuração, degrada para STUN **e avisa**

Sem `CLOUDFLARE_TURN_*`, o endpoint devolve `turnDisponivel: false` e a tela mostra o aviso.

**Rejeitado: cair de volta no relay público como fallback.** Anularia a ADR na primeira falha de
configuração, e em silêncio. **Rejeitado também: falhar sem avisar** — foi o modo de falha do
relay público quando saturava, e ninguém sabia por quê.

⚠️ **Isto é uma regressão funcional aceita e registrada** em `.claude/autorizacoes.txt`:
conexões que hoje só funcionam via relay passam a falhar até a conta existir. Aceitável porque a
teleconsulta **nunca foi usada de verdade** (`DO-02`) e porque falhar é menos grave que
atravessar relay de estranho com dado de saúde.

---

## §3 — O que fica rejeitado

| rejeitado                                   | custo concreto de tê-lo escolhido                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Twilio NTS                                  | ~US$ 432/mês no cenário de 1.000 consultas, contra zero                              |
| `coturn` próprio                            | instância nova + banda + **ninguém designado para operar**; consulta cai se ele cair |
| manter `openrelay.metered.ca`               | operador de dado de saúde sem contrato, com senha pública versionada                 |
| lista de ICE no cliente com env pública     | mantém a duplicação que escondeu metade do problema                                  |
| credencial permanente no cliente            | é o defeito do `openrelayproject` com outro nome                                     |
| endpoint só autenticado, sem escopo de sala | qualquer usuário queima a cota paga — a falha do Item 11                             |
| fallback silencioso para o relay público    | anula a ADR na primeira falha de configuração, sem ninguém ver                       |

---

## §4 — 🔴 O que falta vir de fora

**Ambas bloqueiam o uso real. Registradas também em `03-CHECKLIST-MESTRE` e `04-LISTA-DE-AFAZERES`.**

| #   | pendência                                                                                            | de quem          | enquanto não vem                                                            |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| 1   | **criar a conta** na Cloudflare e provisionar `CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_API_TOKEN` | **dono / infra** | a chamada usa só STUN e avisa; conexão que exija relay **falha**            |
| 2   | **assinar o DPA** da Cloudflare, **antes** de qualquer consulta real                                 | **Jurídico**     | 🛑 nenhuma consulta real deve trafegar por lá — seria operador sem contrato |

Onde obter as chaves: painel da Cloudflare → **Realtime** → **TURN**. O token é de servidor e
**nunca** vai ao cliente; a credencial que o navegador usa é gerada em
`/api/teleconsulta/ice-servers` com validade de 2 h.

⚠️ **A pendência 2 não é formalidade.** A Cloudflare não lê a mídia, mas vê o IP de médico e
paciente — e isso a torna operadora sob a LGPD. O contrato é a diferença entre "operador
contratado" e o problema que esta ADR veio corrigir.

---

## §5 — Como se prova

| guarda                                  | falha quando                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `sem-relay-de-terceiro-na-teleconsulta` | a mídia voltar a apontar para relay gratuito de terceiro, ou credencial de ICE voltar ao código     |
| — mesmo arquivo, 2º describe            | o endpoint entregar credencial sem verificar vínculo com a sala, ou ler a chave de fora do ambiente |
| — mesmo arquivo, 3º describe            | **controle contra falsa acusação**: menção em comentário passa a ser tratada como uso               |

**13 casos, 5 sabotagens provadas vermelhas.** O guarda **nasceu verde**, de propósito: foi
escrito **depois** da correção, porque guarda para violação conhecida e não corrigida nasce
vermelho e **fica** vermelho — e guarda permanentemente vermelho é guarda que alguém desliga
(`.claude/rules/seguranca-lgpd.md`).

🔴 **A primeira versão do guarda acusou o próprio comentário que documentava a correção** — ela
procurava `openrelayproject` em qualquer posição do arquivo. É o mesmo defeito de granularidade
das duas falsas acusações do hook `git-perigoso` em 19/08/2026: menção em documentação lida como
uso real. Virou um `describe` de controle com 4 casos, mais um que prova que o uso real continua
sendo acusado — senão o controle seria vácuo. Regra 2 de
[TECNICA-DOS-GUARDAS](../TECNICA-DOS-GUARDAS.md).

---

## §6 — O que a implementação ensinou

- **Explicar antes de perguntar muda a decisão.** A primeira pergunta ao dono foi em jargão
  ("qual desenho de TURN?") e a resposta foi _"não entendi isso"_. Depois de uma explicação sem
  termos técnicos, ele aprovou e disse: _"agora que você me explicou bem melhor antes de me
  mandar um questionário consegui entender a importância disso"_. **Questionário sobre coisa não
  explicada produz decisão de má qualidade, ou nenhuma decisão.**
- **A conta que dispensa a premissa é mais forte que a conta precisa.** Não foi possível verificar
  em fonte primária a taxa de conexões que precisam de relay. Calcular o **pior caso** (100 %)
  tornou a conclusão insensível a essa incerteza — e mais defensável do que um número estimado.
