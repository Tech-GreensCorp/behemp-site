CREATE TABLE "rascunhos_revisao_ia" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"medico_id" text NOT NULL,
	"anamnese_id" text,
	"teleconsulta_id" text,
	"versao" integer DEFAULT 1 NOT NULL,
	"conteudo" jsonb NOT NULL,
	"retencao_ate" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "revisoes_ia" ADD COLUMN "por_que_ia_errou" text;--> statement-breakpoint
ALTER TABLE "revisoes_ia" ADD COLUMN "medicamento_prescrito_nome" text;--> statement-breakpoint
ALTER TABLE "revisoes_ia" ADD COLUMN "medicamento_prescrito_id" text;--> statement-breakpoint
ALTER TABLE "revisoes_ia" ADD COLUMN "fonte_rag" text DEFAULT 'revisao_humana';--> statement-breakpoint
ALTER TABLE "revisoes_ia" ADD COLUMN "ingerido_no_corpus_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rascunhos_revisao_ia" ADD CONSTRAINT "rascunhos_revisao_ia_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rascunhos_revisao_ia" ADD CONSTRAINT "rascunhos_revisao_ia_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rascunhos_revisao_paciente_idx" ON "rascunhos_revisao_ia" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "rascunhos_revisao_medico_idx" ON "rascunhos_revisao_ia" USING btree ("medico_id");--> statement-breakpoint
ALTER TABLE "revisoes_ia" ADD CONSTRAINT "revisoes_ia_medicamento_prescrito_id_medicamentos_id_fk" FOREIGN KEY ("medicamento_prescrito_id") REFERENCES "public"."medicamentos"("id") ON DELETE no action ON UPDATE no action;