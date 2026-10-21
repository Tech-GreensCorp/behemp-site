# ADR-0001 — O motor de IA continua em Python, como serviço próprio, e a BeHemp fala com ele por HTTP interno

> **Status:** ✅ **aprovada em 20/08/2026** pelo dono do produto — *"que bom que podemos manter
> a infraestrutura com essas técnicas inclusive quero que você registre a adr pois é isso que
> faremos"*. Ver `DO-05` em [`../02-CATALOGO-DE-REGRAS.md`](../02-CATALOGO-DE-REGRAS.md).
> ⚠️ **A execução é adiada e fatiada** — ver [ADR-0002](ADR-0002-ui-antes-da-inteligencia.md):
> a conexão com a IA só começa depois do upgrade de RAM na AWS.
> **Contexto:** a demanda é importar a inteligência clínica do VidAI (anamnese, DDx, RAG,
> mascaramento de PII) para a teleconsulta e a anamnese da BeHemp. O dono determinou que a
> inteligência seja preservada **idêntica**, em Python, porque não há tempo de refazer a
> rodada de validação que o VidAI já fez (`DO-04`).
> **Decisão:** o motor Python **não** é portado nem reescrito. Ele roda como **serviço
> separado**, e a BeHemp o consome por HTTP em rede privada — o mesmo padrão que o próprio
> VidAI já executa em produção. O que muda é a **máquina**, não a técnica.

---

## §1 — O que a medição provou

### 1.1 O padrão perguntado já existe, e é o do projeto de origem

`vidai_lancamento/docker-compose.prod.yml` descreve a produção real do VidAI
(`vidaimed.com`, VPS Hostinger, Ubuntu): seis serviços num **único host**, em rede Docker
interna `vidai_network`. O backend Node chama o motor por
`AI_FLASK_URL: "http://ia:5000"`, e o serviço `ia` **não publica porta para o host**.

Ou seja: *"dois sistemas diferentes no mesmo servidor, um chamando o outro"* não é hipótese a
avaliar — é o desenho que já roda. A pergunta real não é *se* dá, é *em que máquina*.

### 1.2 O motor não cabe no EC2 atual — e isso é aritmética, não opinião

Produção da BeHemp é **EC2 t2.small, 2 GB** (DT-006), já ocupada por Next 16 + PM2, com swap
que nem persiste no `fstab` (achado catalogado).

O que o motor carrega em memória, por `IA-you-ai-main/requirements.txt`:

| componente | evidência | peso |
|---|---|---|
| spaCy `pt_core_news_lg` | `Dockerfile:19`, exigido pelo Presidio | **551 MB em disco** — e a RAM ao carregar é maior que o disco, documentado pela própria Explosion |
| `sentence-transformers` + `nomic-embed-text-v1` | `agents/embedding_service.py:35` | ~**262 MB** em fp16 pela ficha do modelo; o repositório pesa 1,78 GB |
| `torch` | `models/patient_progression.py:15`, `models/medical_llm_analyzer.py:30` | runtime CPU, centenas de MB |
| Presidio + Flask + LangChain + LangGraph | `requirements.txt` | centenas de MB |

⚠️ **O comentário do `requirements.txt` diverge do código:** ele documenta
`paraphrase-multilingual-mpnet-base-v2` (278 MB), mas `embedding_service.py:35` carrega
`nomic-ai/nomic-embed-text-v1`. **O código vence** — e o modelo real é o maior dos dois.

Somando só o que é obrigatório, o motor sozinho pede **mais memória do que a máquina inteira
tem hoje**. Não existe ajuste de configuração que resolva isso.

### 1.3 O contrato de API já está pronto — 17 rotas

`IA-you-ai-main/main.py` expõe 17 rotas Flask. As diretamente úteis à BeHemp:

| rota | serve a |
|---|---|
| `POST /api/analyze-anamnesis` | anamnese com DDx e hipóteses |
| `POST /api/v1/transcribe-teleconsulta` | transcrição da teleconsulta |
| `POST /api/v1/mask-pii` | mascaramento LGPD (Presidio) |
| `POST /api/v1/processar-consulta` | consulta processada |
| `POST /api/v1/rag/ingerir` · `POST /api/v1/rag/aprender-consulta` | RAG |
| `POST /api/v1/retomar-prescricao` | prescrição em dois passos |
| `GET /api/status` | health check |

Isto importa: **a fronteira entre os dois sistemas já está desenhada e em uso.** Portar seria
inventar uma fronteira nova onde já existe uma testada.

### 1.4 Dois defeitos do deploy de origem que **não** se copiam

- 🔴 `IA-you-ai-main/Dockerfile:29` roda `CMD ["python", "main.py"]` — **o servidor de
  desenvolvimento do Flask, em produção.** A doc oficial é literal: *"Do not use the
  development server when deploying to production. It is intended for use only during local
  development. It is not designed to be particularly secure, stable, or efficient."*
- 🔴 `docker-compose.prod.yml` traz **senhas default em texto claro** (`POSTGRES_PASSWORD`,
  `REDIS_PASSWORD`) e `deploy-novo-vps.sh:16` traz a **senha root do VPS** hardcoded.

### 1.5 Celery não roda em produção no VidAI

`celery` aparece **uma única vez** no `docker-compose.prod.yml`, e é dentro de um comentário.
Não há serviço worker. As chamadas clínicas são **síncronas**, com
`CLAUDE_CLINICAL_TIMEOUT: 180` e `start_period: 120s` no healthcheck.

A superfície a importar é portanto **menor** do que o `requirements.txt` sugere — mas a
latência é de **até 3 minutos por análise**, o que decide o desenho da chamada do lado da
BeHemp.

### 1.6 O banco de vetores não precisa de Postgres novo

O VidAI usa `pgvector/pgvector:pg16` em container próprio. A BeHemp usa **Neon**, e a doc
oficial da Neon confirma: *"pgvector is available on every Neon plan with no add-on or paid
tier required"*, habilitado por `CREATE EXTENSION IF NOT EXISTS vector;`, com HNSW e IVFFlat
até 2.000 dimensões em `vector`. O `nomic-embed-text-v1` produz **768 dimensões** — folgado
dentro do limite.

---

## §2 — As decisões

### D-01 — O motor permanece em Python, sem reescrita

**Rejeitado: portar a inteligência para TypeScript dentro do Next.**
São ~11.750 linhas no núcleo (`main.py` 4.221 + `agents/` 7.533), validadas por 19 sprints e
uma bateria anti-regressão de 40 casos. Reescrever significa perder o único ativo que a
importação existe para preservar: **comportamento clínico já validado**. Contraria `DO-04`
diretamente. E o custo não é o da tradução — é o de descobrir, em produção clínica, qual
comportamento mudou.

### D-02 — O motor roda como serviço próprio, consumido por HTTP em rede privada

É o **padrão sidecar/serviço co-locado**: *"the sidecar runs independently from the primary
application's runtime environment and programming language"*, com *"low latency due to the
sidecar's proximity to the primary application"*. É o que o VidAI já faz.

**Rejeitado: embutir Python no processo do Next** (via `child_process`, PyO3 ou equivalente).
Acopla dois ciclos de vida — um crash do motor derruba o site inteiro — e impede escalar,
reiniciar ou atualizar um sem o outro.

### D-03 — A máquina de produção muda; a arquitetura não

Duas formas aceitáveis, ambas preservando *"dois sistemas, um chamando o outro"*:

| | mesmo host, máquina maior | host separado |
|---|---|---|
| desenho | Next + motor no mesmo servidor, motor em `127.0.0.1`/rede Docker | motor em máquina própria, HTTP autenticado |
| a favor | latência mínima; um só deploy; espelha o VidAI | falha isolada; escala independente; o site não cai com o motor |
| contra | ponto único de falha; um consome a RAM do outro | uma máquina a mais; a rede vira dependência |

**Decidido: mesmo host com máquina maior** — confirmado pelo dono em 20/08/2026 (*"será tudo
na mesma maquina"*). É o que o VidAI provou, e é reversível. O que **não** é aceitável é
manter o t2.small: §1.2. O upgrade de RAM depende de tratativa com a AWS, e essa espera é o
que motiva o faseamento da ADR-0002.

**Rejeitado: subir o motor no t2.small atual.** Não cabe. Tentar significa OOM killer
derrubando o Next em produção — e o swap nem persiste após restart.

### D-04 — O motor roda atrás de um WSGI de produção, nunca do servidor de desenvolvimento

Gunicorn ou Waitress, com nginx à frente, conforme a doc do Flask.

**Rejeitado: copiar o `CMD ["python", "main.py"]` do Dockerfile de origem.** A doc oficial
proíbe em texto expresso, e "já roda assim lá" não é fundamento — é a repetição de um defeito.

⚠️ **Restrição de memória:** cada worker Gunicorn carrega **sua própria cópia** dos modelos.
Com spaCy `lg` + `nomic-embed` por worker, o número de workers é limitado pela RAM, não pela
CPU. Medir antes de fixar.

### D-05 — O motor nunca é exposto à internet

Bind em interface privada, sem porta pública, com segredo compartilhado entre BeHemp e motor.
O VidAI já faz isto: o serviço `ia` não publica porta.

**Rejeitado: expor o motor com autenticação por token apenas.** Uma rota clínica que aceita
texto de paciente não deve estar alcançável de fora, mesmo autenticada — reduzir a superfície
vale mais que confiar no controle.

### D-06 — O RAG usa o Neon existente com pgvector, não um Postgres novo

`CREATE EXTENSION vector`, 768 dimensões, dentro do limite de 2.000 do HNSW (§1.6).

**Rejeitado: subir `pgvector/pgvector:pg16` em container, como o VidAI.** Cria um segundo
banco a operar, com backup e retenção próprios, para armazenar vetores que o banco atual já
suporta. Dado clínico em dois bancos é dois lugares para vazar e dois para auditar.

### D-07 — Chamada de até 3 minutos não bloqueia requisição de usuário

Dado o timeout de 180 s (§1.5), a BeHemp dispara o trabalho e acompanha o resultado, em vez
de segurar a resposta. O repositório **já tem** Inngest e Pusher para exatamente isso.

**Rejeitado: Server Action síncrona esperando o motor.** Três minutos de espera atravessam
timeout de proxy, de navegador e de paciência — e não há como mostrar progresso.

### D-08 — Nada de segredo do VidAI é reaproveitado

**Rejeitado: copiar `.env`, `docker-compose.prod.yml` ou `deploy-novo-vps.sh` como base.**
Carregam credencial em texto claro (§1.4). O que se importa é código, nunca configuração.

---

## §3 — O que fica rejeitado

| # | rejeitado | motivo em uma linha |
|---|---|---|
| R-01 | portar a inteligência para TypeScript | perde o comportamento validado, que é o ativo (`DO-04`) |
| R-02 | embutir Python no processo do Next | acopla ciclos de vida; crash do motor derruba o site |
| R-03 | manter o t2.small de 2 GB | o motor sozinho pede mais RAM que a máquina inteira |
| R-04 | `python main.py` em produção | proibido em texto expresso pela doc do Flask |
| R-05 | expor o motor à internet | superfície desnecessária em rota que recebe dado de paciente |
| R-06 | Postgres+pgvector próprio | Neon já suporta; dois bancos clínicos é dois lugares para auditar |
| R-07 | Server Action síncrona de 180 s | atravessa todo timeout do caminho, sem progresso visível |
| R-08 | reaproveitar `.env` / scripts de deploy do VidAI | credenciais em texto claro |

---

## §4 — Como se prova

Guardas a criar **depois** que a decisão for aceita e implementada — nunca antes, para não
nascerem acusando violação conhecida:

| guarda | falha quando |
|---|---|
| `motor-nao-exposto` | a configuração publicar a porta do motor para fora da rede privada |
| `sem-servidor-de-desenvolvimento` | o comando de start do motor for `python main.py` |
| `rag-no-neon` | aparecer string de conexão de um segundo Postgres |
| `chamada-clinica-assincrona` | uma Server Action aguardar o motor de forma síncrona |
| `sem-segredo-importado` | entrar no repo arquivo vindo do VidAI com credencial |

---

## §5 — O que ainda falta medir antes de aprovar

1. **RSS real do motor** com tudo carregado — a estimativa de §1.2 vem de fichas de modelo,
   não de medição. Roda-se o motor e mede-se. **Este número define o tamanho da máquina.**
2. Se `models/` (que importa `torch`) é carregado pelas rotas que vamos usar, ou é código
   morto no nosso recorte. Se for morto, a memória cai muito.
3. Latência real de `POST /api/analyze-anamnesis` com entrada representativa.

⚠️ Enquanto 1 e 2 não forem medidos, **o custo de infraestrutura desta ADR é estimativa**, e
está declarado como tal.

---

## §N — O que a implementação ensinou

*A escrever depois. É a seção que impede a próxima sessão de reabrir esta decisão com
informação pior.*

---

**Fontes.** Lidas na íntegra: [Flask — Deploying to Production](https://flask.palletsprojects.com/en/stable/deploying/) ·
[Neon — The pgvector extension](https://neon.com/docs/extensions/pgvector).
Localizadas e usadas pelo trecho citado, **sem abertura integral**:
[Azure Architecture Center — Sidecar pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/sidecar) ·
[spaCy — Models](https://spacy.io/models) e [explosion/spaCy #5650](https://github.com/explosion/spaCy/issues/5650) ·
[nomic-ai/nomic-embed-text-v1](https://huggingface.co/nomic-ai/nomic-embed-text-v1) ·
[Next.js — Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting).
Fonte primária do desenho: `vidai_lancamento/docker-compose.prod.yml` e
`IA-you-ai-main/{Dockerfile,requirements.txt,main.py}`.

**Princípios e fase** (`docs/PRINCIPIOS.md`):

| decisão | princípio | fase |
|---|---|---|
| D-01 · D-02 — serviço próprio, sem reescrita | **A** (arquitetura) + **P** (fluência com IA) | 3 e 15 |
| D-03 — trocar a máquina | **E** (containerização e infraestrutura) + **N** (redes/VPS) | 9–10 |
| D-04 — WSGI de produção | **M** (stack back-end) + **C** (ambientes) | 4 e 11 |
| D-05 · D-08 — motor privado, sem segredo importado | **H** (segurança) | 6 |
| D-06 — RAG no Neon | **F** (banco e arquitetura de dados) | 5 |
| D-07 — chamada assíncrona | **D** (erros e resiliência) + **J** (performance) | 7 e 14 |

⚠️ O `PRINCIPIOS.md` registra que **a fase 8 (testes) não começou** neste projeto, e chama isso
de *"o desequilíbrio mais caro"*: existe automação para publicar e nenhuma para recusar. Esta
ADR acrescenta um sistema inteiro **antes** de a fase 8 existir. Os guardas de §4 são o mínimo
para não piorar esse desequilíbrio — e nenhum deles roda enquanto o Item 3 da fila (portão de
CI + runner) não estiver de pé.
