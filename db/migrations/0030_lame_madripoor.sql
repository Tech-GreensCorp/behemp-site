CREATE TYPE "public"."parceiro_evento_saida_status" AS ENUM('pendente', 'enviando', 'enviado', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."parceiro_evento_tipo" AS ENUM('receita_emitida', 'anvisa_concluida');--> statement-breakpoint
CREATE TABLE "parceiro_eventos_saida" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parceiro" text NOT NULL,
	"tipo" "parceiro_evento_tipo" NOT NULL,
	"solicitacao_id" text NOT NULL,
	"referral_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "parceiro_evento_saida_status" DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"ultimo_erro" text,
	"proxima_tentativa_em" timestamp with time zone DEFAULT now(),
	"enviado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "parceiro_eventos_saida" ADD CONSTRAINT "parceiro_eventos_saida_solicitacao_id_solicitacoes_cadastro_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacoes_cadastro"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "parceiro_eventos_saida_fato_idx" ON "parceiro_eventos_saida" USING btree ("parceiro","tipo","solicitacao_id");--> statement-breakpoint
CREATE INDEX "parceiro_eventos_saida_fila_idx" ON "parceiro_eventos_saida" USING btree ("status","proxima_tentativa_em");