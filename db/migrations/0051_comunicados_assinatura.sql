CREATE TYPE "public"."comunicado_assinatura_status" AS ENUM('pendente', 'assinado', 'recusado', 'erro', 'cancelado');--> statement-breakpoint
CREATE TABLE "comunicados_assinatura" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"status" "comunicado_assinatura_status" DEFAULT 'pendente' NOT NULL,
	"enviado_por_user_id" text NOT NULL,
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"nome_destino" text NOT NULL,
	"email_destino" text NOT NULL,
	"docusign_envelope_id" text,
	"docusign_status" text,
	"assinado_em" timestamp with time zone,
	"url_pdf_assinado" text,
	"erro" text,
	"erro_em" timestamp with time zone,
	"email_envio_enviado_em" timestamp with time zone,
	"email_envio_erro" text,
	"email_confirmacao_paciente_em" timestamp with time zone,
	"email_notificacao_docs_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "comunicados_assinatura" ADD CONSTRAINT "comunicados_assinatura_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comunicados_assinatura" ADD CONSTRAINT "comunicados_assinatura_enviado_por_user_id_users_id_fk" FOREIGN KEY ("enviado_por_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comunicados_assinatura_paciente_idx" ON "comunicados_assinatura" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "comunicados_assinatura_envelope_idx" ON "comunicados_assinatura" USING btree ("docusign_envelope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comunicados_assinatura_ativo_unq" ON "comunicados_assinatura" USING btree ("paciente_id","tipo") WHERE "comunicados_assinatura"."status" in ('pendente', 'assinado');