CREATE TYPE "public"."estampa_tipo" AS ENUM('nenhuma', 'medico');--> statement-breakpoint
CREATE TYPE "public"."prescricao_status" AS ENUM('rascunho', 'emitida', 'assinada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."prescricao_tipo" AS ENUM('simples', 'controle_especial', 'personalizado');--> statement-breakpoint
CREATE TYPE "public"."provedor_assinatura" AS ENUM('vidaas', 'birdid');--> statement-breakpoint
CREATE TABLE "receituario_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"medico_id" text,
	"nome" text NOT NULL,
	"tipo" "prescricao_tipo" DEFAULT 'simples' NOT NULL,
	"padrao" boolean DEFAULT false,
	"ativo" boolean DEFAULT true,
	"config" jsonb,
	"layout_html" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "prescricoes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"medico_id" text NOT NULL,
	"paciente_id" text NOT NULL,
	"consulta_id" text,
	"template_id" text,
	"tipo" "prescricao_tipo" DEFAULT 'simples' NOT NULL,
	"status" "prescricao_status" DEFAULT 'rascunho' NOT NULL,
	"medicamentos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"diagnostico" text,
	"cid" text,
	"observacoes" text,
	"orientacoes" text,
	"validade" timestamp with time zone NOT NULL,
	"url_pdf" text,
	"url_pdf_assinado" text,
	"assinada_digital" boolean DEFAULT false,
	"hash_assinatura" text,
	"certificado_cn" text,
	"provedor_assinatura" "provedor_assinatura",
	"numero_sncr" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "receituario_templates" ADD CONSTRAINT "receituario_templates_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_consulta_id_consultas_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_template_id_receituario_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."receituario_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receituario_templates_medico_idx" ON "receituario_templates" USING btree ("medico_id");--> statement-breakpoint
CREATE INDEX "receituario_templates_ativo_idx" ON "receituario_templates" USING btree ("ativo");--> statement-breakpoint
CREATE INDEX "prescricoes_medico_idx" ON "prescricoes" USING btree ("medico_id");--> statement-breakpoint
CREATE INDEX "prescricoes_paciente_idx" ON "prescricoes" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "prescricoes_status_idx" ON "prescricoes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prescricoes_consulta_idx" ON "prescricoes" USING btree ("consulta_id");