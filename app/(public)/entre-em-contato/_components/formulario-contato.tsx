'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, CheckmarkCircle01Icon, AlertCircleIcon } from '@hugeicons/core-free-icons';
import { enviarMensagemContato } from '@/app/(public)/_actions/contato';

/**
 * Formulário de contato com estado gerenciado no client.
 * Chama a Server Action ao submeter.
 */
export function FormularioContato() {
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    assunto: '',
    mensagem: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErro(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const resultado = await enviarMensagemContato(form);

    if (resultado.sucesso) {
      setEnviado(true);
      setForm({ nome: '', email: '', assunto: '', mensagem: '' });
    } else {
      setErro(resultado.erro ?? 'Erro ao enviar mensagem.');
    }

    setCarregando(false);
  }

  /* ── Estado de sucesso ── */
  if (enviado) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={32} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Mensagem enviada!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Nossa equipe responderá em breve. Você receberá uma confirmação no e-mail informado.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEnviado(false)}
            className="mt-2"
          >
            Enviar outra mensagem
          </Button>
        </CardContent>
      </Card>
    );
  }

  /* ── Formulário ── */
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Nome
              </Label>
              <Input
                name="nome"
                value={form.nome}
                onChange={handleChange}
                placeholder="Seu nome"
                className="bg-background"
                required
                disabled={carregando}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                E-mail
              </Label>
              <Input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                className="bg-background"
                required
                disabled={carregando}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Assunto
            </Label>
            <Input
              name="assunto"
              value={form.assunto}
              onChange={handleChange}
              placeholder="Sobre o que deseja conversar?"
              className="bg-background"
              required
              disabled={carregando}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Mensagem
            </Label>
            <Textarea
              name="mensagem"
              value={form.mensagem}
              onChange={handleChange}
              placeholder="Escreva sua mensagem..."
              rows={4}
              className="bg-background"
              required
              disabled={carregando}
            />
          </div>

          {/* Erro */}
          {erro && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <HugeiconsIcon icon={AlertCircleIcon} size={16} />
              {erro}
            </div>
          )}

          <Button
            type="submit"
            disabled={carregando}
            className="btn-pill w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {carregando ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Enviando...
              </>
            ) : (
              <>
                Enviar mensagem
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
