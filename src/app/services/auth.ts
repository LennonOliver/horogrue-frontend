import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

// Modèle de réponse renvoyé par NestJS
export interface LoginResponse {
    access_token: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);

    // URL du serveur backend NestJS
    private apiUrl = 'http://localhost:3000/auth';

    // Envoie les identifiants et enregistre le token JWT
    login(credentials: { email: string; password: string }): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
            tap(response => {
                // Sauvegarde du jeton dans le stockage local du navigateur
                localStorage.setItem('access_token', response.access_token);
            })
        );
    }

    // Extrait le jeton stocké
    getToken(): string | null {
        return localStorage.getItem('access_token');
    }

    // Indique si le gérant possède un jeton
    isLoggedIn(): boolean {
        return !!this.getToken();
    }

    // Efface le jeton et redirige vers l'écran de connexion
    logout(): void {
        localStorage.removeItem('access_token');
        this.router.navigate(['/login']);
    }
}