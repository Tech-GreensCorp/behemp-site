/**
 * Barrel file — reexportação centralizada dos helpers de autenticação.
 */
export {
  obterUsuarioAtual,
  obterDadosUsuario,
  obterRoleComFallback,
  verificarRole,
  verificarAdmin,
  verificarMedico,
  verificarPaciente,
  verificarResponsavel,
  verificarMedicoOuAdmin,
  verificarUsuarioAutenticado,
  type Role,
} from './permissions';
