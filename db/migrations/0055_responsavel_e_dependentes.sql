CREATE TYPE "public"."vinculo_responsavel_status" AS ENUM('ativo', 'encerrado');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'responsavel';--> statement-breakpoint
CREATE TABLE "responsaveis" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"cpf" text,
	CONSTRAINT "responsaveis_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "responsaveis_pacientes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responsavel_user_id" text NOT NULL,
	"paciente_id" text NOT NULL,
	"parentesco" text NOT NULL,
	"status" "vinculo_responsavel_status" DEFAULT 'ativo' NOT NULL,
	"encerrado_em" timestamp with time zone,
	"encerrado_por_user_id" text,
	"motivo" text
);
--> statement-breakpoint
ALTER TABLE "responsaveis" ADD CONSTRAINT "responsaveis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsaveis_pacientes" ADD CONSTRAINT "responsaveis_pacientes_responsavel_user_id_users_id_fk" FOREIGN KEY ("responsavel_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsaveis_pacientes" ADD CONSTRAINT "responsaveis_pacientes_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsaveis_pacientes" ADD CONSTRAINT "responsaveis_pacientes_encerrado_por_user_id_users_id_fk" FOREIGN KEY ("encerrado_por_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "responsaveis_pacientes_ativo_unq" ON "responsaveis_pacientes" USING btree ("paciente_id") WHERE "responsaveis_pacientes"."status" = 'ativo';--> statement-breakpoint
CREATE INDEX "responsaveis_pacientes_responsavel_idx" ON "responsaveis_pacientes" USING btree ("responsavel_user_id");