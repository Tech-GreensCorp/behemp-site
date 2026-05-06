---
trigger: always_on
---

Antes de qualquer ação neste projeto, leia integralmente e nesta ordem:

1. CLAUDE.md — contexto, escopo funcional e regras de negócio
2. AGENTS.md — divisão de responsabilidades e permissões
3. 01.md — plano de execução cronológico

Regras de operação:
- Sempre seguir o plano em 01.md, fase por fase
- Só avançar de fase com o Definition of Done marcado
- Parar apenas nos pontos marcados com 🛑 no 01.md
- Em todo o resto, prosseguir sem pedir confirmação
- Ao final de cada fase: rodar pnpm lint, pnpm build e atualizar /docs/progresso.md
- Idioma do projeto: PT-BR
- Versões de libs sempre amarradas
- Sempre usar componentes shadcn/ui — nunca criar do zero quando houver equivalente