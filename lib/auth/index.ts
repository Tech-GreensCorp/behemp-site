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
  type Role,
} from './permissions';
