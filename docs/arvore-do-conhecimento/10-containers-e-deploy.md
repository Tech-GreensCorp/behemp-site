# 🌿 Ramo 10 — Containers, Redes e Deploy (E, N · Fase 9–10) — estágio: 🌱

> Docker, Compose, Nginx, VPS, TLS.
> Sobe de estágio **só com evidência** — commit, doc ou decisão. Ver [a raiz](00-RAIZ.md).

## 🌱 Base

- **Imagem × container:** imagem é a receita, container a instância. Layer cache segue a ordem do Dockerfile — dependência antes do código-fonte.
- **Conteinerizar front, back e banco:** cada um no seu serviço; volume nomeado para o dado do banco, senão ele morre com o container.
- **Nginx como reverse proxy:** termina TLS, serve o estático, encaminha `/api` ao back. É ele que faz front e back parecerem a mesma origem.
- **VPS:** usuário sem root, firewall fechado por padrão, TLS com Let's Encrypt e renovação automática.
- ⚠️ **Porta publicada em `0.0.0.0`** expõe o banco à internet. Publique só o necessário.

## 🚀 No projeto

> 🎯 **É esta seção que faz o ramo valer.** Sem ela, o ramo é resumo de tutorial —
> qualquer LLM produz. Com ela, é a memória do que **este** sistema decidiu.
>
> Uma linha por aplicação, **com o arquivo ou o commit**.

- {{o que aplicamos}} — `{{caminho/do/arquivo}}`
- {{a decisão que tomamos e por quê}} — ver ADR-00NN

## ⛰️ Próximo nível

{{O que falta para subir de estágio. Concreto: não "estudar mais", mas o
tópico específico e por que ele importa para a raiz.}}
