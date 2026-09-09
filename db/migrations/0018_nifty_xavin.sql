CREATE TYPE "public"."analise_status" AS ENUM('em_andamento', 'aguardando_validacao', 'concluido');--> statement-breakpoint
CREATE TYPE "public"."validacao_clinica" AS ENUM('validado', 'divergente');--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "consentimento_paciente_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "consentimento_paciente_por" text;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "consentimento_medico_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "consentimento_medico_por" text;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "consentimento_versao_texto" text;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "consentimento_revogado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "consentimento_revogado_por" text;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD CONSTRAINT "teleconsultas_consentimento_paciente_por_users_id_fk" FOREIGN KEY ("consentimento_paciente_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD CONSTRAINT "teleconsultas_consentimento_medico_por_users_id_fk" FOREIGN KEY ("consentimento_medico_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD CONSTRAINT "teleconsultas_consentimento_revogado_por_users_id_fk" FOREIGN KEY ("consentimento_revogado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;