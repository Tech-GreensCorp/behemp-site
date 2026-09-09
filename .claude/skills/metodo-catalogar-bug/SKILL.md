---
name: metodo-catalogar-bug
description: Converte relato de bug em item catalogado em docs/04-LISTA-DE-AFAZERES.md, com diagnóstico e caminho:linha, e atualiza a fila do 03-CHECKLIST-MESTRE.md no mesmo commit. Use quando alguém relatar bug conversando, disser "achei um problema", "isso está errado", "não está funcionando", ou pedir uma sessão de QA. Não corrige o bug — cataloga para que a ordem seja decisão de quem manda.
---

# Catalogar bug em item

**Não corrija de imediato.** Numa conversa de QA o dono relata seis coisas em dois
minutos; corrigir na hora significa esquecer quatro. Catalogar significa que as seis
existem depois — e que ele decide a ordem.

## O procedimento

1. **Cite a frase dele.** Não parafraseie: o vocabulário de quem usa o sistema vale mais
   que a sua tradução, e prova que o problema é real e não teórico.
2. **Diagnostique antes de escrever o item.** Nada entra na lista sem
   `caminho/arquivo.ts:linha`. Item sem evidência é palpite, e palpite faz quem pegar
   começar do zero.
3. **Escreva o item** em `docs/04-LISTA-DE-AFAZERES.md`, no formato
   abaixo.
4. **Classifique e enfileire** em `docs/03-CHECKLIST-MESTRE.md`
   (🔴 risco agora · 🟠 custa depois · 🟡 dívida · ⚪ sem data), com link para o item.
5. Se o achado estiver **fora do escopo** da tarefa em curso, ele vai para a seção
   *"achados fora do escopo — não corrigir aqui"*. Catalogar não é autorização.

## O formato do item

```markdown
## Item NN — 🔴 {o defeito, como AFIRMAÇÃO}

{Como foi achado. Se foi relato, CITE a frase.}

> *"{a frase de quem relatou}"*

### O diagnóstico

{A causa. Não "parece que" — a causa, com o caminho.}

```ts
// caminho/do/arquivo.ts:61
{o trecho que prova}
```

### Como corrigir

{O que fazer.}

⚠️ **E o que NÃO fazer**, quando existe uma correção tentadora e errada: {…}

### O guarda

`{nomeDoGuarda}` — quebra o build se {a condição}. Ver `docs/TECNICA-DOS-GUARDAS.md`.
```

## Regras que não se negociam

- **Um relato, um item.** Dois defeitos no mesmo item fazem a correção de um mascarar o
  outro.
- **Prioridade responde três perguntas, nesta ordem:** alguém perde dado ou dinheiro se
  ficar assim? · trava outra coisa? · quanto custa?
- **A fila é atualizada no MESMO commit** que conclui um item. Fila desatualizada faz o
  projeto trabalhar na prioridade errada.
- Bug que já chegou a ambiente compartilhado ganha uma quarta seção: **o que teria
  evitado**. Se a resposta é decisão de arquitetura, abre-se ADR — o item sozinho não
  carrega mudança estrutural.

## Se o repórter foi o dono

O relato dele **é dado**, não ruído. *"Tá vendo como isso tá cheio de informação"* é uma
medição de usabilidade que nenhum teste faz — registre a frase, não a conclusão.
