ALTER TYPE "public"."pagamento_status" ADD VALUE 'em_processamento';--> statement-breakpoint
ALTER TYPE "public"."pagamento_status" ADD VALUE 'recusado';--> statement-breakpoint
CREATE TABLE "mercadopago_eventos_webhook" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mp_payment_id" text NOT NULL,
	"processado_em" timestamp with time zone,
	CONSTRAINT "mercadopago_eventos_webhook_mp_payment_id_unique" UNIQUE("mp_payment_id")
);
--> statement-breakpoint
ALTER TABLE "consultas" ADD COLUMN "pix_valido_ate" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "medicos_mercadopago_conta" ADD COLUMN "public_key" text;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_gateway_referencia_unique" UNIQUE("gateway_referencia_id");