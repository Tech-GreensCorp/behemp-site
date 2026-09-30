/**
 * Detalhe do paciente dentro da área do admin.
 *
 * Reaproveita a tela do médico (mesmas abas, mesmas actions, que já aceitam admin), mas sob o
 * layout do admin — sem isso o link da lista levava a `/medico/...` e a sidebar trocava para
 * a do médico. Uma só implementação: mudança no detalhe vale para os dois papéis.
 */
export { default } from '@/app/(medico)/medico/pacientes/[id]/page';
