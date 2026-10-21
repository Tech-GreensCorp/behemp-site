CREATE TYPE "public"."chatpro_diretorio_tipo" AS ENUM('departamento', 'motivo_encerramento');--> statement-breakpoint
ALTER TYPE "public"."chatpro_evento_status" ADD VALUE 'processando' BEFORE 'processado';--> statement-breakpoint
CREATE TABLE "chatpro_diretorio" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" "chatpro_diretorio_tipo" NOT NULL,
	"chatpro_id" text NOT NULL,
	"nome" text NOT NULL,
	"sincronizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatpro_sessoes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_id" text NOT NULL,
	"lead_id" text,
	"solicitacao_id" text,
	"departamento_id" text,
	"departamento_nome" text,
	"motivo_encerramento_id" text,
	"motivo_encerramento_nome" text,
	"aberta" boolean DEFAULT true NOT NULL,
	"aberta_em" timestamp with time zone,
	"fechada_em" timestamp with time zone,
	"ultimo_evento" text,
	"ultimo_evento_em" timestamp with time zone,
	"mensagens_recebidas" integer DEFAULT 0 NOT NULL,
	"mensagens_enviadas" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chatpro_sessoes" ADD CONSTRAINT "chatpro_sessoes_solicitacao_id_solicitacoes_cadastro_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacoes_cadastro"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chatpro_diretorio_tipo_id_idx" ON "chatpro_diretorio" USING btree ("tipo","chatpro_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chatpro_sessoes_session_idx" ON "chatpro_sessoes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chatpro_sessoes_lead_idx" ON "chatpro_sessoes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "chatpro_sessoes_solicitacao_idx" ON "chatpro_sessoes" USING btree ("solicitacao_id");