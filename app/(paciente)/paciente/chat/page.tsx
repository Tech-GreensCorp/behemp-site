'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, User, Stethoscope } from 'lucide-react';

const MENSAGENS_MOCK = [
  { id: '1', remetente: 'medico', nome: 'Dr. André Lima', texto: 'Olá Maria, como está se sentindo com a nova dosagem?', data: '2026-05-04 09:30' },
  { id: '2', remetente: 'paciente', nome: 'Maria Silva', texto: 'Bom dia, doutor! Estou me sentindo melhor, as dores diminuíram bastante.', data: '2026-05-04 09:45' },
  { id: '3', remetente: 'medico', nome: 'Dr. André Lima', texto: 'Excelente! Continue com 15 gotas/dia. Na próxima consulta vamos reavaliar.', data: '2026-05-04 09:50' },
  { id: '4', remetente: 'paciente', nome: 'Maria Silva', texto: 'Perfeito, obrigada! Uma dúvida: posso tomar antes de dormir?', data: '2026-05-04 10:05' },
  { id: '5', remetente: 'medico', nome: 'Dr. André Lima', texto: 'Pode sim. Inclusive recomendo que tome 30min antes de deitar. Vai ajudar com o sono também.', data: '2026-05-04 10:12' },
];

export default function ChatPage() {
  const [mensagem, setMensagem] = useState('');
  const [mensagens, setMensagens] = useState(MENSAGENS_MOCK);

  const enviarMensagem = () => {
    if (!mensagem.trim()) return;
    setMensagens([
      ...mensagens,
      {
        id: String(mensagens.length + 1),
        remetente: 'paciente',
        nome: 'Maria Silva',
        texto: mensagem,
        data: new Date().toISOString(),
      },
    ]);
    setMensagem('');
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Converse com seu médico
        </p>
      </div>

      {/* Mensagens */}
      <Card className="flex-1 overflow-hidden border-0 shadow-sm">
        <CardContent className="flex h-full flex-col p-0">
          {/* Header do chat */}
          <div className="flex items-center gap-3 border-b p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Dr. André Lima</p>
              <p className="text-xs text-muted-foreground">Neurologia</p>
            </div>
          </div>

          {/* Área de mensagens */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${
                  msg.remetente === 'paciente' ? 'flex-row-reverse' : ''
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  msg.remetente === 'medico' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  {msg.remetente === 'medico' ? (
                    <Stethoscope className="h-4 w-4 text-primary" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    msg.remetente === 'paciente'
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : 'rounded-bl-md bg-muted'
                  }`}
                >
                  <p className="text-sm">{msg.texto}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarMensagem();
              }}
              className="flex gap-2"
            >
              <Input
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!mensagem.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
