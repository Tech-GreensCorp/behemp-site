CREATE TYPE "public"."plano_tratamento_status" AS ENUM('draft', 'completed');--> statement-breakpoint
CREATE TABLE "planos_tratamento" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"plano_number" text NOT NULL,
	"status" "plano_tratamento_status" DEFAULT 'draft' NOT NULL,
	"paciente_id" text,
	"patient_name" text NOT NULL,
	"cpf" text NOT NULL,
	"data_adesao" date NOT NULL,
	"periodo_meses" integer DEFAULT 12 NOT NULL,
	"medicamento" text NOT NULL,
	"qtd_frascos" integer NOT NULL,
	"valor_frasco" numeric(10, 2) NOT NULL,
	"desconto_pct" numeric(5, 2) NOT NULL,
	"qtd_consultas" integer NOT NULL,
	"valor_consulta" numeric(10, 2) NOT NULL,
	"qtd_fretes" integer NOT NULL,
	"valor_frete" numeric(10, 2) NOT NULL,
	"parcelas" integer NOT NULL,
	"forma_pagamento" text NOT NULL,
	"subtotal_medicamentos" numeric(10, 2) NOT NULL,
	"valor_subsidio" numeric(10, 2) NOT NULL,
	"medicamentos_liquido" numeric(10, 2) NOT NULL,
	"total_consultas" numeric(10, 2) NOT NULL,
	"total_fretes" numeric(10, 2) NOT NULL,
	"total_adesao" numeric(10, 2) NOT NULL,
	"valor_parcela" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planos_tratamento" ADD CONSTRAINT "planos_tratamento_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "planos_tratamento_number_unq" ON "planos_tratamento" USING btree ("plano_number") WHERE "planos_tratamento"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "planos_tratamento_status_idx" ON "planos_tratamento" USING btree ("status");--> statement-breakpoint
CREATE INDEX "planos_tratamento_paciente_idx" ON "planos_tratamento" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "planos_tratamento_data_adesao_idx" ON "planos_tratamento" USING btree ("data_adesao");