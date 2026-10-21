DROP INDEX "chatpro_diretorio_tipo_id_idx";--> statement-breakpoint
ALTER TABLE "chatpro_diretorio" ADD COLUMN "conta" text DEFAULT 'behemp' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chatpro_diretorio_tipo_id_idx" ON "chatpro_diretorio" USING btree ("conta","tipo","chatpro_id");