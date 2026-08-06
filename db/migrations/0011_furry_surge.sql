CREATE TYPE "public"."anvisa_documento_tipo" AS ENUM('receita_medica', 'rg_paciente', 'rg_responsavel', 'comprovante_residencia', 'laudo_medico', 'termo_responsabilidade', 'certidao_nascimento');--> statement-breakpoint
CREATE TYPE "public"."anvisa_status" AS ENUM('pendente', 'documentos_enviados', 'em_analise', 'aprovado', 'pendencia_documental', 'rejeitado');--> statement-breakpoint
CREATE TABLE "autorizacoes_anvisa" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"medico_id" text NOT NULL,
	"prescricao_id" text,
	"status" "anvisa_status" DEFAULT 'pendente' NOT NULL,
	"numero_processo" text,
	"data_envio" timestamp with time zone,
	"data_aprovacao" timestamp with time zone,
	"prazo_estimado" date,
	"observacoes_anvisa" text,
	"documentos" jsonb DEFAULT '[]'::jsonb,
	"formulario_8833" jsonb DEFAULT '{}'::jsonb,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "autorizacoes_anvisa" ADD CONSTRAINT "autorizacoes_anvisa_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autorizacoes_anvisa" ADD CONSTRAINT "autorizacoes_anvisa_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autorizacoes_anvisa" ADD CONSTRAINT "autorizacoes_anvisa_prescricao_id_prescricoes_id_fk" FOREIGN KEY ("prescricao_id") REFERENCES "public"."prescricoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "autorizacoes_paciente_idx" ON "autorizacoes_anvisa" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "autorizacoes_status_idx" ON "autorizacoes_anvisa" USING btree ("status");--> statement-breakpoint
CREATE INDEX "autorizacoes_prescricao_idx" ON "autorizacoes_anvisa" USING btree ("prescricao_id");