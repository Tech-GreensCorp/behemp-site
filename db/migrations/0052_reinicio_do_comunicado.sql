ALTER TABLE "comunicados_assinatura" ADD COLUMN "cancelado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comunicados_assinatura" ADD COLUMN "cancelado_por_user_id" text;--> statement-breakpoint
ALTER TABLE "comunicados_assinatura" ADD COLUMN "motivo_cancelamento" text;--> statement-breakpoint
ALTER TABLE "comunicados_assinatura" ADD CONSTRAINT "comunicados_assinatura_cancelado_por_user_id_users_id_fk" FOREIGN KEY ("cancelado_por_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;