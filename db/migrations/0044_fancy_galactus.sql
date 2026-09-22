ALTER TABLE "alertas_config" ALTER COLUMN "marcos_licenca_dias" SET DEFAULT '[90,60,30,7]'::jsonb;--> statement-breakpoint
-- 🔴 IDEMPOTENTE À MÃO — o drizzle-kit gera o statement CRU, sem `IF NOT EXISTS`.
-- Medido em 21/09/2026 contra o banco de produção: a coluna, a constraint e o índice
-- abaixo JÁ EXISTEM lá, sem linha correspondente em `drizzle.__drizzle_migrations` —
-- assinatura de `drizzle-kit push`, que sincroniza schema direto e não grava journal.
-- Como o migrator seleciona pendentes por `max(created_at)` (a 0043, menor que o `when`
-- desta), a 0044 SERÁ tentada, e o statement cru falharia com `column already exists`.
-- ⚠️ Um `generate` futuro NÃO vai recriar estas três guardas.
ALTER TABLE "autorizacoes_anvisa" ADD COLUMN IF NOT EXISTS "autorizacao_anterior_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "autorizacoes_anvisa" ADD CONSTRAINT "autorizacoes_anvisa_autorizacao_anterior_id_autorizacoes_anvisa_id_fk" FOREIGN KEY ("autorizacao_anterior_id") REFERENCES "public"."autorizacoes_anvisa"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "autorizacoes_anterior_idx" ON "autorizacoes_anvisa" USING btree ("autorizacao_anterior_id");--> statement-breakpoint
-- 🔴 MIGRACAO DE DADOS, ESCRITA A MAO — o drizzle-kit NAO gera isto.
-- O statement acima muda o DEFAULT, que so vale para linha nova. Sem o UPDATE, quem ja
-- tem '[60,30]' gravado continua com os marcos antigos e ninguem percebe: o alerta de 90 e
-- 60 dias simplesmente nao dispara para esses pacientes.
-- ⚠️ Veio do 0018_orange_goblin_queen.sql original (commit 76efb63), preservado ao renumerar
-- a migration de 0018 para 0044. Um `generate` futuro NAO vai recriar esta linha.
UPDATE "alertas_config" SET "marcos_licenca_dias" = '[90,60,30,7]'::jsonb WHERE "marcos_licenca_dias" = '[60,30]'::jsonb;
