CREATE TABLE "revisoes_ia" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"anamnese_id" text,
	"teleconsulta_id" text,
	"status" "analise_status" DEFAULT 'aguardando_validacao' NOT NULL,
	"schema_version" text,
	"saida_apresentada" jsonb,
	"hipotese_acatada_id" text,
	"hipotese_acatada_titulo" text,
	"validacao" "validacao_clinica",
	"conclusao_medico" text,
	"cid_medico" text,
	"revisado_em" timestamp with time zone,
	"revisado_por" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "revisoes_ia" ADD CONSTRAINT "revisoes_ia_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisoes_ia" ADD CONSTRAINT "revisoes_ia_anamnese_id_anamneses_id_fk" FOREIGN KEY ("anamnese_id") REFERENCES "public"."anamneses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisoes_ia" ADD CONSTRAINT "revisoes_ia_teleconsulta_id_teleconsultas_id_fk" FOREIGN KEY ("teleconsulta_id") REFERENCES "public"."teleconsultas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisoes_ia" ADD CONSTRAINT "revisoes_ia_revisado_por_medicos_id_fk" FOREIGN KEY ("revisado_por") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "revisoes_ia_paciente_idx" ON "revisoes_ia" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "revisoes_ia_status_idx" ON "revisoes_ia" USING btree ("status");--> statement-breakpoint
CREATE INDEX "revisoes_ia_anamnese_idx" ON "revisoes_ia" USING btree ("anamnese_id");--> statement-breakpoint
CREATE INDEX "revisoes_ia_teleconsulta_idx" ON "revisoes_ia" USING btree ("teleconsulta_id");