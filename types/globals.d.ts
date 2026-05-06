/**
 * Tipagem global do Clerk para estender sessionClaims.
 * O campo metadata.role é usado para RBAC (admin, medico, paciente).
 * Configurado no Clerk Dashboard via publicMetadata.
 */
export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: 'admin' | 'medico' | 'paciente';
    };
  }
}
