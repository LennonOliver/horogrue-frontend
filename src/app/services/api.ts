import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * ============================================================================
 * INTERFACES DTO API (Modèles de données échangés avec l'API NestJS)
 * ============================================================================
 */
export interface PaysApi {
  idPays?: string;
  nomPays: string;
  codeIso?: string | null;
}

export interface LocaliteApi {
  idLocalite?: string;
  codePostal: string;
  nomVille: string;
  pays?: PaysApi;
}

export interface AdresseApi {
  idAdresse?: string;
  rue: string;
  numero: string;
  boite?: string | null;
  codePostal?: string;
  nomVille?: string;
  localite?: LocaliteApi;
  ville?: { nomVille: string };
}

export interface ChantierApi {
  idChantier: string;
  nomProjet: string;
  dateDebut: string;
  dateFinReelle?: string | null;
  statut: string;
  adresse?: AdresseApi;
}

export interface MarqueApi {
  idMarque?: string;
  nomMarque?: string;
}

export interface ModeleApi {
  idModele?: string;
  nomModele?: string;
  marque?: MarqueApi | string;
}

export interface VehiculeApi {
  idVehicule: string;
  immatriculation: string;
  numeroChassis: string;
  dateMec: string;
  kilometrageActuel: number;
  dateProchainCt?: string | null;
  dateProchainEntretien?: string | null;
  kmProchainEntretien?: number | null;
  modele?: ModeleApi;
}

export interface QualificationApi {
  idQualification?: string;
  nomQualification?: string;
  libelle?: string;
}

export interface OuvrierApi {
  idOuvrier: string;
  nom: string;
  prenom: string;
  actif: boolean;
  qualification?: QualificationApi;
}

export interface SessionTravailApi {
  idSession: string;
  dateSession: string;
  dateFinSession?: string | null;
  heuresPrestees: number | string;
  typeTarification?: string;
  tauxHoraireApplique?: number | null;
  montantForfait?: number | null;
  chantier?: ChantierApi;
  ouvrier?: OuvrierApi;
  ouvriers?: OuvrierApi[];
  vehicule?: VehiculeApi;
  gerant?: any;
}

export interface SessionForfaitApi {
  idSessionForfait: string;
  dateDebut: string;
  dateFin?: string | null;
  montantForfait: number | string;
  chantier?: ChantierApi;
  ouvrier?: OuvrierApi;
  vehicule?: VehiculeApi;
  gerant?: any;
}

export interface LogActionApi {
  idLog: string;
  dateAction: string;
  typeAction: string;
  description: string;
  gerant?: any;
}

/**
 * ============================================================================
 * SERVICE API CENTRALISÉ (Angular HttpClient Provider)
 * Service Angular singleton fournissant les méthodes d'accès HTTP vers l'API REST NestJS.
 * ============================================================================
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);

  /** URL racine de l'API REST NestJS */
  private readonly apiUrl = 'http://localhost:3000';

  /** Récupère le journal d'audit des actions */
  getLogs(): Observable<LogActionApi[]> {
    return this.http.get<LogActionApi[]>(`${this.apiUrl}/log-action`);
  }

  // -------------------------------------------------------------------------
  // 1. SERVICES SYSTÈME & AUTHENTIFICATION
  // -------------------------------------------------------------------------
  
  /** Vérifie la disponibilité du serveur NestJS (Health check) */
  checkHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/`);
  }

  /** Transmet les identifiants pour générer un jeton JWT d'accès */
  login(credentials: { email: string; password: string }): Observable<{ access_token: string }> {
    return this.http.post<{ access_token: string }>(`${this.apiUrl}/auth/login`, credentials);
  }

  // -------------------------------------------------------------------------
  // 2. GESTION DES CHANTIERS
  // -------------------------------------------------------------------------
  
  /** Récupère la liste complète des chantiers enregistrés */
  getChantiers(): Observable<ChantierApi[]> {
    return this.http.get<ChantierApi[]>(`${this.apiUrl}/chantiers`);
  }

  /** Enregistre un nouveau chantier dans la base de données */
  createChantier(createDto: any): Observable<ChantierApi> {
    return this.http.post<ChantierApi>(`${this.apiUrl}/chantiers`, createDto);
  }

  /** Met à jour les informations d'un chantier */
  updateChantier(idChantier: string, updateDto: any): Observable<ChantierApi> {
    return this.http.patch<ChantierApi>(`${this.apiUrl}/chantiers/${idChantier}`, updateDto);
  }

  /** Supprime un chantier par son identifiant UUID */
  deleteChantier(idChantier: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/chantiers/${idChantier}`);
  }

  // -------------------------------------------------------------------------
  // 3. GESTION DU PARC AUTOMOBILE (VÉHICULES)
  // -------------------------------------------------------------------------
  
  /** Récupère l'ensemble des véhicules de la flotte */
  getVehicules(): Observable<VehiculeApi[]> {
    return this.http.get<VehiculeApi[]>(`${this.apiUrl}/vehicules`);
  }

  /** Enregistre un nouveau véhicule dans la base de données */
  createVehicule(createDto: any): Observable<VehiculeApi> {
    return this.http.post<VehiculeApi>(`${this.apiUrl}/vehicules`, createDto);
  }

  /** Action rapide : met à jour uniquement le kilométrage relevé */
  updateKilometrageVehicule(idVehicule: string, kilometrageActuel: number): Observable<VehiculeApi> {
    return this.http.patch<VehiculeApi>(`${this.apiUrl}/vehicules/${idVehicule}/kilometrage`, { kilometrageActuel });
  }

  /** Met à jour l'ensemble des caractéristiques d'un véhicule */
  updateVehicule(idVehicule: string, updateDto: any): Observable<VehiculeApi> {
    return this.http.patch<VehiculeApi>(`${this.apiUrl}/vehicules/${idVehicule}`, updateDto);
  }

  /** Supprime définitivement un véhicule par son identifiant UUID */
  deleteVehicule(idVehicule: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/vehicules/${idVehicule}`);
  }

  // -------------------------------------------------------------------------
  // 4. GESTION DU PERSONNEL (OUVRIERS)
  // -------------------------------------------------------------------------
  
  /** Récupère la liste complète des ouvriers */
  getOuvriers(): Observable<OuvrierApi[]> {
    return this.http.get<OuvrierApi[]>(`${this.apiUrl}/ouvriers`);
  }

  /** Enregistre un nouvel ouvrier dans le personnel */
  createOuvrier(createDto: any): Observable<OuvrierApi> {
    return this.http.post<OuvrierApi>(`${this.apiUrl}/ouvriers`, createDto);
  }

  /** Met à jour la fiche ou le statut d'un ouvrier */
  updateOuvrier(idOuvrier: string, updateDto: any): Observable<OuvrierApi> {
    return this.http.patch<OuvrierApi>(`${this.apiUrl}/ouvriers/${idOuvrier}`, updateDto);
  }

  /** Supprime un ouvrier du personnel */
  deleteOuvrier(idOuvrier: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/ouvriers/${idOuvrier}`);
  }

  // -------------------------------------------------------------------------
  // 5. SESSIONS DE TRAVAIL ET CALCULS D'HEURES
  // -------------------------------------------------------------------------
  
  /** Récupère l'historique complet des sessions de travail horodatées */
  getSessions(): Observable<SessionTravailApi[]> {
    return this.http.get<SessionTravailApi[]>(`${this.apiUrl}/session-travail`);
  }

  /** Enregistre une nouvelle session de travail */
  createSession(createDto: any): Observable<SessionTravailApi> {
    return this.http.post<SessionTravailApi>(`${this.apiUrl}/session-travail`, createDto);
  }

  /** Met à jour une session de travail */
  updateSession(idSession: string, updateDto: any): Observable<SessionTravailApi> {
    return this.http.patch<SessionTravailApi>(`${this.apiUrl}/session-travail/${idSession}`, updateDto);
  }

  /** Supprime une session de travail */
  deleteSession(idSession: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/session-travail/${idSession}`);
  }

  /** Récupère le cumul total d'heures prestées sur un chantier */
  getCumulHeuresChantier(idChantier: string): Observable<{ totalHeures: number }> {
    return this.http.get<{ totalHeures: number }>(`${this.apiUrl}/session-travail/stats/${idChantier}`);
  }

  /** Récupère le cumul total d'heures prestées par un ouvrier */
  getCumulHeuresOuvrier(idOuvrier: string): Observable<{ totalHeures: number }> {
    return this.http.get<{ totalHeures: number }>(`${this.apiUrl}/session-travail/stats/${idOuvrier}`);
  }

  // -------------------------------------------------------------------------
  // 6. SESSIONS AU FORFAIT
  // -------------------------------------------------------------------------

  /** Récupère l'ensemble des sessions au forfait */
  getSessionForfaits(): Observable<SessionForfaitApi[]> {
    return this.http.get<SessionForfaitApi[]>(`${this.apiUrl}/session-forfait`);
  }

  /** Enregistre une nouvelle session au forfait */
  createSessionForfait(createDto: any): Observable<SessionForfaitApi> {
    return this.http.post<SessionForfaitApi>(`${this.apiUrl}/session-forfait`, createDto);
  }

  /** Met à jour une session au forfait */
  updateSessionForfait(idSessionForfait: string, updateDto: any): Observable<SessionForfaitApi> {
    return this.http.patch<SessionForfaitApi>(`${this.apiUrl}/session-forfait/${idSessionForfait}`, updateDto);
  }

  /** Supprime une session au forfait */
  deleteSessionForfait(idSessionForfait: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/session-forfait/${idSessionForfait}`);
  }
}