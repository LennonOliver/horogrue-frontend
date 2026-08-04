import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div style="padding: 2rem; font-family: sans-serif;">
      <h1>Tableau de bord HoroGrue</h1>
      <p>Bienvenue ! Vous êtes connecté avec un jeton JWT valide.</p>
      <button (click)="logout()" style="padding: 0.6rem 1.2rem; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer;">
        Se déconnecter
      </button>
    </div>
  `
})
export class Dashboard {
  private authService = inject(AuthService);

  // Déconnexion et redirection vers /login
  logout(): void {
    this.authService.logout();
  }
}