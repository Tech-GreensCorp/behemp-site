/**
 * Barrel file — reexportação centralizada dos helpers de autenticação.
 */
export {
  obterUsuarioAtual,
  obterDadosUsuario,
  verificarRole,
  verificarAdmin,
  verificarMedico,
  verificarPaciente,
  verificarMedicoOuAdmin,
  verificarUsuarioAutenticado,
  type Role,
} from './permissions';
