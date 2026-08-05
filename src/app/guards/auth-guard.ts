import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * ============================================================================
 * GUARD DE NAVIGATION ANGULAR (authGuard)
 * Intercepte les accès aux routes protégées et vérifie la présence d'une session JWT.
 * Redirige les utilisateurs non authentifiés vers la page d'authentification (/login).
 * ============================================================================
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Autorise la navigation si un jeton d'accès JWT est présent
  if (authService.isLoggedIn()) {
    return true;
  }

  // 2. Bloque l'accès et redirige automatiquement vers l'écran de connexion
  router.navigate(['/login']);
  return false;
};