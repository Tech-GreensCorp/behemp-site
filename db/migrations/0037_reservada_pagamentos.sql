CREATE TYPE "public"."pagamento_status" AS ENUM('pendente', 'pago', 'isento', 'cancelado', 'estornado');--> statement-breakpoint
CREATE TABLE "pagamentos" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consulta_id" text NOT NULL,
	"paciente_id" text NOT NULL,
	"medico_id" text NOT NULL,
	"data_hora" timestamp with time zone NOT NULL,
	"valor" numeric(10, 2) NOT NULL,
	"moeda" text DEFAULT 'BRL' NOT NULL,
	"status" "pagamento_status" DEFAULT 'pendente' NOT NULL,
	"gateway_provider" text,
	"gateway_referencia_id" text,
	"gateway_checkout_url" text,
	"pago_em" timestamp with time zone,
	"observacoes" text,
	"iniciado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"pagamento_iniciado_em" timestamp with time zone,
	"pagamento_concluido_em" timestamp with time zone,
	"pagamento_erro_em" timestamp with time zone,
	"confirmado_em" timestamp with time zone,
	"erro_confirmacao" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pagamentos_config" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valor_consulta_padrao" numeric(10, 2) DEFAULT '150.00' NOT NULL,
	"moeda_padrao" text DEFAULT 'BRL' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultas" ALTER COLUMN "status" SET DEFAULT 'reservada';--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN "expira_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN "email_paciente_enviado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN "email_medico_enviado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN "google_calendar_erro" text;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_consulta_id_consultas_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pagamentos_consulta_idx" ON "pagamentos" USING btree ("consulta_id");--> statement-breakpoint
CREATE INDEX "pagamentos_paciente_idx" ON "pagamentos" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "pagamentos_medico_idx" ON "pagamentos" USING btree ("medico_id");--> statement-breakpoint
CREATE INDEX "pagamentos_status_idx" ON "pagamentos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "consultas_expira_idx" ON "consultas" USING btree ("expira_em");--> statement-breakpoint
CREATE UNIQUE INDEX "consultas_medico_datahora_ativa_idx" ON "consultas" USING btree ("medico_id","data_hora") WHERE "consultas"."status" in ('reservada', 'agendada', 'confirmada') and "consultas"."deleted_at" is null;
