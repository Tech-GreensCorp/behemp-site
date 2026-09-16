ALTER TABLE "alertas_config" ALTER COLUMN "marcos_licenca_dias" SET DEFAULT '[90,60,30,7]'::jsonb;--> statement-breakpoint
ALTER TABLE "autorizacoes_anvisa" ADD COLUMN "autorizacao_anterior_id" text;--> statement-breakpoint
ALTER TABLE "autorizacoes_anvisa" ADD CONSTRAINT "autorizacoes_anvisa_autorizacao_anterior_id_autorizacoes_anvisa_id_fk" FOREIGN KEY ("autorizacao_anterior_id") REFERENCES "public"."autorizacoes_anvisa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "autorizacoes_anterior_idx" ON "autorizacoes_anvisa" USING btree ("autorizacao_anterior_id");--> statement-breakpoint
-- 🔴 MIGRACAO DE DADOS, ESCRITA A MAO — o drizzle-kit NAO gera isto.
-- O statement acima muda o DEFAULT, que so vale para linha nova. Sem o UPDATE, quem ja
-- tem '[60,30]' gravado continua com os marcos antigos e ninguem percebe: o alerta de 90 e
-- 60 dias simplesmente nao dispara para esses pacientes.
-- ⚠️ Veio do 0018_orange_goblin_queen.sql original (commit 76efb63), preservado ao renumerar
-- a migration de 0018 para 0044. Um `generate` futuro NAO vai recriar esta linha.
UPDATE "alertas_config" SET "marcos_licenca_dias" = '[90,60,30,7]'::jsonb WHERE "marcos_licenca_dias" = '[60,30]'::jsonb;