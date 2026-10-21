ALTER TABLE "teleconsultas" ADD COLUMN "consent_teleconsulta_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "consent_teleconsulta_por" text;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "consent_teleconsulta_versao" text;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "emergencia_medica" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD COLUMN "emergencia_motivo" text;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD CONSTRAINT "teleconsultas_consent_teleconsulta_por_users_id_fk" FOREIGN KEY ("consent_teleconsulta_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;