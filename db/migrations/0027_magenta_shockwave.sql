ALTER TABLE "pacientes" ADD COLUMN "ja_faz_tratamento_cannabis" boolean;--> statement-breakpoint
ALTER TABLE "pacientes" ADD COLUMN "tratamento_atual_descricao" text;--> statement-breakpoint
ALTER TABLE "solicitacoes_cadastro" ADD COLUMN "cpf" text;--> statement-breakpoint
ALTER TABLE "solicitacoes_cadastro" ADD COLUMN "ja_faz_tratamento" boolean;--> statement-breakpoint
ALTER TABLE "solicitacoes_cadastro" ADD COLUMN "tratamento_atual" text;