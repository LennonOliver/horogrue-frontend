import { Component, inject } from '@angular/core';
import { ApiService } from './services/api';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `<h1>Test API Angular <-> NestJS</h1>`
})
export class App {
  private api = inject(ApiService);

  constructor() {
    this.api.login({ email: 'hollebekeolivier@test.com', password: '12345678' }).subscribe({
      next: (res) => console.log('✅ SUCCÈS :', res),
      error: (err) => {
        // Affiche le tableau contenant les 3 messages de validation de NestJS
        console.log('❌ Règles de validation non respectées :', err.error.message);
      }
    });
  }
}