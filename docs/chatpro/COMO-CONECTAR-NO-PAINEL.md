# Como conectar o ChatPro no painel — BeHemp

> Passo a passo com os valores prontos, para ser seguido com o painel aberto ao lado.
> **Todo o código já está pronto e testado.** O que falta aqui é configuração — e nada nesta
> página exige deploy para ser decidido.
>
> 🔴 **A diferença em relação ao guia do greens-corp:** lá o bot pergunta **só o nome**. Aqui
> ele pergunta **nome completo E e-mail**, porque é por e-mail que o paciente recebe a
> confirmação e o acompanhamento — e é a chave da conta que ele vai usar depois. Isso significa
> **dois parâmetros** no bloco do fluxo, não um.

---

## Passo 1 · Gerar as credenciais da API

`app.chatpro.com.br` → **Configurações → Desenvolvedor**

| O que                                      | Vai para                 |
| ------------------------------------------ | ------------------------ |
| Token de acesso                            | `CHATPRO_INSTANCE_TOKEN` |
| Código da instância (`chatpro-xxxxxxxxxx`) | `CHATPRO_INSTANCE_ID`    |

⚠️ **Esse token lê todas as conversas de pacientes da conta.** Trate como senha de produção:
não mande por chat nem e-mail, e nunca commite.

**Se o código da instância não aparecer na tela de Desenvolvedor** (ele fica em outra): `F12` →
aba **Rede** → recarregue → filtre por `sparks` → clique em qualquer requisição → **Payload**: o
campo `instanceId` está ali. O código da instância **não é segredo** — segredo é a chave.

## Passo 2 · Gerar os dois segredos nossos

No terminal, um comando para cada:

```bash
openssl rand -hex 32   # → CHATPRO_INTAKE_SECRET
openssl rand -hex 32   # → CHATPRO_WEBHOOK_PATH_TOKEN
openssl rand -hex 32   # → CRON_SECRET, se ainda não existir
```

`CHATPRO_INTAKE_SECRET` é o que o painel manda no header. `CHATPRO_WEBHOOK_PATH_TOKEN` vai
**dentro da URL** do webhook — é ele que autentica a chamada, porque o ChatPro não assina os
webhooks (não há HMAC nem lista de IPs; ver ADR-0015 §2 D-02).

## Passo 3 · Preencher o `.env` de produção

```bash
CHATPRO_INSTANCE_ID=chatpro-xxxxxxxxxx
CHATPRO_INSTANCE_TOKEN=<token do passo 1>
CHATPRO_CHAT_API_URL=https://sparks.chatpro.com.br
CHATPRO_INTAKE_SECRET=<hex do passo 2>
CHATPRO_WEBHOOK_PATH_TOKEN=<hex do passo 2>
CHATPRO_LINK_TTL_HORAS=168
CHATPRO_CADASTRO_PATH=/cadastro
CRON_SECRET=<hex do passo 2>
NEXT_PUBLIC_APP_URL=https://<domínio real da BeHemp>
```

🔴 **`NEXT_PUBLIC_APP_URL` é o valor que mais causa estrago se estiver errado**, e o erro é
invisível: o endpoint responde `200`, a mensagem sai bonita, e o link dentro dela não abre em
lugar nenhum. Foi exatamente o que aconteceu no greens-corp. **Tem que ter esquema** — começa em
`https://`, não em `app.` nem em `localhost`.

⚠️ **Confira o valor abrindo o link uma vez.** Nenhum teste de backend pega esse erro.

## Passo 4 · Configurar o bloco do fluxo

No construtor de fluxo, abra o bloco onde o link deve ser entregue.

### 4.1 · Formato

Marque **Requisição externa**.

### 4.2 · Parâmetros — 🔴 SÃO DOIS, e esta é a diferença para o greens-corp

Em **Parâmetros → Texto**, adicione **dois** cards, nesta ordem:

| #   | Pergunta                                                                                        | Nome do parâmetro | Validação                                |
| --- | ----------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------- |
| 1   | `Antes de gerar seu link, me confirma seu nome completo, por favor?`                            | `name`            | Nenhum                                   |
| 2   | `E qual é o seu melhor e-mail? É por ele que você vai receber as atualizações do seu cadastro.` | `email`           | Nenhum (ou E-mail, se o painel oferecer) |

⚠️ **Preencher o "Nome do parâmetro" é obrigatório.** Sem ele o preview mostra `&=Olá...` — o
valor viaja sem nome e o backend não tem como ler.

⚠️ **Não peça o telefone.** O número do WhatsApp vem da API, é o da própria conversa, e o
endpoint prefere o da API ao da URL de propósito. Cada pergunta a mais no funil custa desistência.

ℹ️ **O endpoint aceita nome de uma palavra?** Não: o `intake` exige **duas palavras** e recusa com
`VALIDACAO`. O `bot-link` é mais tolerante de propósito — ele prefere o nome do fluxo, mas cai
para o nome do lead e, se não houver nenhum, gera o link mesmo assim e o formulário pede o nome.

### 4.3 · Requisição

| Campo                 | Valor                                    |
| --------------------- | ---------------------------------------- |
| **URL da Requisição** | `https://<domínio>/api/chatpro/bot-link` |
| **Autenticação**      | **Header**                               |
| Nome do header        | `x-chatpro-intake-secret`                |
| Valor do header       | o `CHATPRO_INTAKE_SECRET` do `.env`      |

⚠️ **O nome do header não é rótulo livre.** Escrever qualquer outra coisa resulta em `401` e
transferência para triagem. Se o painel não aceitar nome personalizado, use `Authorization` com
valor `Bearer <CHATPRO_INTAKE_SECRET>` — o endpoint aceita os dois.

### 4.4 · A mensagem

**Não escreva o texto do link: o corpo da resposta já é a mensagem.** O paciente recebe:

```
Perfeito, Joana! Preparei seu link exclusivo para concluir o cadastro e enviar os documentos:

https://<domínio>/cadastro/<token>

Protocolo: SOL-000004
O link é de uso único e vale 7 dias. Se pedir outro, vale sempre o mais recente.
```

Vale encurtar o texto do bloco **acima** da requisição: com link único, o paciente não precisa
criar conta nem procurar onde enviar cada documento.

### 4.5 · Ações

| Campo       | Valor                                       | Por quê                                      |
| ----------- | ------------------------------------------- | -------------------------------------------- |
| **Sucesso** | Transferir para a fila comercial/prescrição | o link foi entregue                          |
| **Falha**   | Transferir para recepção/triagem            | uma pessoa assume — o paciente nunca vê erro |

🔴 **A segunda linha é a rede de segurança.** O endpoint devolve erro **de propósito** quando não
consegue confirmar quem é o paciente. "Falhar" aqui significa "um humano assume", não "o paciente
fica sem resposta".

ℹ️ **A tela de destino já existe** — `/cadastro/{token}`, construída em 09/09/2026. O link do
bot leva direto a ela, com nome, e-mail e telefone pré-preenchidos. Ela pede o que falta (CPF,
senha e a pergunta sobre tratamento em curso) e termina no agendamento da teleconsulta.

## Passo 5 · Cadastrar o webhook

`Configurações → Desenvolvedor` → Webhook

| Campo       | Valor                                                                |
| ----------- | -------------------------------------------------------------------- |
| Webhook url | `https://<domínio>/api/chatpro/webhook/<CHATPRO_WEBHOOK_PATH_TOKEN>` |
| Versão      | `v1`                                                                 |

Depois clique em **Testar webhook**. Para conferir que chegou:

```sql
select evento, session_id, status from chatpro_eventos order by created_at desc limit 5;
```

## Passo 6 · Ligar o cron do processador

O webhook **grava e responde `202`** — ele não processa nada (ADR-0015 D-03). Quem consome a fila
é uma rota, que precisa ser chamada periodicamente:

```
GET https://<domínio>/api/chatpro/processar
Authorization: Bearer <CRON_SECRET>
```

A cada 5 minutos é folgado. **Enquanto este cron não estiver ligado, os eventos ficam
acumulando em `pendente`** — nada se perde, mas o funil não se move.

Sem `CRON_SECRET` a rota responde `503` de propósito: um cron que não roda aparece no
monitoramento; um endpoint aberto que qualquer um dispara, não.

## Passo 7 · O teste que só funciona com número novo

🔴 **O menu do bot só aparece no primeiro contato.** Com uma sessão já aberta, o fluxo não
recomeça a triagem, o bloco "Requisição externa" nunca é alcançado, e **não aparece nada no log**
— indistinguível de "não configurado". No greens-corp isso custou 72 horas de diagnóstico com
todo mundo achando que a integração estava quebrada.

**Para testar:** encerre o atendimento no painel (com um dos motivos de encerramento) **ou use
outro número**.

**Para operar:** `/api/chatpro/start` cobre quem já conversou antes — cadastra e redireciona
direto, sem depender de sessão nem de menu.

⚠️ Vale decidir no painel se deve haver **gatilho por palavra-chave** ou encerramento automático
por inatividade. Em operação real, quase todo paciente já falou com a empresa antes.

---

## O que conferir depois do primeiro paciente real

| #   | Conferência                           | Como                                                                                                  |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | O link abriu?                         | `select protocolo, primeiro_acesso_em from solicitacoes_cadastro order by created_at desc limit 5;`   |
| 2   | O evento foi processado?              | `select status, count(*) from chatpro_eventos group by 1;`                                            |
| 3   | O diretório sincronizou?              | `select tipo, count(*) from chatpro_diretorio group by 1;` — se vier vazio, o token não alcança a API |
| 4   | Nenhum texto de mensagem foi gravado? | `select count(*) from chatpro_eventos where payload::text ilike '%[removido]%';` — deve ser > 0       |

## A pendência que não é técnica

🔴 **Base legal da LGPD (art. 11) para dado sensível de saúde.** O funil do chatbot pergunta a
condição do paciente, então dado de saúde é coletado independentemente desta integração. A
consulta ao jurídico não é sobre o que vamos passar a fazer — é sobre o que **já** é feito.
**Dono: chefia + jurídico.** Bloqueia operação com paciente real, não o deploy.
