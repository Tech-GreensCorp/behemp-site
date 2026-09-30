/**
 * Cadastro de paciente dentro da área do admin — mesma tela do médico, sob o layout do admin
 * (ver `../[id]/page.tsx`). A action `criarPaciente` já aceita admin; sem médico logado, o
 * paciente nasce sem `medicoId` e cai na fila de "Atribuir Médico".
 */
export { default } from '@/app/(medico)/medico/pacientes/novo/page';
