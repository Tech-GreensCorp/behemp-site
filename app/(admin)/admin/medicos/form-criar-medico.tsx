'use client';

/**
 * Formulário de médico — CRIAR e EDITAR no mesmo componente (23/09/2026).
 *
 * ⚠️ O nome do arquivo é histórico: ele nasceu só para criar. O componente virou
 * `FormMedico` porque passou a fazer as duas coisas; renomear o arquivo ficou para uma
 * limpeza própria, para não misturar rename com mudança de comportamento (`DO-35`).
 *
 * 🔴 O MODO DE EDIÇÃO SÓ MOSTRA O QUE `atualizarDadosMedico` ESCREVE.
 * Ela grava `especialidade`, `crm`, `bio`, `ordem` e `valorConsulta` — e mais nada. Foto,
 * nome e senha ficam de fora do modo de edição porque a action não os toca: um campo de
 * foto que aceita upload e não muda a foto é a tela mentindo, e mentira de tela é pior que
 * campo ausente, porque quem usa acredita que salvou.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { criarMedico, atualizarDadosMedico } from '@/app/_actions/admin-medicos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  X,
  Eye,
  EyeOff,
  Pencil,
  Save,
} from 'lucide-react';

/** O que a edição precisa saber do médico. É um subconjunto de `MedicoResumo`. */
export interface MedicoEmEdicao {
  medicoId: string;
  nome: string;
  email: string;
  especialidade: string;
  crm: string | null;
  bio: string | null;
  ordem: number | null;
  valorConsulta: number | null;
}

type Estado =
  | { tipo: 'idle' }
  | { tipo: 'carregando' }
  | { tipo: 'sucesso'; medicoId: string }
  | { tipo: 'salvo' }
  | { tipo: 'erro'; mensagem: string };

interface FormMedicoProps {
  /** Ausente = cadastrar. Presente = editar este médico. */
  medico?: MedicoEmEdicao;
  /** Só existe no modo de edição — devolve a tela ao modo de cadastro. */
  aoCancelar?: () => void;
}

export function FormMedico({ medico, aoCancelar }: FormMedicoProps) {
  const router = useRouter();
  const editando = medico !== undefined;

  const [estado, setEstado] = React.useState<Estado>({ tipo: 'idle' });
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [mostrarSenha, setMostrarSenha] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
      setEstado({ tipo: 'erro', mensagem: 'Tipo de imagem não permitido. Use JPG, PNG ou WebP.' });
      return;
    }

    // Validar tamanho (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setEstado({ tipo: 'erro', mensagem: 'Imagem excede 2MB.' });
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removerAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * O caminho da EDIÇÃO. Sai cedo, antes de qualquer coisa ligada a conta/foto — não há
   * upload nem Clerk aqui.
   */
  const submeterEdicao = async (data: FormData, medicoId: string) => {
    const ordemStr = (data.get('ordem') as string) ?? '';
    const valorConsulta = ((data.get('valorConsulta') as string) ?? '').trim();

    const resultado = await atualizarDadosMedico({
      medicoId,
      especialidade: (data.get('especialidade') as string).trim(),
      crm: ((data.get('crm') as string) ?? '').trim() || undefined,
      bio: ((data.get('bio') as string) ?? '').trim() || undefined,
      ordem: ordemStr ? parseInt(ordemStr, 10) : undefined,
      valorConsulta: valorConsulta || undefined,
    });

    if (resultado.sucesso) {
      setEstado({ tipo: 'salvo' });
      // Sem `form.reset()`: os `defaultValue` são os valores ANTIGOS, e resetar mostraria
      // ao admin exatamente o que ele acabou de mudar, como se não tivesse salvo.
      router.refresh();
    } else {
      setEstado({ tipo: 'erro', mensagem: resultado.erro ?? 'Erro desconhecido' });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEstado({ tipo: 'carregando' });

    const form = e.currentTarget;
    const data = new FormData(form);

    if (medico) {
      await submeterEdicao(data, medico.medicoId);
      return;
    }

    const ordemStr = data.get('ordem') as string;
    const nome = (data.get('nome') as string).trim();
    const senha = (data.get('senha') as string).trim();
    const valorConsulta = (data.get('valorConsulta') as string).trim();

    // Upload do avatar se selecionado
    let avatarUrl: string | undefined;
    if (avatarFile) {
      setUploadingAvatar(true);
      try {
        const uploadForm = new FormData();
        uploadForm.append('arquivo', avatarFile);

        const res = await fetch('/api/upload-avatar', {
          method: 'POST',
          body: uploadForm,
        });

        const result = await res.json();
        if (!result.sucesso) {
          setEstado({ tipo: 'erro', mensagem: result.erro ?? 'Erro ao enviar foto' });
          setUploadingAvatar(false);
          return;
        }

        avatarUrl = result.url;
      } catch {
        setEstado({ tipo: 'erro', mensagem: 'Erro ao enviar foto do médico' });
        setUploadingAvatar(false);
        return;
      }
      setUploadingAvatar(false);
    }

    const resultado = await criarMedico({
      email: (data.get('email') as string).trim().toLowerCase(),
      nome: nome || undefined,
      senha: senha || undefined,
      especialidade: (data.get('especialidade') as string).trim(),
      crm: (data.get('crm') as string).trim() || undefined,
      bio: (data.get('bio') as string).trim() || undefined,
      ordem: ordemStr ? parseInt(ordemStr, 10) : undefined,
      valorConsulta: valorConsulta || undefined,
      avatarUrl,
    });

    if (resultado.sucesso && resultado.dados) {
      setEstado({ tipo: 'sucesso', medicoId: resultado.dados.medicoId });
      form.reset();
      removerAvatar();
      // Redireciona para a página do médico após 1.5s
      setTimeout(() => {
        router.push(`/admin/medicos/${resultado.dados!.medicoId}`);
        router.refresh();
      }, 1500);
    } else {
      setEstado({ tipo: 'erro', mensagem: resultado.erro ?? 'Erro desconhecido' });
    }
  };

  const carregando = estado.tipo === 'carregando' || uploadingAvatar;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              {editando ? (
                <Pencil size={18} className="text-violet-600" />
              ) : (
                <Stethoscope size={20} className="text-violet-600" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">
                {editando ? `Editar ${medico.nome}` : 'Cadastrar novo médico'}
              </CardTitle>
              <CardDescription className="text-xs">
                {editando
                  ? 'Altera o perfil profissional. Foto, nome e senha não se editam aqui.'
                  : 'Informe o e-mail do médico. Se já tiver conta, será vinculado. Caso contrário, nome e senha serão usados para criar a conta automaticamente.'}
              </CardDescription>
            </div>
          </div>
          {editando && aoCancelar && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={aoCancelar}
              disabled={carregando}
              className="shrink-0 gap-1.5"
            >
              <X size={14} />
              Cancelar edição
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Foto do médico — só no cadastro: a edição não grava avatar */}
          {!editando && (
            <div className="space-y-1.5">
              <Label>Foto do médico</Label>
              <div className="flex items-center gap-4">
                {avatarPreview ? (
                  <div className="relative">
                    <img
                      src={avatarPreview}
                      alt="Preview do avatar"
                      className="h-20 w-20 rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={removerAvatar}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm transition-colors hover:bg-destructive/90"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/30">
                    <Stethoscope size={24} className="text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                    id="avatar-input"
                    disabled={carregando}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={carregando}
                    className="gap-1.5"
                  >
                    <Upload size={14} />
                    {avatarPreview ? 'Trocar foto' : 'Enviar foto'}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG ou WebP. Máximo 2MB.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* E-mail — identifica quem está sendo editado, e não é editável aqui */}
          <div className="space-y-1.5">
            <Label htmlFor="email">
              E-mail do usuário {!editando && <span className="text-primary">*</span>}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="medico@exemplo.com"
              required={!editando}
              readOnly={editando}
              defaultValue={medico?.email}
              disabled={carregando}
              className={editando ? 'bg-muted/40 text-muted-foreground' : undefined}
            />
            <p className="text-muted-foreground text-xs">
              {editando
                ? 'O e-mail é a identidade da conta no Clerk — trocá-lo não é edição de perfil.'
                : 'Se o e-mail já estiver cadastrado, o perfil médico será vinculado. Caso contrário, uma nova conta será criada.'}
            </p>
          </div>

          {/* Nome e senha — só no cadastro: a edição não toca a conta */}
          {!editando && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  name="nome"
                  placeholder="Ex: Dr. João Silva"
                  disabled={carregando}
                />
                <p className="text-muted-foreground text-xs">
                  Obrigatório para novos usuários. Para existentes, atualiza o nome no sistema e no
                  Clerk.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha temporária</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    name="senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres, 1 maiúscula, 1 número"
                    disabled={carregando}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                  >
                    {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Obrigatória para novos usuários. Para existentes, redefine a senha no Clerk.
                </p>
              </div>
            </>
          )}

          {/* Especialidade */}
          <div className="space-y-1.5">
            <Label htmlFor="especialidade">
              Especialidade <span className="text-primary">*</span>
            </Label>
            <Input
              id="especialidade"
              name="especialidade"
              placeholder="Ex: Neurologia, Clínico Geral, Medicina Endocanabinóide"
              required
              defaultValue={medico?.especialidade}
              disabled={carregando}
            />
          </div>

          {/* CRM e Ordem */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="crm">CRM</Label>
              <Input
                id="crm"
                name="crm"
                placeholder="Ex: CRM/SP 123456"
                defaultValue={medico?.crm ?? ''}
                disabled={carregando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ordem">Ordem de exibição</Label>
              <Input
                id="ordem"
                name="ordem"
                type="number"
                min={1}
                placeholder="Ex: 1, 2, 3..."
                defaultValue={medico?.ordem ?? ''}
                disabled={carregando}
              />
              <p className="text-muted-foreground text-xs">
                Determina a ordem na homepage.
              </p>
            </div>
          </div>

          {/* Valor da consulta */}
          <div className="space-y-1.5">
            <Label htmlFor="valorConsulta">Valor da consulta (R$)</Label>
            <Input
              id="valorConsulta"
              name="valorConsulta"
              type="number"
              min={0}
              step="0.01"
              placeholder="Ex: 350.00"
              defaultValue={medico?.valorConsulta ?? ''}
              disabled={carregando}
            />
            <p className="text-muted-foreground text-xs">
              É o valor cobrado do paciente ao agendar. Deixe em branco para não definir — o
              agendamento então recusa a marcação com este médico.
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label htmlFor="bio">Biografia (opcional)</Label>
            <Textarea
              id="bio"
              name="bio"
              placeholder="Breve apresentação do médico..."
              rows={3}
              defaultValue={medico?.bio ?? ''}
              disabled={carregando}
            />
          </div>

          {/* Feedback de estado */}
          {estado.tipo === 'erro' && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{estado.mensagem}</span>
            </div>
          )}

          {estado.tipo === 'sucesso' && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Médico cadastrado com sucesso! Redirecionando...</span>
            </div>
          )}

          {estado.tipo === 'salvo' && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Alterações salvas.</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={carregando || estado.tipo === 'sucesso'}
            className="w-full gap-2"
          >
            {carregando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {uploadingAvatar ? 'Enviando foto...' : editando ? 'Salvando...' : 'Cadastrando...'}
              </>
            ) : editando ? (
              <>
                <Save size={16} />
                Salvar alterações
              </>
            ) : (
              <>
                <Stethoscope size={16} />
                Cadastrar médico
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
