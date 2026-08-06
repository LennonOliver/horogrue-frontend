import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth';
import { ToastService } from './services/toast';

/**
 * Composant racine de l'application HoroGrue
 * Gère le layout global, la Sidebar unique, les notifications Toasts et la modale de confirmation personnalisée.
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

  // Services d'authentification, de routage et de notifications
  public authService = inject(AuthService);
  public toastService = inject(ToastService);
  private router = inject(Router);

  get showSidebar(): boolean {
    return this.authService.isLoggedIn() && !this.router.url.includes('login');
  }

  logout(): void {
    this.authService.logout();
  }

  onConfirm(): void {
    const dialog = this.toastService.confirmModal();
    if (dialog && dialog.onConfirm) {
      dialog.onConfirm();
    }
    this.toastService.closeConfirm();
  }

  onCancel(): void {
    this.toastService.closeConfirm();
  }
}