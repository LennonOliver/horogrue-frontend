import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private http = inject(HttpClient);
    private readonly apiUrl = 'http://localhost:3000';

    // --- Système ---
    checkHealth(): Observable<any> {
        return this.http.get(`${this.apiUrl}/`);
    }

    // --- Auth ---
    login(credentials: { email: string; password: string }): Observable<{ token: string }> {
        return this.http.post<{ token: string }>(`${this.apiUrl}/auth/login`, credentials);
    }
}