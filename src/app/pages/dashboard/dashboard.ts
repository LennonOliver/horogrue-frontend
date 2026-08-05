import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import { AuthService } from '../../services/auth';
import { ApiService, ChantierApi, VehiculeApi, OuvrierApi, SessionTravailApi } from '../../services/api';

/**
 * Interfaces pour typer de manière stricte et claire les données affichées sur le tableau de bord
 */
export interface StatKpi {
  chantiersActifs: number;
  totalHeuresMois: string;
  alertesMaintenance: number;
}

export interface MaintenanceAlert {
  id: number | string;
  title: string;
  message: string;
  actionLabel: string;
  bgClass: string;
  borderColor: string;
  iconClass: string;
  isCt?: boolean;
}

export interface ChantierItem {
  id: string;
  nom: string;
  statut: 'En cours' | 'Planifié' | 'Terminé' | string;
  cumulHeures: string;
}

export interface CollaborateurItem {
  id: string;
  nom: string;
  role: string;
  heures: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  // Injection de dépendances Angular (Auth + API REST NestJS + Détecteur de changements)
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private cd = inject(ChangeDetectorRef);

  // État de chargement des données en provenance du backend
  isLoading: boolean = true;

  // Informations de l'utilisateur actuellement connecté
  userName: string = 'Olivier';
  userFullName: string = 'Olivier Hollebeke';

  // 1. Données des statistiques clés (KPIs) initialisées
  stats: StatKpi = {
    chantiersActifs: 0,
    totalHeuresMois: '0,0',
    alertesMaintenance: 0
  };

  // 2. Liste dynamique des alertes de maintenance pour les véhicules
  maintenanceAlerts: MaintenanceAlert[] = [];

  // 3. Liste dynamique des chantiers en cours avec leur statut et cumul d'heures
  chantiers: ChantierItem[] = [];

  // 4. Liste dynamique des collaborateurs et cumul de leurs heures travaillées
  collaborateurs: CollaborateurItem[] = [];

  ngOnInit(): void {
    // Méthode de cycle de vie Angular : appel des données API dès l'initialisation
    this.loadDashboardData();
  }

  /**
   * Interroge les routes d'API du backend NestJS en parallèle (/chantiers, /vehicules, /ouvriers, /session-travail)
   */
  loadDashboardData(): void {
    this.isLoading = true;

    // forkJoin permet de lancer toutes les requêtes HTTP simultanément
    forkJoin({
      chantiers: this.apiService.getChantiers().pipe(catchError(() => of([]))),
      vehicules: this.apiService.getVehicules().pipe(catchError(() => of([]))),
      ouvriers: this.apiService.getOuvriers().pipe(catchError(() => of([]))),
      sessions: this.apiService.getSessions().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ chantiers, vehicules, ouvriers, sessions }) => {
        // Traitement dynamique des réponses API reçues
        this.processVehiculesData(vehicules);
        this.processChantiersData(chantiers, sessions);
        this.processOuvriersData(ouvriers, sessions);
        this.processKpiData(chantiers, vehicules, sessions);

        this.isLoading = false;
        this.cd.detectChanges(); // Rafraîchissement immédiat de l'interface graphique
      },
      error: (err) => {
        console.error('Erreur lors du chargement des données API :', err);
        this.isLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  /**
   * Calcule les statistiques globales (KPIs) du tableau de bord
   */
  private processKpiData(chantiers: ChantierApi[], vehicules: VehiculeApi[], sessions: SessionTravailApi[]): void {
    // Filtrage des chantiers actifs (non clôturés)
    const chantiersActifsCount = chantiers.filter(c => c.statut?.toUpperCase() !== 'CLOTURE' && c.statut?.toLowerCase() !== 'terminé').length;

    // Calcul de la somme totale des heures prestées dans les sessions
    const totalHeures = sessions.reduce((sum, s) => sum + (Number(s.heuresPrestees) || 0), 0);

    this.stats = {
      chantiersActifs: chantiersActifsCount || chantiers.length,
      totalHeuresMois: totalHeures.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      alertesMaintenance: this.maintenanceAlerts.length
    };
  }

  /**
   * Mappe les chantiers retournés par l'API et calcule le cumul d'heures prestées par chantier
   */
  private processChantiersData(chantiersApi: ChantierApi[], sessionsApi: SessionTravailApi[]): void {
    if (!chantiersApi || chantiersApi.length === 0) {
      // Données de secours (fallback) si aucune donnée en BDD
      this.chantiers = [
        { id: '1', nom: 'Résidence Les Lilas', statut: 'En cours', cumulHeures: '120,5' },
        { id: '2', nom: 'Tour Horizon', statut: 'En cours', cumulHeures: '64,0' },
        { id: '3', nom: 'Espace Commercial Tournai', statut: 'Planifié', cumulHeures: '0,0' }
      ];
      return;
    }

    this.chantiers = chantiersApi.map(c => {
      // Calcul du cumul d'heures spécifiques à ce chantier
      const heuresCumulees = sessionsApi
        .filter(s => s.chantier?.idChantier === c.idChantier)
        .reduce((total, s) => total + (Number(s.heuresPrestees) || 0), 0);

      return {
        id: c.idChantier,
        nom: c.nomProjet,
        statut: c.statut || 'En cours',
        cumulHeures: heuresCumulees.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      };
    });
  }

  /**
   * Analyse les véhicules pour calculer dynamiquement les alertes d'entretien ou de contrôle technique
   */
  private processVehiculesData(vehiculesApi: VehiculeApi[]): void {
    this.maintenanceAlerts = [];

    if (!vehiculesApi || vehiculesApi.length === 0) {
      // Alertes de démonstration par défaut si la table véhicule est vide
      this.maintenanceAlerts = [
        {
          id: 1,
          title: 'Camionnette [2-ABC-111] :',
          message: 'Entretien proche (1 450 km restants)',
          actionLabel: 'Mettre à jour KM',
          bgClass: 'bg-warning-subtle text-dark',
          borderColor: '#ffc107',
          iconClass: 'bi bi-exclamation-triangle-fill text-warning me-1'
        },
        {
          id: 2,
          title: 'Camionnette [1-XYZ-999] :',
          message: 'Contrôle technique prévu dans 12 jours',
          actionLabel: 'Voir Fiche',
          bgClass: 'bg-danger-subtle text-dark',
          borderColor: '#dc3545',
          iconClass: 'bi bi-circle-fill text-danger me-1',
          isCt: true
        }
      ];
      return;
    }

    let alertId = 1;
    for (const v of vehiculesApi) {
      const immatriculation = v.immatriculation || 'Immatriculation N/A';
      
      // Extraction propre du nom de la marque si marque est un objet ou une chaîne
      let marque = '';
      if (typeof v.modele?.marque === 'object' && v.modele?.marque !== null) {
        marque = (v.modele.marque as any).nomMarque || (v.modele.marque as any).nom || '';
      } else if (typeof v.modele?.marque === 'string') {
        marque = v.modele.marque;
      }

      const nomModele = v.modele?.nomModele || '';
      const descriptionVehicule = [marque, nomModele].filter(Boolean).join(' ') || 'Camionnette';

      // 1. Alerte Kilométrage d'entretien (Proche de 5000 km ou dépassé)
      if (v.kmProchainEntretien && v.kilometrageActuel) {
        const kmRestants = v.kmProchainEntretien - v.kilometrageActuel;
        if (kmRestants <= 5000) {
          const messageKm = kmRestants < 0
            ? `Entretien dépassé de ${Math.abs(kmRestants).toLocaleString('fr-FR')} km`
            : `Entretien proche (${kmRestants.toLocaleString('fr-FR')} km restants)`;

          this.maintenanceAlerts.push({
            id: alertId++,
            title: `${descriptionVehicule} [${immatriculation}] :`,
            message: messageKm,
            actionLabel: 'Mettre à jour KM',
            bgClass: 'bg-warning-subtle text-dark',
            borderColor: '#ffc107',
            iconClass: 'bi bi-exclamation-triangle-fill text-warning me-1'
          });
        }
      }

      // 2. Alerte Contrôle Technique
      if (v.dateProchainCt) {
        const dateCt = new Date(v.dateProchainCt);
        const aujourdhui = new Date();
        const diffJours = Math.ceil((dateCt.getTime() - aujourdhui.getTime()) / (1000 * 3600 * 24));

        if (diffJours <= 30) {
          this.maintenanceAlerts.push({
            id: alertId++,
            title: `${descriptionVehicule} [${immatriculation}] :`,
            message: diffJours > 0 ? `Contrôle technique prévu dans ${diffJours} jours` : `Contrôle technique dépassé !`,
            actionLabel: 'Voir Fiche',
            bgClass: 'bg-danger-subtle text-dark',
            borderColor: '#dc3545',
            iconClass: 'bi bi-circle-fill text-danger me-1',
            isCt: true
          });
        }
      }
    }
  }

  /**
   * Mappe les ouvriers retournés par l'API et calcule leurs heures cumulees
   */
  private processOuvriersData(ouvriersApi: OuvrierApi[], sessionsApi: SessionTravailApi[]): void {
    if (!ouvriersApi || ouvriersApi.length === 0) {
      // Données de démonstration en fallback si la table ouvrier est vide
      this.collaborateurs = [
        { id: '1', nom: 'John Doe', role: 'Grutier Senior', heures: '42,0' },
        { id: '2', nom: 'Marc Martin', role: 'Chauffeur', heures: '38,5' },
        { id: '3', nom: 'Homer Simpson', role: 'Apprenti', heures: '28,5' }
      ];
      return;
    }

    this.collaborateurs = ouvriersApi.map(o => {
      // Calcul du total des heures de cet ouvrier
      const heuresTotal = sessionsApi
        .filter(s => s.ouvrier?.idOuvrier === o.idOuvrier)
        .reduce((sum, s) => sum + (Number(s.heuresPrestees) || 0), 0);

      let qualif = 'Ouvrier qualifié';
      if (typeof o.qualification === 'object' && o.qualification !== null) {
        qualif = o.qualification.libelle || o.qualification.nomQualification || 'Ouvrier qualifié';
      } else if (typeof o.qualification === 'string') {
        qualif = o.qualification;
      }

      return {
        id: o.idOuvrier,
        nom: `${o.prenom || ''} ${o.nom || ''}`.trim(),
        role: qualif,
        heures: heuresTotal.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      };
    });
  }

  /**
   * Action de déconnexion via l'AuthService
   */
  logout(): void {
    this.authService.logout();
  }

  /**
   * Action au clic sur un bouton d'alerte véhicule
   */
  onAlertAction(alert: MaintenanceAlert): void {
    console.log('Action sur alerte :', alert.title);
  }

  /**
   * Action au clic sur l'ajout d'une session de chantier
   */
  ajouterSession(chantier: ChantierItem): void {
    console.log('Ajout de session pour le chantier :', chantier.nom);
  }
}