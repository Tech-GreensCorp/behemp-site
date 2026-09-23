# ADR-0024 — A credencial do médico no Mercado Pago é cifrada na aplicação, não no banco

> **Status:** 📋 **proposta** — 22/09/2026. Escrita **depois** do código, e isso é uma
> irregularidade registrada: o `CLAUDE.md` manda a ADR vir **antes** de implementar. O schema
> (`db/schema/medicos-mercadopago-conta.ts`) e a cifra (`lib/seguranca/cifra.ts`) foram
> escritos primeiro, a pedido do dono, e **nenhuma migration foi gerada** — então nada disto
> existe em banco nenhum, e a decisão ainda pode mudar sem custo de dado.
>
> 🔴 **O QUE ESTÁ DECIDIDO E O QUE NÃO ESTÁ:**
>
> | o quê                                                                | status                                 |
> | -------------------------------------------------------------------- | -------------------------------------- |
> | cifrar credencial de terceiro em repouso, na aplicação               | ⏳ **proposta** — é o objeto desta ADR |
> | AES-256-GCM com IV por operação e formato versionado                 | ⏳ proposta (D-01, D-02)               |
> | chave em `MERCADOPAGO_TOKEN_ENCRYPTION_KEY`, no ambiente             | ⏳ proposta (D-03)                     |
> | a tabela `medicos_mercadopago_conta`                                 | ⏳ proposta — **sem migration**        |
> | corrigir `medicos.google_refresh_token`                              | ❌ **fora desta ADR** — ver §6         |
> | o endpoint de cobrança, o OAuth e o `registrarAuditoria` ao decifrar | ❌ não escritos — ver §5               |

---

## §1 — O que motivou, e o que foi medido

O Mercado Pago cobra em nome do médico, e para isso a plataforma precisa de um **access token
por médico**, obtido por OAuth. Isso é duas primeiras vezes ao mesmo tempo neste repositório:

1. **primeira credencial de terceiro por médico** que a plataforma guarda para usar depois; e
2. **primeira cifra em repouso**, porque não existe nenhuma.

O segundo ponto foi **medido em 22/09/2026**, não suposto:

| medição                                                                  | resultado                                    |
| ------------------------------------------------------------------------ | -------------------------------------------- |
| `grep -rniE "encrypt\|decrypt\|cipher\|AES\|pgcrypto"` em `db/` e `lib/` | **0 linhas**                                 |
| a mesma busca no repositório inteiro (`.ts .tsx .sql .mjs`)              | **0 linhas**                                 |
| `createCipheriv` / `createDecipheriv`                                    | **0**                                        |
| dependências de cripto no `package.json` (40 prod + 14 dev)              | **1** — `jose`, só `SignJWT` para o DocuSign |

O que existe de `node:crypto` é **HMAC e hash** — `lib/parceiros/assinatura.ts`,
`lib/parceiros/link-do-documento.ts`, `lib/chatpro/segredo.ts`. Eles provam origem e
integridade e **não escondem conteúdo**; não têm operação inversa. Nenhum serve de modelo para
guardar um segredo que precisa ser lido de volta.

⚠️ **Logo, não havia padrão a seguir — havia um a criar.** É por isso que esta ADR existe, e é
por isso que ela vale para além do Mercado Pago: o próximo campo cifrado deste repositório
deveria herdar daqui, ou explicar por que não.

---

## §2 — Por que a credencial precisa ser guardada

A pergunta que `.claude/rules/seguranca-lgpd.md` manda fazer primeiro, na seção **Minimização**,
não é _"como cifro?"_ — é _"preciso guardar?"_. Ela foi feita, e a resposta é sim:

- O OAuth do Mercado Pago entrega um `access_token` de validade curta e um `refresh_token` de
  vida longa. **Sem guardar o refresh token, o médico reautoriza a conta a cada expiração.**
- O consumidor está declarado: o endpoint de cobrança, que cria a preferência de pagamento em
  nome do médico. Campo sem consumidor é coleta sem finalidade — este tem.

⚠️ **E é por isso que as 8 variáveis do pipeline não resolvem o caso.** Elas vivem no ambiente
e valem para a plataforma inteira; o token de conta é **por médico**, vem do OAuth em runtime e
não cabe em variável de ambiente.

---

## §3 — Onde cada coisa mora, e por que não é tudo na mesma tabela

|               | `pagamentos`                                                   | `medicos_mercadopago_conta`         |
| ------------- | -------------------------------------------------------------- | ----------------------------------- |
| uma linha por | **consulta** (`uniqueIndex` em `consultaId`)                   | **médico** (`unique` em `medicoId`) |
| natureza      | transacional                                                   | configuração                        |
| guarda        | `gatewayProvider`, `gatewayReferenciaId`, `gatewayCheckoutUrl` | a credencial de acesso              |

As três colunas `gateway*` de `pagamentos` **são reaproveitadas** e ficam onde estão. Medido em
22/09/2026: são `NULL` em toda linha, e dos 7 pontos que fazem `insert`/`update` em
`pagamentos`, **nenhum as escreve** — `gatewayCheckoutUrl` sequer é lida em lugar nenhum. As
telas dizem literalmente _"Aguardando integração"_.

⚠️ O comentário de `db/schema/pagamentos.ts:17-19` ainda diz _"para quando o **Gather**
existir"_. Ele muda no commit em que as colunas passarem a ser escritas — **não antes**, para o
diff da mudança de comportamento não vir misturado com mudança de texto.

---

## §4 — O que fica decidido, e o que fica rejeitado

### D-01 — A cifra é **AES-256-GCM**, e não um modo sem autenticação

GCM é AEAD: além de esconder, prova que o texto cifrado não foi alterado.

**Rejeitado: AES-256-CBC.** Quem tiver escrita no banco pode virar bytes do cifrado e o
`decifrar` devolve **lixo sem erro**. Lixo silencioso num token vira falha na integração com o
Mercado Pago sem ninguém saber por quê — e este repositório já pagou por falha silenciosa mais
de uma vez. Com GCM, um bit trocado faz o `final()` **lançar**. Verificado por execução:
alterar o conteúdo e alterar a etiqueta, os dois lançam.

### D-02 — IV aleatório por operação, e formato **versionado**

O NIST SP 800-38D é explícito: reusar o par (chave, IV) em GCM **destrói a segurança do modo** —
dois cifrados com o mesmo par vazam o XOR dos claros e tornam a chave de autenticação
recuperável. O IV tem **12 bytes (96 bits)**, que é o tamanho que a mesma especificação
recomenda para GCM, e é sorteado a cada `cifrar()`.

Formato: **`v1.<base64url(iv ‖ authTag ‖ cifrado)>`**

**Rejeitado: concatenar sem prefixo de versão.** O prefixo custa 3 bytes e é o que torna a
rotação possível: no dia em que `v2` mudar algoritmo ou chave, `decifrar` sabe qual caminho
seguir e as linhas antigas continuam legíveis. Sem ele, migrar exigiria adivinhar pelo tamanho
— e adivinhar formato é como se perde dado cifrado.

**Consequência desejada:** cifrar o mesmo texto duas vezes dá resultados **diferentes**.
Resultado igual revelaria que dois médicos têm o mesmo token. Verificado: 200 cifragens
produziram 200 IVs distintos.

### D-03 — A chave vive no **ambiente**, lida a cada chamada

`MERCADOPAGO_TOKEN_ENCRYPTION_KEY`, 64 hexadecimais = 32 bytes, gerada com
`openssl rand -hex 32` e cadastrada com `tr -d '\n' | gh secret set`. O `tr` não é detalhe: uma
quebra de linha a mais e a chave deixa de ter 32 bytes.

Lida **a cada chamada**, não numa constante de topo — assim rotacionar é trocar o secret e
reiniciar, sem um módulo segurando o valor antigo em memória.

**Rejeitado: chave em arquivo no servidor.** O repositório já aprendeu que configuração viva só
na máquina é configuração que ninguém lê, versiona ou confere — foi o que o deploy #37 revelou
sobre o `dump.pm2`. O caminho auditável é o GitHub Secret → `gravar` no `deploy.yml`.

### D-04 — Falha **fechada**, sempre

Sem a chave no processo, `cifrar()` **lança** `CifraNaoConfigurada`. Nunca devolve o texto
claro, nunca cai num padrão. É o desenho de `lib/documentos/store-privado.ts`, e pelo mesmo
motivo: credencial não degrada para "sem proteção" porque faltou configuração.

O efeito prático é que **um médico não consegue conectar a conta** se a chave faltar — e isso é
preferível a conectar gravando o token em claro.

### D-05 — A linha **nunca é apagada**

Desconectar preenche `desconectadoEm` e zera os dois campos cifrados. O registro de que houve
vínculo, e quando terminou, é auditoria e sobrevive; a credencial, que é o que dá poder, não.
É a proibição 4 do `CLAUDE.md` — alteração preserva o anterior, a data e o motivo.

### D-06 — O nome da coluna **declara** o conteúdo: `accessTokenCifrado`

**Rejeitado: `accessToken` com um comentário dizendo que é cifrado.** É exatamente o que
`db/schema/medicos.ts:27` faz hoje, e o §6 mostra no que deu.

---

## §5 — Modos de erro, e como o sistema reage a cada um

| #   | situação                                   | o que acontece hoje                                               | está certo?         |
| --- | ------------------------------------------ | ----------------------------------------------------------------- | ------------------- |
| 1   | chave ausente no processo                  | `cifrar`/`decifrar` lançam `CifraNaoConfigurada`; a conexão falha | ✅ falha fechada    |
| 2   | chave malformada (não-hex, tamanho errado) | lança, com o **tamanho** recebido na mensagem, nunca o valor      | ✅                  |
| 3   | chave trocada sem recifrar                 | `decifrar` lança em **toda** linha existente                      | ⚠️ ver §7           |
| 4   | cifrado adulterado no banco                | `decipher.final()` lança                                          | ✅ é o ponto do GCM |
| 5   | cifrado de versão desconhecida             | `TextoCifradoInvalido`, nomeando a versão                         | ✅                  |
| 6   | cifrado truncado                           | `TextoCifradoInvalido` — "curto demais"                           | ✅                  |
| 7   | **leitura do token não auditada**          | ⏳ **não implementado**                                           | 🔴 pendência aberta |

🔴 **O item 7 é a parte incompleta desta ADR, e está escrita como incompleta de propósito.** A
terceira pergunta de `.claude/rules/seguranca-lgpd.md` — _"o acesso é auditado?"_ — só se
responde quando existirem os pontos que **decifram**, e eles nascem com o endpoint de cobrança.
A regra a cumprir lá: **decifrar é o evento auditável**, não ler a linha.

---

## §6 — O achado do `google_refresh_token`: fica fora, mas esta ADR é o padrão dele

`db/schema/medicos.ts:27` declara:

```ts
googleRefreshToken: text('google_refresh_token'), // Criptografado em produção
```

**O comentário afirma uma propriedade que não existe.** Medido nos dois lados do caminho:
`app/api/auth/google/callback/route.ts:43` grava `.set({ googleRefreshToken: refreshToken })`
com o valor cru, e `app/(public)/_actions/agendamento.ts:338` o passa direto ao cliente do
Google. São **13 pontos** que leem ou escrevem a coluna, e **nenhum** transforma o valor — nem
poderia, já que não havia função de cifra no repositório para chamar.

Um refresh token do Google Calendar é credencial de longa duração: quem o tem lê e escreve na
agenda do médico até alguém revogar.

⛔ **Não corrigido aqui, e de propósito.** A seção _"Achado de segurança em código existente"_
de `.claude/rules/seguranca-lgpd.md` manda catalogar, medir o perigo, pedir autorização e
corrigir em **commit próprio** — nunca junto da tarefa original.

✅ **Mas esta ADR estabelece o padrão que a correção deveria seguir:** `lib/seguranca/cifra.ts`,
coluna renomeada para declarar o conteúdo, e uma migração que decifre nada e recifre tudo o que
já existe. E ela traz um requisito que o caso do Mercado Pago não tem: **o Google já está em
produção com dado real**, então a correção precisa tolerar linhas em claro durante a transição
— provavelmente com um `v0` no formato, significando "ainda não cifrado".

---

## §7 — 🔴 A consequência crítica: **perder a chave é perder os tokens**

> **Não há recuperação.** Sem `MERCADOPAGO_TOKEN_ENCRYPTION_KEY`, todo
> `access_token_cifrado` e `refresh_token_cifrado` já gravado é ilegível **para sempre** —
> é o que AES-256-GCM garante, e é a razão de usá-lo. Nenhum backup do banco ajuda: o banco
> guarda o cifrado, não a chave.
>
> **O que acontece na prática:** cada médico com conta conectada precisa **reconectar** pelo
> OAuth do Mercado Pago. Não é perda de dado clínico e não afeta paciente, mas é trabalho
> manual proporcional ao número de médicos, e ninguém descobre até a primeira cobrança falhar.

**Portanto, três regras operacionais que saem daqui:**

1. **A chave tem cópia fora do GitHub.** Hoje ela existe em dois lugares: o GitHub Secret e o
   arquivo `~/.mp-token-key` da máquina de quem a gerou. Dois lugares na mão de uma pessoa não
   é redundância — é decisão pendente do dono.
2. **Trocar o secret NÃO é rotacionar.** Rotação é: decifrar com a antiga, recifrar com a nova,
   e só então trocar. O `v1.` no formato existe para isso.
3. **A impressão digital se confere sem revelar o valor:**
   `tr -d '\n' < ~/.mp-token-key | shasum -a 256 | cut -c1-12`. A fórmula tem de ser a **mesma**
   nos dois lados — em 10/09/2026 duas impressões pareceram divergir e eram do mesmo valor,
   porque uma foi calculada sobre os 64 hex e a outra sobre os 65 bytes com `\n`.

---

## §8 — Alternativas consideradas

### Rejeitada: **não persistir — pedir reconexão a cada cobrança**

É a alternativa mais segura que existe: sem dado guardado, não há dado a vazar, e a seção
**Minimização** da regra de LGPD favorece isso por padrão.

**Rejeitada por UX, e o custo é concreto:** o `refresh_token` do OAuth existe precisamente para
evitar reautorização. Sem guardá-lo, o médico teria de voltar ao Mercado Pago e reautorizar
antes de cada cobrança — o que na prática significa que **a cobrança não acontece**, porque
ninguém está de plantão para reautorizar quando um paciente agenda.

⚠️ **O que se perde ao rejeitar:** deixa de existir a opção de "não ter o segredo". A troca é
consciente: aceitamos guardar credencial em troca de um fluxo que funciona sem operador humano,
e pagamos por isso com a cifra, a gestão de chave e a auditoria do §5.

### Rejeitada: **`pgcrypto` — cifrar no banco**

O PostgreSQL faz `pgp_sym_encrypt(dado, chave)` nativamente, e seria menos código nosso.

**Rejeitada porque aproxima a chave do dado.** Com `pgcrypto`, a chave viaja **no texto do SQL**
até o banco: ela aparece em `pg_stat_activity`, pode cair no log de query lenta, e quem tiver
acesso de leitura ao servidor de banco tem as duas metades no mesmo lugar. Cifrar na aplicação
mantém a separação que dá sentido à cifra: **o banco guarda o cifrado e nunca vê a chave.**

Isso importa mais aqui do que em geral, porque o banco é **Neon, gerenciado por terceiro** — o
`AGENTS.md` declara a stack, e o `deploy.yml` confirma pela forma da URL (`?sslmode=require&
channel_binding=require`). Um dump do Neon com `pgcrypto` e as chaves nos logs de query é um
incidente; um dump com AES-256-GCM e a chave no ambiente da EC2 é ruído.

⚠️ **O que se perde:** a cifra deixa de funcionar para quem consultar o banco direto — um
`SELECT` de diagnóstico na VPS vê `v1.NooTwBa…` e não o token. É aceitável, e até desejável: o
`CLAUDE.md` já proíbe PII na saída dos diagnósticos.

### Rejeitada (por ora): **KMS gerenciado (AWS KMS, Vault)**

É o que resolve o §7 de verdade — a chave nunca sai do serviço, e rotação é operação dele.

**Rejeitada por desproporção, não por mérito.** Hoje são 8 variáveis num `.env` de uma EC2 com
PM2 (DT-006, DT-008), sem staging e sem IaC (fase 12 não iniciada). Introduzir KMS agora
adicionaria uma dependência de infraestrutura a um projeto que ainda não tem a fase 8 de testes.

✅ **Fica registrado como o caminho de evolução**, e o `v1.` do formato é o que o torna barato
depois: `v2` pode significar "chave envelopada por KMS" sem tocar em nenhuma linha `v1`.

---

## §9 — O que fica de fora, e o que continua em aberto

| item                                               | estado                                                                                                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| migration SQL da tabela                            | ✅ **gerada em 22/09/2026** — `0046_panoramic_chimera`, depois do merge do PR #110 que levou a 0045 a `main`. Provada em container descartável; **não aplicada em produção ainda** |
| `MERCADOPAGO_TOKEN_ENCRYPTION_KEY` em `lib/env.ts` | ⏳ **anotado, não implementado** — entra com as outras 8 quando a integração de código for escrita                                                                                 |
| OAuth do Mercado Pago (conectar/desconectar)       | ❌ não escrito                                                                                                                                                                     |
| endpoint de cobrança                               | ❌ não escrito                                                                                                                                                                     |
| `registrarAuditoria` ao decifrar                   | ❌ não escrito — §5, item 7                                                                                                                                                        |
| guarda estrutural da cifra                         | ❌ não escrito — ver abaixo                                                                                                                                                        |
| cópia da chave fora do GitHub                      | ⏳ decisão do dono — §7, regra 1                                                                                                                                                   |
| correção do `google_refresh_token`                 | ❌ trabalho próprio — §6                                                                                                                                                           |

⚠️ **Sobre o guarda que falta:** o `CLAUDE.md` manda todo bug virar teste e todo invariante
virar guarda. Os invariantes desta ADR que merecem guarda — nenhuma coluna `*Cifrado` recebe
valor que não venha de `cifrar()`; o IV nunca é constante; a chave nunca aparece em log —
**ainda não existem como teste**. Eles entram quando houver código que os viole, porque guarda
de código que não existe é guarda vazio.

---

## §10 — Princípios e fase

| eixo                                                          | por quê                                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Princípio **H** — Segurança (OWASP, LGPD, gestão de segredos) | é o objeto inteiro desta ADR; e o D-06 ataca "nome que mente"                             |
| Princípio **F** — Banco e arquitetura de dados                | cardinalidade separando transacional de configuração (§3)                                 |
| Princípio **C** — Ambientes e CI/CD                           | a chave entra pelo `gravar` do `deploy.yml`; secret fora da lista nunca chega ao processo |
| Princípio **D** — Erros e resiliência                         | §5 lista os modos de erro **antes** de a integração existir                               |
| **Fase 6** — Segurança                                        | protege algo que já tem regra, API, banco e auth                                          |

---

## §11 — Fontes

- **NIST SP 800-38D** — _Recommendation for Block Cipher Modes of Operation: GCM and GMAC_.
  IV de 96 bits recomendado; proibição de reusar o par (chave, IV). **Base do D-02.**
- **Node.js `crypto`** — `createCipheriv`/`createDecipheriv`, `getAuthTag`/`setAuthTag`.
  Documentação oficial do runtime que executa isto.
- **OWASP Top 10 — A02:2021 Cryptographic Failures** — dado sensível em claro em repouso;
  e **A01** (controle de acesso) para o escopo de objeto do §5.
- **OWASP API Security Top 10 — API1:2023 (BOLA)** — resolver `medicoId` pela sessão.
- `.claude/rules/seguranca-lgpd.md` — as três perguntas (§2, §5) e a seção _Achado de
  segurança em código existente_ (§6).
- `docs/DECISOES_TECNICAS.md` — **DT-006** (infraestrutura AWS EC2), **DT-008** (CI/CD GitHub
  Actions + EC2) e **DT-009** (standalone e o `.env` que não é lido sozinho), que sustentam o
  adiamento do KMS e o caminho da chave até o processo.
- `AGENTS.md` — a stack declarada (Neon PostgreSQL), que sustenta a rejeição do `pgcrypto`.
- `lib/documentos/store-privado.ts` — o precedente de **falha fechada** copiado no D-04.
- `db/schema/medicos-pagamento-config.ts` — a irmã de mesma cardinalidade, cuja convenção o
  schema novo segue.
