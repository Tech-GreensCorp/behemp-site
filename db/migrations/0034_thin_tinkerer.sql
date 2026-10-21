CREATE TABLE "consentimentos" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paciente_id" text NOT NULL,
	"finalidade" text NOT NULL,
	"versao" text NOT NULL,
	"texto_apresentado" text NOT NULL,
	"concedido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"revogado_em" timestamp with time zone,
	"origem" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consentimentos" ADD CONSTRAINT "consentimentos_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consentimentos_paciente_idx" ON "consentimentos" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "consentimentos_finalidade_idx" ON "consentimentos" USING btree ("paciente_id","finalidade");