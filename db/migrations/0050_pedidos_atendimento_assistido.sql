CREATE TYPE "public"."pedido_atendimento_status" AS ENUM('aguardando_ativacao', 'pendente_autorizacao', 'concluido', 'rejeitado_anvisa');--> statement-breakpoint
CREATE TABLE "pedidos_atendimento_assistido" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"autorizacao_id" text NOT NULL,
	"paciente_id" text NOT NULL,
	"status" "pedido_atendimento_status" DEFAULT 'aguardando_ativacao' NOT NULL,
	"pedido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ativado_por" text,
	"ativado_em" timestamp with time zone,
	"desativado_por" text,
	"desativado_em" timestamp with time zone,
	"encerrado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pedidos_atendimento_assistido" ADD CONSTRAINT "pedidos_atendimento_assistido_autorizacao_id_autorizacoes_anvisa_id_fk" FOREIGN KEY ("autorizacao_id") REFERENCES "public"."autorizacoes_anvisa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_atendimento_assistido" ADD CONSTRAINT "pedidos_atendimento_assistido_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_atendimento_assistido" ADD CONSTRAINT "pedidos_atendimento_assistido_ativado_por_users_id_fk" FOREIGN KEY ("ativado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_atendimento_assistido" ADD CONSTRAINT "pedidos_atendimento_assistido_desativado_por_users_id_fk" FOREIGN KEY ("desativado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedidos_atendimento_paciente_idx" ON "pedidos_atendimento_assistido" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "pedidos_atendimento_status_idx" ON "pedidos_atendimento_assistido" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_atendimento_aberto_unq" ON "pedidos_atendimento_assistido" USING btree ("autorizacao_id") WHERE "pedidos_atendimento_assistido"."status" in ('aguardando_ativacao', 'pendente_autorizacao');