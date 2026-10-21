ALTER TYPE "public"."solicitacao_cadastro_origem" ADD VALUE 'greens_handoff';--> statement-breakpoint
ALTER TABLE "solicitacoes_cadastro" ADD COLUMN "parceiro" text;--> statement-breakpoint
ALTER TABLE "solicitacoes_cadastro" ADD COLUMN "evento_do_parceiro" text;--> statement-breakpoint
ALTER TABLE "solicitacoes_cadastro" ADD COLUMN "pedido_do_parceiro" text;--> statement-breakpoint
CREATE INDEX "solicitacoes_cadastro_evento_parceiro_idx" ON "solicitacoes_cadastro" USING btree ("evento_do_parceiro");