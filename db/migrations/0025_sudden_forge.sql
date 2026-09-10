CREATE TYPE "public"."chatpro_evento_status" AS ENUM('pendente', 'processado', 'descartado', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."solicitacao_cadastro_origem" AS ENUM('painel_admin', 'chatpro_bot', 'chatpro_start', 'chatpro_start_nao_verificado', 'chatpro_webhook');--> statement-breakpoint
CREATE TYPE "public"."solicitacao_cadastro_status" AS ENUM('link_gerado', 'link_acessado', 'enviada', 'expirada', 'cancelada');--> statement-breakpoint
CREATE TABLE "solicitacoes_cadastro" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"protocolo" text NOT NULL,
	"nome_completo" text,
	"email" text,
	"telefone" text,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"primeiro_acesso_em" timestamp with time zone,
	"status" "solicitacao_cadastro_status" DEFAULT 'link_gerado' NOT NULL,
	"origem" "solicitacao_cadastro_origem" DEFAULT 'painel_admin' NOT NULL,
	"chatpro_lead_id" text,
	"chatpro_session_id" text,
	"canal_de_entrega" text,
	"entregue_em" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chatpro_eventos" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evento" text NOT NULL,
	"session_id" text NOT NULL,
	"evento_ts" text NOT NULL,
	"lead_id" text,
	"payload" jsonb NOT NULL,
	"status" "chatpro_evento_status" DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"ultimo_erro" text,
	"processado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "solicitacoes_cadastro_protocolo_idx" ON "solicitacoes_cadastro" USING btree ("protocolo");--> statement-breakpoint
CREATE UNIQUE INDEX "solicitacoes_cadastro_token_idx" ON "solicitacoes_cadastro" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "solicitacoes_cadastro_lead_idx" ON "solicitacoes_cadastro" USING btree ("chatpro_lead_id");--> statement-breakpoint
CREATE INDEX "solicitacoes_cadastro_telefone_idx" ON "solicitacoes_cadastro" USING btree ("telefone");--> statement-breakpoint
CREATE INDEX "solicitacoes_cadastro_status_idx" ON "solicitacoes_cadastro" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "chatpro_eventos_dedup_idx" ON "chatpro_eventos" USING btree ("evento","session_id","evento_ts");--> statement-breakpoint
CREATE INDEX "chatpro_eventos_fila_idx" ON "chatpro_eventos" USING btree ("status","created_at");