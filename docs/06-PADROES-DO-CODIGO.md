# Padrões do código — Be4Hope / BeHemp

> 🎯 **Regra desta doc:** nada aqui é proposta. É o que o repositório **já faz**,
> medido em 19/08/2026, com caminho e contagem. O domínio comercial copia isto.
>
> Onde esta doc divergir do código, **o código vence** — e a divergência é bug desta doc.
> Onde ela divergir do `AGENTS.md`, ver §7: há três divergências reais medidas.
>
> 🎯 **Esta é a doc mais valiosa do repositório para quem vai escrever código.** Tudo aqui foi
> medido, não presumido — com contagem e caminho.

---

## 1. Gerenciador de pacotes e runtime

**Sim, é pnpm.** E o repositório é um workspace pnpm de um único pacote.

| item | valor | evidência |
|---|---|---|
| gerenciador | **pnpm**, lockfile v9 | `pnpm-lock.yaml` (363 KB), `pnpm-workspace.yaml` |
| workspace | pacote único (`packages: ["."]`) | `pnpm-workspace.yaml` |
| `.npmrc` | `engine-strict=true`, `auto-install-peers=true` | `.npmrc` |
| Node local | **18** | `.nvmrc` · DT-005 |
| Node no CI | **20** | `.github/workflows/deploy.yml:24` |
| build nativo permitido | `esbuild` · ignorados: `sharp`, `unrs-resolver` | `pnpm-workspace.yaml` |

Comandos (do `package.json`): `pnpm dev` (turbopack) · `pnpm build` · `pnpm start` ·
`pnpm lint` · `pnpm format:check` · `pnpm db:generate` · `pnpm db:migrate` ·
`pnpm db:studio` · `pnpm db:seed`.

⚠️ **`node_modules` estava ausente em 19/08/2026.** Nenhum check roda antes de
`pnpm install`.

⚠️ **Existe um `package-lock.json` de 587 KB junto do `pnpm-lock.yaml`.** Dois lockfiles no
mesmo repo é convite a instalar com o gerenciador errado e obter árvore diferente da do CI.
Catalogado — **não corrigir de passagem**, só não usar `npm install`.

## 2. Stack real, com versão fixada

Next **16.2.4** App Router · React **19.2.4** · TypeScript **5.9.3** strict ·
Tailwind **4.2.4** (CSS-first, sem `tailwind.config`) · shadcn/ui estilo
**`base-nova`** · Clerk **7.3.0** · Drizzle **0.44.2** + Neon serverless · Zod
**3.25.23** · `lucide-react` para ícones · `sonner` para toast · `recharts` para
gráfico · `framer-motion` **só** em `components/teleconsulta/`.

Versões são **fixas** (sem `^`) na maioria — manter o hábito.

## 3. Convenção de estrutura, por route group

As três áreas existentes têm **exatamente** os mesmos arquivos:

```
app/(admin)/          app/(medico)/         app/(paciente)/
  _actions/             _actions/             _actions/
  admin/                medico/               paciente/
  error.tsx             error.tsx             error.tsx
  layout.tsx            layout.tsx            layout.tsx
  loading.tsx           loading.tsx           loading.tsx
```

E um sidebar por área em `components/shared/`: `admin-sidebar.tsx` (284 linhas),
`medico-sidebar.tsx` (221), `paciente-sidebar.tsx` (219).

**Estrutura do sidebar** (`components/shared/admin-sidebar.tsx:33-78`): array
`NAV_GROUPS` de `{ title, items: [{ label, href, icon }] }`, estado `collapsed`,
`renderBadge(href)` para contadores, toggle mobile com `aria-label`.

## 4. O sistema visual — copiar, não recriar

Tudo mora em `app/globals.css` (448 linhas), em CSS custom properties. **Não criar
token novo, não hardcodar hex.**

### 4.1 Cores (light)

| token | valor | uso |
|---|---|---|
| `--background` | `#F5F2ED` | fundo creme/areia |
| `--foreground` | `#1A1612` | texto |
| `--card` / `--popover` | `#FFFFFF` | cartões brancos sobre o creme |
| `--primary` | `#EA5429` | laranja da logo · CTA · ícone ativo |
| `--secondary` | `#2D4F3C` | verde musgo |
| `--muted` / `--muted-foreground` | `#EDE8E1` / `#3D3833` | apoio |
| `--accent` | `#E8E2DA` | variação sutil do fundo |
| `--destructive` | `#DC2626` | erro |
| `--border` / `--input` / `--ring` | `#DDD8D1` / `#DDD8D1` / `#EA5429` | |
| `--radius` | `0.75rem` | e os `--radius-*` derivam dele |

Acessórias: `--color-terracotta #C34C32` · `--color-moss #2D4F3C` ·
`--color-stone #8A7F73` · `--color-sand #F5F2ED` · `--color-peach #D4A388` ·
`--color-clay #C69B7B`. Do design Lovable: `--primary-soft #FBEDE5` ·
`--surface #F9F5EF` · `--sun #E8B44A` · `--sky #4A80E5` · `--leaf #4E9E6A`.

Charts: `--chart-1` a `--chart-5` já definidos. **Usar esses** em qualquer gráfico
novo — e vale para indicador tanto quanto para cor.

**Dark mode** existe e é completo (`.dark`, via `next-themes` +
`components/shared/theme-provider.tsx`). Toda tela nova precisa funcionar nos dois.

### 4.2 Tipografia

Carregada em `app/layout.tsx:2-42` via `next/font`:

| fonte | variável | papel |
|---|---|---|
| **Epilogue** | `--font-epilogue` | corpo (`font-sans`, aplicada no `html`) |
| **Outfit** | `--font-outfit` | display e heading (`.font-display`, `.font-heading`) |
| **JetBrains Mono** | `--font-jetbrains-mono` | números e detalhes (`font-mono`) |
| **Fraunces** | `--font-fraunces` | **legado**, serif, `localFont` de `public/fonts/` |

⚠️ `--font-heading` e `--font-display` apontam para **Outfit**, não Fraunces
(`app/globals.css:19-20`). O `AGENTS.md` cita Fraunces como fonte de heading — está
desatualizado. Ver §7.

Classes utilitárias: `.font-display` · `.font-heading` · `.text-accent-italic`
(palavra destacada em itálico laranja) · `.eyebrow` (label 0.7rem, tracking 0.25em,
uppercase, cor primary) · `.drop-cap`.

### 4.3 Animações — as que existem, e só elas

Definidas em `app/globals.css` como keyframes + classe:

| classe | efeito | duração |
|---|---|---|
| `animate-fade-up` | opacidade + `translateY(20px)` | 0.6s ease-out |
| `animate-fade-in` | opacidade | 0.5s ease-out |
| `animate-slide-in-right` | opacidade + `translateX(20px)` | 0.5s ease-out |
| `animate-gentle-pulse` | opacidade 0.6→1 | 3s infinite |
| `animate-breathe` | escala 1.03 + glow laranja | 4s infinite |
| `animate-active-pulse` | glow verde para CTA ativa | 3.5s infinite |
| `reveal` | `translateY(18px)` com `cubic-bezier(0.22,1,0.36,1)` | 0.7s |
| `hover-shimmer` | shimmer no hover | 1.5s |
| `delay-100` … `delay-500` | escalonamento de entrada | — |

Mais `tw-animate-css` importado no topo do `globals.css` (dá `animate-in` etc.) e
`animate-spin` do Tailwind para loading.

**Uso medido:** `animate-fade-up` é a animação de entrada padrão das páginas
(aparece 4–8× por página em `(paciente)`, `(medico)` e `(public)`); `animate-spin`
com `<Loader2 size={32} className="animate-spin text-primary" />` é o loading padrão.

> 🛑 **Não introduzir `framer-motion` fora de `components/teleconsulta/`.** Hoje ele
> aparece em 4 arquivos, todos de teleconsulta. Animação de página é CSS, com as
> classes acima.

Outros utilitários visuais disponíveis: `.glass` (navbar on-scroll), `.grain`
(textura orgânica), `.section-dark`, `.btn-pill`, `.gradient-peach/-moss/-salmon/-warm`,
`.kanban-scroll`.

### 4.4 Componentes — 25 em `components/ui/`

`accordion · alert · alert-dialog · avatar · badge · button · calendar · card ·
checkbox · dialog · dropdown-menu · input · label · navigation-menu · popover ·
select · separator · sheet · skeleton · sonner · switch · table · tabs · textarea ·
tooltip`

> 🔴 **`table.tsx` existe e é usado em ZERO arquivos.** `card` é usado em **65**.
> O idioma de lista deste produto é **lista de Cards**, não tabela. Uma tela nova com
> `<Table>` seria a única do sistema — e é exatamente o tipo de coisa que faz a área
> nova parecer de outro produto.

Padrão de lista medido em `app/(admin)/admin/usuarios/page.tsx`:

- KPIs no topo: `Card className="border-0 shadow-sm"` + ícone em `div` com
  `h-10 w-10 rounded-xl` colorido (`:149-159`)
- busca: `Input` com `<Search size={16}>` posicionado absoluto (`:167`)
- loading: `Loader2 size={32} className="animate-spin text-primary"` (`:222`)
- vazio: `Card` + ícone `size={40} className="text-muted-foreground/40"` + título +
  subtítulo (`:225-235`)
- item: `Card className="border-0 shadow-sm transition-all hover:shadow-md"` (`:241`)
- status: `<Badge variant={...}>` com mapa `ROLE_CONFIG` de label/variant/cor (`:43+`)
- paginação: contador `tabular-nums` + `ChevronLeft/Right` (`:269-307`)

**Copiar essa anatomia** em qualquer tela de lista nova.

## 5. Padrões de servidor

| padrão | forma | evidência |
|---|---|---|
| Server Action | `'use server'` no topo; retorno `{ sucesso, dados?, erro? }` | `interface ActionResult<T = unknown>` declarada em **10+** arquivos de action |
| autorização | `verificarAdmin()` / `verificarRole([...])` no início da action | `app/(admin)/_actions/usuarios.ts:52` |
| validação | Zod no payload, no servidor | `AGENTS.md` |
| auditoria | `registrarAuditoria({ userId, acao, entidade, entidadeId, dadosAntes, dadosDepois })` | `lib/utils/audit.ts` |
| cache | `revalidatePath` depois de mutation que afeta UI cacheada | 5 arquivos de action usam |
| schema | `baseColumns` (cuid2 + createdAt + updatedAt) e `softDeleteColumn` | `db/schema/_helpers.ts` |
| enums | **todos** em `db/schema/enums.ts` | 27 enums lá |
| relations | **todas** em `db/schema/relations.ts` | 21 blocos lá |
| migration | `drizzle-kit generate`; SQL + snapshot + journal commitados juntos | `db/migrations/` (17 hoje) |

⚠️ `ActionResult` está **duplicada em 10+ arquivos**. Para código novo: declarar **uma vez**
num módulo do domínio, com a **mesma forma**, e importar. Refatorar os 10 existentes é trabalho
próprio, com autorização própria — ver `04-LISTA-DE-AFAZERES.md`.

## 6. Client × Server nas páginas — o que o repo faz de fato

| área | páginas `'use client'` | páginas server |
|---|---|---|
| `(admin)` | **11** de 16 | 5 |

As 11 são páginas de lista/filtro que chamam Server Action direto do client. As 5
server são as sem interatividade (`configuracoes`, `invoices`, `procuracoes`,
`alertas`, `medicos`).

Isso **contraria** o `AGENTS.md` (*"prefira Server Components"*) na letra, e o segue
no espírito: interatividade real justifica client. Regra para área nova:

- lista com busca, filtro, ordenação ou paginação → **client page + Server Action**, como as 11
- tela de leitura, detalhe ou relatório sem interação → **Server Component**, e
  `metadata` fica no arquivo server (padrão de `app/(public)/**`)

## 7. Divergências medidas entre doc e código

Registradas para ninguém "corrigir" o código com base na doc errada.

| # | doc diz | código diz | quem vence |
|---|---|---|---|
| 1 | `AGENTS.md`: heading em **Fraunces** | `--font-heading: var(--font-outfit)` (`globals.css:19-20`) | **código** — Outfit |
| 2 | `AGENTS.md`: *"prefira Server Components"* | 11/16 páginas admin são `'use client'` | **código**, com o critério da §6 |
| 3 | `AGENTS.md`: deploy na **Vercel** | AWS EC2 + PM2 + GitHub Actions (DT-006, DT-008) · `vercel.json` ainda existe | **DT-006/008** — EC2 |
| 4 | `.nvmrc` = **18** | CI usa Node **20** | ⏸️ não resolvido — não mexer aqui |

⚠️ **Nenhuma das quatro se corrige de passagem.** Ficam registradas em
[03-CHECKLIST-MESTRE](03-CHECKLIST-MESTRE.md), seção *achados catalogados*.
