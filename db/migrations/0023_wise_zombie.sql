ALTER TABLE "medicamentos" ADD COLUMN "teor_thc_percentual" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "itens_ajuste_dosagem" ADD COLUMN "medicamento_id" text;--> statement-breakpoint
ALTER TABLE "itens_ajuste_dosagem" ADD COLUMN "dosagem_anterior_id" text;--> statement-breakpoint
ALTER TABLE "itens_ajuste_dosagem" ADD COLUMN "nova_dosagem_id" text;--> statement-breakpoint
ALTER TABLE "itens_ajuste_dosagem" ADD CONSTRAINT "itens_ajuste_dosagem_medicamento_id_medicamentos_id_fk" FOREIGN KEY ("medicamento_id") REFERENCES "public"."medicamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_ajuste_dosagem" ADD CONSTRAINT "itens_ajuste_dosagem_dosagem_anterior_id_dosagens_id_fk" FOREIGN KEY ("dosagem_anterior_id") REFERENCES "public"."dosagens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_ajuste_dosagem" ADD CONSTRAINT "itens_ajuste_dosagem_nova_dosagem_id_dosagens_id_fk" FOREIGN KEY ("nova_dosagem_id") REFERENCES "public"."dosagens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "itens_ajuste_medicamento_idx" ON "itens_ajuste_dosagem" USING btree ("medicamento_id");