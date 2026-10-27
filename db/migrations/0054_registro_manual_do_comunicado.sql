ALTER TABLE "comunicados_assinatura" ADD COLUMN "registro_manual_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comunicados_assinatura" ADD COLUMN "registro_manual_por_user_id" text;--> statement-breakpoint
ALTER TABLE "comunicados_assinatura" ADD COLUMN "registro_manual_observacao" text;--> statement-breakpoint
ALTER TABLE "comunicados_assinatura" ADD COLUMN "registro_manual_nome_arquivo" text;--> statement-breakpoint
ALTER TABLE "comunicados_assinatura" ADD CONSTRAINT "comunicados_assinatura_registro_manual_por_user_id_users_id_fk" FOREIGN KEY ("registro_manual_por_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;