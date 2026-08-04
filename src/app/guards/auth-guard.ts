import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Autorise l'accès si un jeton est valide
  if (authService.isLoggedIn()) {
    return true;
  }

  // Redirige vers /login en cas d'absence de jeton
  router.navigate(['/login']);
  return false;
};