# Stage 1: Dependências
FROM node:20-alpine AS deps
# Adiciona bibliotecas de compatibilidade para o Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Instala o pnpm globalmente
RUN npm install -g pnpm

# Copia os arquivos que definem as dependências
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Instala as dependências de acordo com o lockfile
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copia os node_modules instalados e o restante dos arquivos do projeto
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Argumentos de Build para variáveis NEXT_PUBLIC_ (necessárias no Next.js build time)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
ARG NEXT_PUBLIC_SHEETS_SPREADSHEET_ID
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER
ARG NEXT_PUBLIC_WHATSAPP_BEHEMP

# Define as variáveis como ENVs para que o build as colete
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
ENV NEXT_PUBLIC_SHEETS_SPREADSHEET_ID=$NEXT_PUBLIC_SHEETS_SPREADSHEET_ID
ENV NEXT_PUBLIC_PUSHER_KEY=$NEXT_PUBLIC_PUSHER_KEY
ENV NEXT_PUBLIC_PUSHER_CLUSTER=$NEXT_PUBLIC_PUSHER_CLUSTER
ENV NEXT_PUBLIC_WHATSAPP_BEHEMP=$NEXT_PUBLIC_WHATSAPP_BEHEMP

# DATABASE_URL fictícia necessária para validar variáveis com Zod (lib/env.ts) durante build
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV NEXT_TELEMETRY_DISABLED=1
# Aumenta o limite de memória do Node para evitar erro de OOM (Out of Memory) no build
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Executa o build da aplicação Next.js
RUN pnpm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia arquivos estáticos públicos
COPY --from=builder /app/public ./public

# Configura permissões e copia a build standalone gerada
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# O Next.js standalone gera um server.js na raiz da pasta standalone
CMD ["node", "server.js"]
