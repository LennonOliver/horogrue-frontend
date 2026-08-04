import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { authGuard } from './guards/auth-guard';
import { Dashboard } from './pages/dashboard/dashboard';

export const routes: Routes = [
    // Route publique vers l'écran de connexion
    { path: 'login', component: Login },

    // Route protégée : accessible uniquement si connecté
    { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },

    // Redirection automatique par défaut vers /login
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: '**', redirectTo: 'login' }
];