CREATE TYPE "public"."teleconsulta_status" AS ENUM('aguardando', 'em_andamento', 'encerrada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."transcricao_status" AS ENUM('pendente', 'processando', 'concluida', 'erro');--> statement-breakpoint
CREATE TABLE "teleconsultas" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consulta_id" text,
	"medico_id" text NOT NULL,
	"paciente_id" text NOT NULL,
	"room_id" text NOT NULL,
	"status" "teleconsulta_status" DEFAULT 'aguardando' NOT NULL,
	"iniciada_em" timestamp with time zone,
	"encerrada_em" timestamp with time zone,
	"duracao_segundos" integer,
	"consentimento_lgpd" boolean DEFAULT false,
	"consentimento_em" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "teleconsultas_room_id_unique" UNIQUE("room_id")
);
--> statement-breakpoint
CREATE TABLE "transcricoes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teleconsulta_id" text NOT NULL,
	"medico_id" text NOT NULL,
	"paciente_id" text NOT NULL,
	"status" "transcricao_status" DEFAULT 'pendente' NOT NULL,
	"consentimento_obtido" boolean DEFAULT false NOT NULL,
	"texto_completo" text,
	"narrativa" text,
	"hash_texto" text,
	"duracao_segundos" integer,
	"modelo_usado" text DEFAULT 'gemini-2.5-flash',
	"erro_mensagem" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD CONSTRAINT "teleconsultas_consulta_id_consultas_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD CONSTRAINT "teleconsultas_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teleconsultas" ADD CONSTRAINT "teleconsultas_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcricoes" ADD CONSTRAINT "transcricoes_teleconsulta_id_teleconsultas_id_fk" FOREIGN KEY ("teleconsulta_id") REFERENCES "public"."teleconsultas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcricoes" ADD CONSTRAINT "transcricoes_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcricoes" ADD CONSTRAINT "transcricoes_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teleconsultas_medico_idx" ON "teleconsultas" USING btree ("medico_id");--> statement-breakpoint
CREATE INDEX "teleconsultas_paciente_idx" ON "teleconsultas" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "teleconsultas_room_idx" ON "teleconsultas" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "teleconsultas_status_idx" ON "teleconsultas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transcricoes_teleconsulta_idx" ON "transcricoes" USING btree ("teleconsulta_id");--> statement-breakpoint
CREATE INDEX "transcricoes_medico_idx" ON "transcricoes" USING btree ("medico_id");--> statement-breakpoint
CREATE INDEX "transcricoes_status_idx" ON "transcricoes" USING btree ("status");