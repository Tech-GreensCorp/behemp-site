CREATE TYPE "public"."contato_status" AS ENUM('nao_lida', 'lida', 'respondida');--> statement-breakpoint
CREATE TABLE "contatos" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"assunto" text NOT NULL,
	"mensagem" text NOT NULL,
	"status_leitura" "contato_status" DEFAULT 'nao_lida' NOT NULL
);
