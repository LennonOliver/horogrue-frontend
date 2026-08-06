import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth';
import { ApiService, ChantierApi, SessionTravailApi } from '../../services/api';
import { ToastService } from '../../services/toast';

/**
 * Interface d'affichage pour un chantier enrichi (avec adresse formatée et heures totales)
 */
export interface ChantierDisplayItem {
  idChantier: string;
  nomProjet: string;
  dateDebut: string;
  dateFinReelle?: string | null;
  statut: string; // 'En cours', 'Terminé', 'Planifié', 'Clôturé'
  rue: string;
  numero: string;
  boite?: string;
  codePostal: string;
  nomVille: string;
  nomPays: string;
  codeIso?: string;
  adresseCompleteFormatted: string;
  totalHeures: number;
  cumulHeuresFormatted: string;
}

@Component({
  selector: 'app-chantiers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chantiers.html',
  styleUrl: './chantiers.css'
})
export class Chantiers implements OnInit {
  // Services
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  private cd = inject(ChangeDetectorRef);

  // État de chargement et listes
  isLoading: boolean = true;
  chantiersList: ChantierDisplayItem[] = [];

  // Statistiques KPIs
  totalChantiers: number = 0;
  enCoursCount: number = 0;
  terminesCount: number = 0;

  // -------------------------------------------------------------------------
  // MODALE : Création et Modification d'un chantier
  // -------------------------------------------------------------------------
  showChantierModal: boolean = false;
  isCreateMode: boolean = false;
  selectedChantierForEdit: ChantierDisplayItem | null = null;

  editForm = {
    nomProjet: '',
    dateDebut: '',
    dateFinReelle: '',
    statut: 'En cours',
    rue: '',
    numero: '',
    boite: '',
    codePostal: '',
    nomVille: '',
    nomPays: 'Belgique',
    codeIso: 'BE'
  };

  isSavingChantier: boolean = false;
  chantierErrorMessage: string = '';

  ngOnInit(): void {
    this.loadChantiersData();
  }

  /**
   * Charge la liste des chantiers et les sessions de travail associées depuis le backend NestJS
   */
  loadChantiersData(): void {
    this.isLoading = true;

    forkJoin({
      chantiers: this.apiService.getChantiers(),
      sessions: this.apiService.getSessions()
    }).subscribe({
      next: (res) => {
        this.processChantiersList(res.chantiers || [], res.sessions || []);
        this.isLoading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des chantiers :', err);
        this.loadFallbackData();
        this.isLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  /**
   * Formate les nombres avec séparateurs d'espaces (ex: 124,5)
   */
  private formatNumber(num: number | null | undefined): string {
    if (num == null || isNaN(num)) return '0,0';
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  /**
   * Extrait la partie YYYY-MM-DD d'une date sans décalage horaire
   */
  private extractDateIso(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '';
    if (typeof dateInput === 'string') {
      return dateInput.split('T')[0];
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Formate une date ISO (YYYY-MM-DD) au format français (DD/MM/YYYY)
   */
  formatDateFr(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    const cleanStr = this.extractDateIso(dateStr);
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return dateStr;
  }

  /**
   * Traite et enrichit les données des chantiers avec le cumul d'heures prestées
   */
  private processChantiersList(chantiersApi: ChantierApi[], sessionsApi: SessionTravailApi[]): void {
    if (!chantiersApi || chantiersApi.length === 0) {
      this.loadFallbackData();
      return;
    }

    this.chantiersList = chantiersApi.map(c => {
      // Sessions de travail liées à ce chantier
      const sessionsChantier = sessionsApi.filter(s => s.chantier?.idChantier === c.idChantier);
      const totalHeures = sessionsChantier.reduce((sum, s) => sum + (Number(s.heuresPrestees) || 0), 0);

      // Adresse
      const adr = c.adresse;
      const rue = adr?.rue || '';
      const numero = adr?.numero || '';
      const boite = adr?.boite || '';
      const codePostal = adr?.localite?.codePostal || adr?.codePostal || '';
      const nomVille = adr?.localite?.nomVille || adr?.nomVille || adr?.ville?.nomVille || '';
      const nomPays = adr?.localite?.pays?.nomPays || 'Belgique';
      const codeIso = adr?.localite?.pays?.codeIso || 'BE';

      const parts: string[] = [];
      if (rue) parts.push(`${rue} ${numero}`.trim());
      if (boite) parts.push(`bte ${boite}`);
      if (codePostal || nomVille) parts.push(`${codePostal} ${nomVille}`.trim());
      if (nomPays && nomPays !== 'Belgique') parts.push(`(${nomPays})`);

      const adresseCompleteFormatted = parts.length > 0 ? parts.join(', ') : 'Adresse non renseignée';

      // Date conversion en YYYY-MM-DD
      const dateDebutIso = this.extractDateIso(c.dateDebut);
      const dateFinIso = c.dateFinReelle ? this.extractDateIso(c.dateFinReelle) : null;

      return {
        idChantier: c.idChantier,
        nomProjet: c.nomProjet || 'Chantier Sans Nom',
        dateDebut: dateDebutIso,
        dateFinReelle: dateFinIso,
        statut: c.statut || 'En cours',
        rue,
        numero,
        boite,
        codePostal,
        nomVille,
        nomPays,
        codeIso,
        adresseCompleteFormatted,
        totalHeures,
        cumulHeuresFormatted: `${this.formatNumber(totalHeures)} hrs`
      };
    });

    this.sortChantiersList();
    this.updateKpis();
  }

  /**
   * Données de secours (fallback) si aucune donnée en base de données ou en cas d'erreur de serveur
   */
  private loadFallbackData(): void {
    const defaultChantiers: ChantierDisplayItem[] = [
      {
        idChantier: 'c1',
        nomProjet: 'Résidence Les Lilas',
        dateDebut: '2026-03-01',
        dateFinReelle: null,
        statut: 'En cours',
        rue: 'Rue de la Station',
        numero: '14',
        boite: '',
        codePostal: '7000',
        nomVille: 'Mons',
        nomPays: 'Belgique',
        codeIso: 'BE',
        adresseCompleteFormatted: 'Rue de la Station 14, 7000 Mons',
        totalHeures: 142.5,
        cumulHeuresFormatted: '142,5 hrs'
      },
      {
        idChantier: 'c2',
        nomProjet: 'Tour Horizon',
        dateDebut: '2026-01-15',
        dateFinReelle: null,
        statut: 'En cours',
        rue: 'Boulevard du Souverain',
        numero: '100',
        boite: 'A2',
        codePostal: '1160',
        nomVille: 'Auderghem',
        nomPays: 'Belgique',
        codeIso: 'BE',
        adresseCompleteFormatted: 'Boulevard du Souverain 100, bte A2, 1160 Auderghem',
        totalHeures: 280.0,
        cumulHeuresFormatted: '280,0 hrs'
      },
      {
        idChantier: 'c3',
        nomProjet: 'Pont de la Sambre',
        dateDebut: '2025-09-01',
        dateFinReelle: '2026-04-30',
        statut: 'Terminé',
        rue: 'Quai de Sambre',
        numero: '5',
        boite: '',
        codePostal: '6000',
        nomVille: 'Charleroi',
        nomPays: 'Belgique',
        codeIso: 'BE',
        adresseCompleteFormatted: 'Quai de Sambre 5, 6000 Charleroi',
        totalHeures: 512.0,
        cumulHeuresFormatted: '512,0 hrs'
      }
    ];

    this.chantiersList = defaultChantiers;
    this.sortChantiersList();
    this.updateKpis();
  }

  /**
   * Recalcule les statistiques KPIs
   */
  private updateKpis(): void {
    this.totalChantiers = this.chantiersList.length;
    this.enCoursCount = this.chantiersList.filter(c => c.statut === 'En cours').length;
    this.terminesCount = this.chantiersList.filter(c => c.statut === 'Terminé' || c.statut === 'Clôturé').length;
  }

  /**
   * Tri dynamique : "En cours" d'abord, puis par date de début décroissante
   */
  private sortChantiersList(): void {
    this.chantiersList.sort((a, b) => {
      if (a.statut === 'En cours' && b.statut !== 'En cours') return -1;
      if (a.statut !== 'En cours' && b.statut === 'En cours') return 1;
      return new Date(b.dateDebut).getTime() - new Date(a.dateDebut).getTime();
    });
  }

  // =========================================================================
  // GESTION DE LA MODALE : Création / Modification d'un chantier
  // =========================================================================
  openCreateModal(): void {
    const todayIso = this.extractDateIso(new Date());
    this.isCreateMode = true;
    this.selectedChantierForEdit = null;
    this.editForm = {
      nomProjet: '',
      dateDebut: todayIso,
      dateFinReelle: '',
      statut: 'En cours',
      rue: '',
      numero: '',
      boite: '',
      codePostal: '',
      nomVille: '',
      nomPays: 'Belgique',
      codeIso: 'BE'
    };
    this.chantierErrorMessage = '';
    this.showChantierModal = true;
  }

  openEditModal(chantier: ChantierDisplayItem): void {
    this.isCreateMode = false;
    this.selectedChantierForEdit = chantier;
    this.editForm = {
      nomProjet: chantier.nomProjet,
      dateDebut: chantier.dateDebut || '',
      dateFinReelle: chantier.dateFinReelle || '',
      statut: chantier.statut || 'En cours',
      rue: chantier.rue || '',
      numero: chantier.numero || '',
      boite: chantier.boite || '',
      codePostal: chantier.codePostal || '',
      nomVille: chantier.nomVille || '',
      nomPays: chantier.nomPays || 'Belgique',
      codeIso: chantier.codeIso || 'BE'
    };
    this.chantierErrorMessage = '';
    this.showChantierModal = true;
  }

  closeChantierModal(): void {
    this.showChantierModal = false;
    this.selectedChantierForEdit = null;
    this.chantierErrorMessage = '';
    this.isSavingChantier = false;
    this.cd.detectChanges();
  }

  submitSaveChantier(): void {
    if (!this.editForm.nomProjet.trim()) {
      this.chantierErrorMessage = 'Le nom du projet est obligatoire.';
      return;
    }
    if (!this.editForm.dateDebut) {
      this.chantierErrorMessage = 'La date de début est obligatoire.';
      return;
    }
    if (!this.editForm.rue.trim() || !this.editForm.numero.trim()) {
      this.chantierErrorMessage = 'La rue et le numéro d\'adresse sont obligatoires.';
      return;
    }
    if (!this.editForm.codePostal.trim() || !this.editForm.nomVille.trim()) {
      this.chantierErrorMessage = 'Le code postal et la ville sont obligatoires.';
      return;
    }

    this.isSavingChantier = true;
    this.chantierErrorMessage = '';

    const payload: any = {
      nomProjet: this.editForm.nomProjet.trim(),
      dateDebut: this.editForm.dateDebut,
      dateFinReelle: this.editForm.dateFinReelle ? this.editForm.dateFinReelle : undefined,
      statut: this.editForm.statut,
      rue: this.editForm.rue.trim(),
      numero: this.editForm.numero.trim(),
      boite: this.editForm.boite.trim() || undefined,
      codePostal: this.editForm.codePostal.trim(),
      nomVille: this.editForm.nomVille.trim(),
      nomPays: this.editForm.nomPays.trim() || 'Belgique',
      codeIso: this.editForm.codeIso.trim().toUpperCase() || 'BE'
    };

    const isCreate = this.isCreateMode;
    const targetId = this.selectedChantierForEdit?.idChantier;

    // Fermeture immédiate de la modale
    this.closeChantierModal();

    if (isCreate) {
      this.apiService.createChantier(payload).subscribe({
        next: () => {
          this.loadChantiersData();
        },
        error: (err) => {
          console.error('Erreur lors de la création du chantier :', err);
          this.loadChantiersData();
        }
      });
    } else if (targetId) {
      this.apiService.updateChantier(targetId, payload).subscribe({
        next: () => {
          this.loadChantiersData();
        },
        error: (err) => {
          console.error('Erreur lors de la modification du chantier :', err);
          this.loadChantiersData();
        }
      });
    }
  }

  /**
   * Suppression d'un chantier (avec gestion des règles métier backend et alertes esthétiques)
   */
  deleteChantier(chantier: ChantierDisplayItem): void {
    this.toastService.confirm({
      title: 'Supprimer le chantier',
      message: `Voulez-vous vraiment supprimer le chantier "${chantier.nomProjet}" ? Cette action est définitive.`,
      confirmText: 'Supprimer',
      type: 'danger',
      onConfirm: () => {
        this.apiService.deleteChantier(chantier.idChantier).subscribe({
          next: () => {
            this.toastService.success(`Le chantier "${chantier.nomProjet}" a été supprimé.`);
            this.loadChantiersData();
          },
          error: (err) => {
            const msg = err.error?.message || 'Erreur lors de la suppression du chantier.';
            this.toastService.error(msg, 'Action impossible');
          }
        });
      }
    });
  }

  /**
   * Déconnexion
   */
  logout(): void {
    this.authService.logout();
  }
}
