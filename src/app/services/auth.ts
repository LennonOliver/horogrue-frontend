import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

/**
 * Interface décrivant la réponse d'authentification envoyée par l'API NestJS
 */
export interface LoginResponse {
  access_token: string;
}

/**
 * ============================================================================
 * SERVICE D'AUTHENTIFICATION & SESSIONS JWT (AuthService)
 * Gère la transmission des identifiants, le stockage local du jeton Bearer JWT
 * et le contrôle du statut de connexion de l'utilisateur.
 * ============================================================================
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  /** URL de l'endpoint d'authentification NestJS */
  private apiUrl = 'http://localhost:3000/auth';

  /**
   * Transmet les identifiants au serveur et enregistre le jeton JWT dans localStorage
   */
  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        if (response && response.access_token) {
          localStorage.setItem('access_token', response.access_token);
        }
      })
    );
  }

  /**
   * Récupère le jeton JWT d'accès stocké dans le navigateur
   */
  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Indique si un utilisateur possède un jeton d'accès actif
   */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /**
   * Déconnecte l'utilisateur : efface le jeton stocké et redirige vers /login
   */
  logout(): void {
    localStorage.removeItem('access_token');
    this.router.navigate(['/login']);
  }
}