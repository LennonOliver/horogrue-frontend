import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth';

/**
 * Composant racine de l'application HoroGrue
 * Gère le layout global (Sidebar unique) et masque la navigation sur la page de connexion (/login)
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'horogrue-frontend';

  // Services d'authentification et de routage
  public authService = inject(AuthService);
  private router = inject(Router);

  /**
   * Indique si la barre de navigation globale doit être affichée.
   * Masquée si déconnecté ou si l'utilisateur se trouve sur la page /login.
   */
  get showSidebar(): boolean {
    return this.authService.isLoggedIn() && !this.router.url.includes('login');
  }
}