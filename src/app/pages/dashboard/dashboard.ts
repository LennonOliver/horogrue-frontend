import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, catchError, of } from 'rxjs';
import { AuthService } from '../../services/auth';
import { ApiService, ChantierApi, VehiculeApi, OuvrierApi, SessionTravailApi } from '../../services/api';

/**
 * Interface représentant les indicateurs clés de performance (KPIs) du tableau de bord
 */
export interface StatKpi {
  chantiersActifs: number;
  totalHeuresPeriode: string;
  periodeLabel: string;
  alertesMaintenance: number;
}

/**
 * Interface représentant une alerte de maintenance véhicule
 */
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

/**
 * Interface représentant un chantier dans le tableau de bord
 */
export interface ChantierItem {
  id: string;
  nom: string;
  statut: 'En cours' | 'Planifié' | 'Terminé' | string;
  cumulHeures: string;
}

/**
 * Interface représentant le volume horaire d'un collaborateur
 */
export interface CollaborateurItem {
  id: string;
  nom: string;
  role: string;
  heures: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  // Services Angular injectés
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private router = inject(Router);
  private cd = inject(ChangeDetectorRef);

  // État de chargement et informations gérant
  isLoading: boolean = true;
  userName: string = 'Olivier';
  userFullName: string = 'Olivier Hollebeke';

  // Statistiques clés et alertes
  stats: StatKpi = {
    chantiersActifs: 0,
    totalHeuresPeriode: '0,0',
    periodeLabel: '',
    alertesMaintenance: 0
  };

  maintenanceAlerts: MaintenanceAlert[] = [];
  chantiers: ChantierItem[] = [];
  collaborateurs: CollaborateurItem[] = [];

  // Modale de modification rapide de chantier
  showChantierModal: boolean = false;
  selectedChantierForEdit: ChantierItem | null = null;
  editChantierForm = {
    nomProjet: '',
    statut: 'En cours'
  };
  isSavingChantier: boolean = false;

  ngOnInit(): void {
    this.loadDashboardData();
  }

  /**
   * Convertit une date vers le format ISO YYYY-MM-DD
   */
  private extractDateIso(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '';
    if (typeof dateInput === 'string') return dateInput.split('T')[0];
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Calcule la période active du mois en cours (01-15 ou 16-Fin)
   */
  private getPeriodeRange(): { startIso: string; endIso: string; label: string } {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');

    if (day <= 15) {
      return {
        startIso: `${year}-${monthStr}-01`,
        endIso: `${year}-${monthStr}-15`,
        label: `1ère Période (01-15)`
      };
    } else {
      return {
        startIso: `${year}-${monthStr}-16`,
        endIso: `${year}-${monthStr}-${String(lastDayOfMonth).padStart(2, '0')}`,
        label: `2ème Période (16-${lastDayOfMonth})`
      };
    }
  }

  /**
   * Interroge l'ensemble des endpoints NestJS en parallèle pour alimenter le tableau de bord
   */
  loadDashboardData(): void {
    this.isLoading = true;

    forkJoin({
      chantiers: this.apiService.getChantiers().pipe(catchError(() => of([]))),
      vehicules: this.apiService.getVehicules().pipe(catchError(() => of([]))),
      ouvriers: this.apiService.getOuvriers().pipe(catchError(() => of([]))),
      sessions: this.apiService.getSessions().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ chantiers, vehicules, ouvriers, sessions }) => {
        const pRange = this.getPeriodeRange();

        // Filtrage des sessions appartenant à la période courante
        const sessionsPeriode = (sessions || []).filter(s => {
          const d = this.extractDateIso(s.dateSession);
          return d >= pRange.startIso && d <= pRange.endIso;
        });

        this.processVehiculesData(vehicules);
        this.processChantiersData(chantiers, sessionsPeriode);
        this.processOuvriersData(ouvriers, sessionsPeriode);
        this.processKpiData(chantiers, vehicules, sessionsPeriode, pRange.label);

        this.isLoading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Erreur de chargement du tableau de bord :', err);
        this.isLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  /**
   * Calcule les indicateurs généraux (KPIs)
   */
  private processKpiData(chantiers: ChantierApi[], vehicules: VehiculeApi[], sessionsPeriode: SessionTravailApi[], periodeLabel: string): void {
    const chantiersActifsCount = chantiers.filter(c => c.statut?.toUpperCase() !== 'CLOTURE' && c.statut?.toLowerCase() !== 'terminé').length;
    const totalHeures = sessionsPeriode.reduce((sum, s) => sum + (Number(s.heuresPrestees) || 0), 0);

    this.stats = {
      chantiersActifs: chantiersActifsCount || chantiers.length,
      totalHeuresPeriode: totalHeures.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      periodeLabel,
      alertesMaintenance: this.maintenanceAlerts.length
    };
  }

  /**
   * Agrège le volume d'heures par chantier pour la période courante
   */
  private processChantiersData(chantiersApi: ChantierApi[], sessionsPeriode: SessionTravailApi[]): void {
    if (!chantiersApi || chantiersApi.length === 0) {
      this.chantiers = [
        { id: '1', nom: 'Résidence Les Lilas', statut: 'En cours', cumulHeures: '120,5' },
        { id: '2', nom: 'Tour Horizon', statut: 'En cours', cumulHeures: '64,0' },
        { id: '3', nom: 'Espace Commercial Tournai', statut: 'Planifié', cumulHeures: '0,0' }
      ];
      return;
    }

    this.chantiers = chantiersApi.map(c => {
      const sessionsDuChantier = sessionsPeriode.filter(s => s.chantier?.idChantier === c.idChantier);
      const heuresCumulees = sessionsDuChantier.reduce((total, s) => total + (Number(s.heuresPrestees) || 0), 0);

      return {
        id: c.idChantier,
        nom: c.nomProjet,
        statut: c.statut || 'En cours',
        cumulHeures: heuresCumulees.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      };
    });
  }

  /**
   * Détecte les véhicules nécessitant un entretien ou un contrôle technique imminents
   */
  private processVehiculesData(vehiculesApi: VehiculeApi[]): void {
    this.maintenanceAlerts = [];

    if (!vehiculesApi || vehiculesApi.length === 0) {
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

      let marque = '';
      if (typeof v.modele?.marque === 'object' && v.modele?.marque !== null) {
        marque = (v.modele.marque as any).nomMarque || (v.modele.marque as any).nom || '';
      } else if (typeof v.modele?.marque === 'string') {
        marque = v.modele.marque;
      }

      const nomModele = v.modele?.nomModele || '';
      const descriptionVehicule = [marque, nomModele].filter(Boolean).join(' ') || 'Camionnette';

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
   * Agrège les heures prestées par collaborateur sur la période courante
   */
  private processOuvriersData(ouvriersApi: OuvrierApi[], sessionsPeriode: SessionTravailApi[]): void {
    if (!ouvriersApi || ouvriersApi.length === 0) {
      this.collaborateurs = [
        { id: '1', nom: 'John Doe', role: 'Grutier Senior', heures: '42,0' },
        { id: '2', nom: 'Marc Martin', role: 'Chauffeur', heures: '38,5' },
        { id: '3', nom: 'Homer Simpson', role: 'Apprenti', heures: '28,5' }
      ];
      return;
    }

    this.collaborateurs = ouvriersApi.map(o => {
      const heuresTotal = sessionsPeriode
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

  logout(): void {
    this.authService.logout();
  }

  onAlertAction(alert: MaintenanceAlert): void {
    this.router.navigate(['/vehicules']);
  }

  ajouterSession(chantier: ChantierItem): void {
    this.router.navigate(['/sessions']);
  }

  openEditChantierModal(chantier: ChantierItem): void {
    this.selectedChantierForEdit = chantier;
    this.editChantierForm = {
      nomProjet: chantier.nom,
      statut: chantier.statut
    };
    this.showChantierModal = true;
  }

  closeEditChantierModal(): void {
    this.showChantierModal = false;
    this.selectedChantierForEdit = null;
    this.isSavingChantier = false;
    this.cd.detectChanges();
  }

  submitSaveChantier(): void {
    if (!this.selectedChantierForEdit || !this.editChantierForm.nomProjet.trim()) return;

    this.isSavingChantier = true;
    const targetId = this.selectedChantierForEdit.id;
    const payload = {
      nomProjet: this.editChantierForm.nomProjet.trim(),
      statut: this.editChantierForm.statut
    };

    this.closeEditChantierModal();

    this.apiService.updateChantier(targetId, payload).subscribe({
      next: () => {
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Erreur lors de la modification du chantier :', err);
        this.loadDashboardData();
      }
    });
  }
}