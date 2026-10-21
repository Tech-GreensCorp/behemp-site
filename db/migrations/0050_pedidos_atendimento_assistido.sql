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
CREATE TABLE "chamadas_de_atendimento" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pedido_id" text NOT NULL,
	"sala" text NOT NULL,
	"aberta_por" text NOT NULL,
	"encerrada_em" timestamp with time zone,
	"encerrada_por" text,
	"retencao_ate" timestamp with time zone,
	CONSTRAINT "chamadas_de_atendimento_sala_unique" UNIQUE("sala")
);
--> statement-breakpoint
CREATE TABLE "mensagens_de_atendimento" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"chamada_id" text NOT NULL,
	"autor_id" text NOT NULL,
	"texto" text,
	"print_url" text,
	"print_tipo" text,
	"print_bytes" integer,
	"retencao_ate" timestamp with time zone,
	CONSTRAINT "mensagens_atendimento_tem_conteudo" CHECK ("mensagens_de_atendimento"."texto" is not null or "mensagens_de_atendimento"."print_url" is not null)
);
--> statement-breakpoint
ALTER TABLE "pedidos_atendimento_assistido" ADD CONSTRAINT "pedidos_atendimento_assistido_autorizacao_id_autorizacoes_anvisa_id_fk" FOREIGN KEY ("autorizacao_id") REFERENCES "public"."autorizacoes_anvisa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_atendimento_assistido" ADD CONSTRAINT "pedidos_atendimento_assistido_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_atendimento_assistido" ADD CONSTRAINT "pedidos_atendimento_assistido_ativado_por_users_id_fk" FOREIGN KEY ("ativado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_atendimento_assistido" ADD CONSTRAINT "pedidos_atendimento_assistido_desativado_por_users_id_fk" FOREIGN KEY ("desativado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamadas_de_atendimento" ADD CONSTRAINT "chamadas_de_atendimento_pedido_id_pedidos_atendimento_assistido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos_atendimento_assistido"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamadas_de_atendimento" ADD CONSTRAINT "chamadas_de_atendimento_aberta_por_users_id_fk" FOREIGN KEY ("aberta_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamadas_de_atendimento" ADD CONSTRAINT "chamadas_de_atendimento_encerrada_por_users_id_fk" FOREIGN KEY ("encerrada_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_de_atendimento" ADD CONSTRAINT "mensagens_de_atendimento_chamada_id_chamadas_de_atendimento_id_fk" FOREIGN KEY ("chamada_id") REFERENCES "public"."chamadas_de_atendimento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_de_atendimento" ADD CONSTRAINT "mensagens_de_atendimento_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedidos_atendimento_paciente_idx" ON "pedidos_atendimento_assistido" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "pedidos_atendimento_status_idx" ON "pedidos_atendimento_assistido" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_atendimento_aberto_unq" ON "pedidos_atendimento_assistido" USING btree ("autorizacao_id") WHERE "pedidos_atendimento_assistido"."status" in ('aguardando_ativacao', 'pendente_autorizacao');--> statement-breakpoint
CREATE INDEX "chamadas_atendimento_pedido_idx" ON "chamadas_de_atendimento" USING btree ("pedido_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chamadas_atendimento_aberta_unq" ON "chamadas_de_atendimento" USING btree ("pedido_id") WHERE "chamadas_de_atendimento"."encerrada_em" is null;--> statement-breakpoint
CREATE INDEX "mensagens_atendimento_chamada_idx" ON "mensagens_de_atendimento" USING btree ("chamada_id");