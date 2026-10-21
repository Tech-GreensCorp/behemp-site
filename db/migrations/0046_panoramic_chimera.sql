CREATE TABLE "medicos_mercadopago_conta" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"medico_id" text NOT NULL,
	"mp_user_id" text,
	"access_token_cifrado" text,
	"refresh_token_cifrado" text,
	"token_expira_em" timestamp with time zone,
	"conectado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"desconectado_em" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "medicos_mercadopago_conta_medico_id_unique" UNIQUE("medico_id")
);
--> statement-breakpoint
ALTER TABLE "medicos_mercadopago_conta" ADD CONSTRAINT "medicos_mercadopago_conta_medico_id_medicos_id_fk" FOREIGN KEY ("medico_id") REFERENCES "public"."medicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medicos_mercadopago_conta_mp_user_idx" ON "medicos_mercadopago_conta" USING btree ("mp_user_id");