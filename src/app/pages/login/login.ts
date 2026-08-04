import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cd = inject(ChangeDetectorRef);

  // États du formulaire
  isLoading = false;
  errorMessage = '';

  // Formulaire réactif avec règles de validation
  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  // Soumission unique du formulaire
  onSubmit(): void {
    this.errorMessage = '';
    this.loginForm.markAllAsTouched();

    // Validation locale préalable
    if (this.loginForm.invalid) {
      this.errorMessage = 'Veuillez remplir correctement tous les champs.';
      // Rafraîchissement immédiat de l'affichage
      this.cd.detectChanges();
      return;
    }

    this.isLoading = true;
    this.cd.detectChanges(); // Verrouille le bouton à l'écran

    const credentials = {
      email: this.loginForm.get('email')?.value ?? '',
      password: this.loginForm.get('password')?.value ?? ''
    };

    this.authService.login(credentials)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cd.detectChanges(); // Déverrouille le bouton dès la fin de la requête
        })
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          // Attribution du message selon la réponse API
          if (err.status === 401) {
            this.errorMessage = 'Email ou mot de passe incorrect.';
          } else {
            this.errorMessage = 'Le serveur ne répond pas. Veuillez réessayer.';
          }
          // Force l'affichage instantané du message rouge sans attendre un clic
          this.cd.detectChanges();
        }
      });
  }
}