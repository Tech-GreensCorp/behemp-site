CREATE TYPE "public"."conta_bancaria_tipo" AS ENUM('corrente', 'poupanca');--> statement-breakpoint
CREATE TYPE "public"."pix_tipo_chave" AS ENUM('cpf', 'cnpj', 'email', 'telefone', 'aleatoria');--> statement-breakpoint
CREATE TABLE "medicos_pagamento_config" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"medico_id" text NOT NULL,
	"pix_habilitado" boolean DEFAULT false NOT NULL,
	"boleto_habilitado" boolean DEFAULT false NOT NULL,
	"cartao_credito_habilitado" boolean DEFAULT false NOT NULL,
	"cartao_debito_habilitado" boolean DEFAULT false NOT NULL,
	"pix_tipo_chave" "pix_tipo_chave",
	"pix_chave" text,
	"banco_nome" text,
	"banco_agencia" text,
	"banco_conta" text,
	"banco_conta_tipo" "conta_bancaria_tipo",
	"banco_titular_nome" text,
	"banco_titular_documento" text,
	"observacoes" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "medicos_pagamento_config_medico_id_unique" UNIQUE("medico_id")
);
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN "email_reserva_enviado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "medicos_pagamento_config" ADD CONSTRAINT "medicos_pagamento_config_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;