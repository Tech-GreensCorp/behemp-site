# Princípios de Engenharia — Be4Hope / Greens

> **A doc de competências.** Todo diagnóstico, proposta ou implementação **cita o
> princípio (A–P) e a fase (0–15)** que o sustenta.
>
> A **teoria** de cada tópico vive na [árvore do conhecimento](arvore-do-conhecimento/00-RAIZ.md).
> As **regras do produto** vivem em `docs/01-REGRA-DE-NEGOCIO.md` e em `docs/adr/`. Os
> **padrões medidos do código** vivem em `docs/06-PADROES-DO-CODIGO.md`.

---

## Para que esta doc existe

Duas funções, e a segunda é a que quase ninguém percebe:

1. **Roadmap de estudo** — o que aprender, em que ordem, e por quê nessa ordem.
2. 🎯 **Vocabulário de justificação para o agente.** *"Vou extrair isto para um
   módulo"* é opinião. *"Vou extrair isto — princípio A, Fase 3"* é uma afirmação que
   se pode contestar pelo mérito.

⚠️ **Não é decoração.** Se a citação não for cobrada, ela desaparece em duas sessões.

⚠️ **Citar princípio não substitui fonte.** O princípio diz *de que família* é o
argumento; a fonte primária diz se ele está certo. As duas coisas são exigidas — ver
`CLAUDE.md`, seção *Fundamentação técnica obrigatória*.

---

## Parte 1 — Os princípios (A–P)

**As letras são o vocabulário citável.** Renumerar quebra toda citação já escrita nas
ADRs — o conteúdo se ajusta, a letra não muda.

### A. Fundamentos de código e arquitetura
Clean Code (DRY, KISS, YAGNI) · SOLID · Design Patterns · separação de
responsabilidades · Clean Architecture / Hexagonal · noções de DDD.
**Neste projeto:** módulo profundo × interface rasa decide o que é `lib/*` e o que é
`_actions/*`.

### B. Controle de versão e fluxo de trabalho
Git (merge, rebase, worktree) · **Conventional Commits** · Pull Requests e review.
**Neste projeto:** `main` **é produção** — push em `main` dispara deploy
(`.github/workflows/deploy.yml`). Trabalho em `feat/*`. Não existe GitFlow com
`develop`.

### C. Ambientes e CI/CD
Dev · produção · GitHub Actions · feature flags · deploy progressivo.
**Neste projeto:** build no runner do GitHub Actions, `rsync` para EC2, `pnpm
db:migrate` no servidor, `pm2 restart` (DT-008). **Não há staging.**

### D. Tratamento de erros, resiliência e HTTP
Error handling · error boundaries · circuit breaker · status HTTP · logging
estruturado.
**Neste projeto:** `error.tsx` por route group; action devolve
`{ sucesso: false, erro }` sem stack trace; erro ao usuário nunca vaza detalhe interno.

### E. Containerização e infraestrutura
Docker · Nginx como reverse proxy · deploy em VPS · SSL/TLS · noção de Kubernetes.
**Neste projeto:** não há container. PM2 direto na EC2, com swap **não persistido**
(DT-006) — limitação conhecida, não estilo.

### F. Banco de dados e arquitetura de dados
Relacional × NoSQL · normalização · índices · migrations · réplicas · backup.
**Neste projeto:** Neon PostgreSQL + Drizzle. Enums em `db/schema/enums.ts`, relations
em `relations.ts`, `baseColumns`/`softDeleteColumn` em `_helpers.ts`. Migration
gerada, nunca editada à mão sem motivo escrito.

### G. Ferramentas de API e testes de API
Design REST · OpenAPI · versionamento · Insomnia/Postman.
**Neste projeto:** Route Handlers só para webhook, upload, cron, callback de auth,
Pusher e Inngest. O resto é Server Action — não há API interna a versionar.

### H. Segurança
**OWASP Top 10 e API Security Top 10** · autenticação e autorização · gestão de
segredos · **LGPD**.
**Neste projeto:** o risco número um é **BOLA (API1)** — papel certo + id de outro
paciente. Autorização é de **objeto**, não só de papel. Auditoria obrigatória em dado
clínico (`lib/utils/audit.ts`).

### I. Testes automatizados e qualidade
Unitário · integração · E2E · TDD · cobertura · **guardas estruturais**
([técnica](TECNICA-DOS-GUARDAS.md)).
**Neste projeto:** 🔴 **zero teste hoje.** Vitest entra para hospedar guardas
(ver `docs/03-CHECKLIST-MESTRE.md`, prioridade 2). Cobertura não é meta;
guarda por classe de defeito é.

### J. Observabilidade, performance e escalabilidade
Logging centralizado · monitoramento · cache · mensageria · load balancing e CDN.
**Neste projeto:** Inngest para job assíncrono, Pusher para tempo real. Não há
métrica nem alerta de infra — lacuna conhecida, e é o que torna o teste mais
importante, não menos.

### K. Fundamentos de lógica e estruturas de dados
Lógica e POO · estruturas · algoritmos e Big-O.

### L. Front-end essencial
HTML semântico e **acessibilidade** · CSS (Flexbox, Grid, responsividade) ·
JavaScript (DOM, async) · um framework em profundidade + TypeScript.
**Neste projeto:** React 19 + Next 16 App Router + Tailwind 4 CSS-first + shadcn/ui
`base-nova`. O sistema visual está fechado — ver `06-PADROES-DO-CODIGO.md` §4.

### M. Stack back-end
**Uma** linguagem com seu ecossistema, em profundidade.
**Neste projeto:** TypeScript strict, sem `any` novo.

### N. Sistemas operacionais e redes
Linux (permissões, processos, administração) · TCP/IP, DNS, HTTP/HTTPS, portas,
firewall.
**Neste projeto:** EC2 Ubuntu, PM2, IP público **dinâmico** sem Elastic IP (DT-006).

### O. Cloud, DevOps e infraestrutura como código
Conceitos de nuvem · Terraform · **12-factor app**.
**Neste projeto:** config por ambiente em `lib/env.ts`; nada de segredo em git.

### P. Fluência com IA no desenvolvimento
Engenharia de prompt e **context engineering** · **revisão crítica de código gerado
por IA** — evitar *vibe coding* inseguro.
**Neste projeto:** o `CLAUDE.md` é o índice; docs vivos são o disco. Código gerado
sem fundamentação citada é rejeitado na revisão.

---

## Parte 2 — O roadmap em fases (0–15)

A coluna que importa é a última.

| Fase | Tema | Grupos | Por que nesta ordem |
|---|---|---|---|
| 0 | Alicerce | K, N | nada existe sem lógica/POO; terminal antecede o Git |
| 1 | Git | B | todo código a partir daqui é versionado |
| 2 | Front-end | L | framework sem JS puro vira decoreba |
| 3 | Arquitetura | A | refinar só depois de já ter escrito código |
| 4 | Back-end e API | M, G, D | precisa de POO para não nascer errado |
| 5 | Banco | F | persiste o que a API processa |
| 6 | Segurança | H | só se protege o que já existe |
| 7 | Erros e resiliência | D | trata erro do que já tem regra, API, BD e auth |
| 8 | Testes | I | testa o que já existe de verdade |
| 9 | Containers | E | conteinerizar bugs não resolve nada |
| 10 | Redes, Nginx, VPS | N, E | expor os serviços na internet |
| 11 | Ambientes e CI/CD | C | automatiza o deploy que se aprendeu manual |
| 12 | Cloud e IaC | O | evolução do VPS manual para infra portável |
| 13 | Kubernetes | E | orquestra containers — exige 9 e 12 |
| 14 | Observabilidade e escala | J | otimiza sistema já em produção com carga |
| 15 | IA | P | fluência sobre a base toda |

⚠️ **Onde este projeto está de fato:** fases 0–7 aplicadas no código; **fase 8
(testes) não começou**; 9–10 puladas (PM2 sem container); 11 parcial (deploy
automatizado, **sem portão de verificação**); 12–14 não iniciadas.

> 🎯 A fase 8 estar vazia com a 11 pronta é o desequilíbrio mais caro do projeto:
> existe automação para publicar, e nenhuma para recusar.

---

## Parte 3 — Como o projeto usa o roadmap

- **O projeto é o laboratório.** Cada fase é aplicada retroativamente ao código real.
  Exemplos deste repositório:
  - role derivada do `userRoleEnum` em vez de 8 uniões escritas à mão →
    **A (DRY), Fase 3** · `docs/04-LISTA-DE-AFAZERES.md` Item 2
  - autorização de **objeto**, não só de papel → **H (OWASP API1/BOLA), Fase 6**
  - histórico clínico com soft delete, nunca sobrescrito → **F, Fase 5**
  - PII mascarada por regex antes de sair para serviço externo → **H, Fase 6** ·
    `app/api/teleconsulta/transcrever/route.ts:156-160`
  - portão no CI antes do deploy → **C, Fase 11** + **I, Fase 8** ·
    `docs/04-LISTA-DE-AFAZERES.md` Item 3
  - arquivo sensível em store privado, com entrega autenticada → **H, Fase 6** ·
    `docs/04-LISTA-DE-AFAZERES.md` Item 6
- ⚠️ **Dunning-Kruger: "funciona" não é "sei".** O pico da ignorância vem **antes** do
  vale. A árvore marca, por ramo, onde estamos — e ramo só sobe de estágio **com
  evidência**.
- **Regra prática:** fonte primária lida → princípio citado → decisão registrada (ADR)
  → **só então** código.
