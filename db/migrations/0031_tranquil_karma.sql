ALTER TABLE "solicitacoes_cadastro" ADD COLUMN "paciente_id" text;--> statement-breakpoint
CREATE INDEX "solicitacoes_cadastro_paciente_idx" ON "solicitacoes_cadastro" USING btree ("paciente_id");