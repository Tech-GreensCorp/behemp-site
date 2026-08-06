CREATE TYPE "public"."docusign_status" AS ENUM('nao_enviado', 'enviado', 'visualizado', 'assinado', 'concluido', 'recusado', 'expirado', 'erro');--> statement-breakpoint
CREATE TABLE "procuracoes_especificas" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"autorizacao_id" text,
	"nome_completo" text NOT NULL,
	"cpf" text,
	"rg" text,
	"nacionalidade" text,
	"estado_civil" text,
	"profissao" text,
	"email" text NOT NULL,
	"telefone" text,
	"endereco" text,
	"cep" text,
	"cidade" text,
	"uf" text,
	"docusign_status" "docusign_status" DEFAULT 'nao_enviado' NOT NULL,
	"docusign_envelope_id" text,
	"docusign_envelope_url" text,
	"url_pdf_gerado" text,
	"url_pdf_assinado" text,
	"assinado_em" timestamp with time zone,
	"expirado_em" timestamp with time zone,
	"stub_ativo" boolean DEFAULT true,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pacientes" ADD COLUMN "nacionalidade" text DEFAULT 'brasileiro(a)';--> statement-breakpoint
ALTER TABLE "pacientes" ADD COLUMN "estado_civil" text;--> statement-breakpoint
ALTER TABLE "pacientes" ADD COLUMN "profissao" text;--> statement-breakpoint
ALTER TABLE "procuracoes_especificas" ADD CONSTRAINT "procuracoes_especificas_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procuracoes_especificas" ADD CONSTRAINT "procuracoes_especificas_autorizacao_id_autorizacoes_anvisa_id_fk" FOREIGN KEY ("autorizacao_id") REFERENCES "public"."autorizacoes_anvisa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "procuracoes_paciente_idx" ON "procuracoes_especificas" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "procuracoes_autorizacao_idx" ON "procuracoes_especificas" USING btree ("autorizacao_id");--> statement-breakpoint
CREATE INDEX "procuracoes_docusign_status_idx" ON "procuracoes_especificas" USING btree ("docusign_status");--> statement-breakpoint
CREATE INDEX "procuracoes_envelope_idx" ON "procuracoes_especificas" USING btree ("docusign_envelope_id");