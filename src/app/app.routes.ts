import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { authGuard } from './guards/auth-guard';
import { Dashboard } from './pages/dashboard/dashboard';
import { Vehicules } from './pages/vehicules/vehicules';
import { Ouvriers } from './pages/ouvriers/ouvriers';
import { Chantiers } from './pages/chantiers/chantiers';
import { Sessions } from './pages/sessions/sessions';
import { Logs } from './pages/logs/logs';

export const routes: Routes = [
    // Route publique vers l'écran de connexion
    { path: 'login', component: Login },

    // Routes protégées : accessibles uniquement si connecté
    { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
    { path: 'chantiers', component: Chantiers, canActivate: [authGuard] },
    { path: 'vehicules', component: Vehicules, canActivate: [authGuard] },
    { path: 'ouvriers', component: Ouvriers, canActivate: [authGuard] },
    { path: 'sessions', component: Sessions, canActivate: [authGuard] },
    { path: 'logs', component: Logs, canActivate: [authGuard] },

    // Redirection automatique par défaut vers /login
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: '**', redirectTo: 'login' }
];