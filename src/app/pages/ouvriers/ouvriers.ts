import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth';
import { ApiService, OuvrierApi, SessionTravailApi } from '../../services/api';

/**
 * Interface représentant un ouvrier enrichi pour l'affichage dans le tableau de bord
 */
export interface OuvrierDisplayItem {
  idOuvrier: string;
  nom: string;
  prenom: string;
  nomComplet: string;
  qualification: string;
  actif: boolean;
  cumulHeuresFormatted: string;
  totalHeures: number;
  estAffecte: boolean;
  nomChantierAffecte?: string;
}

@Component({
  selector: 'app-ouvriers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ouvriers.html',
  styleUrl: './ouvriers.css'
})
export class Ouvriers implements OnInit {
  // Injection des services
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private cd = inject(ChangeDetectorRef);

  // Informations utilisateur
  userFullName: string = 'Olivier Hollebeke';

  // État de chargement et listes
  isLoading: boolean = true;
  ouvriersList: OuvrierDisplayItem[] = [];

  // Statistiques KPIs
  totalOuvriers: number = 0;
  actifsCount: number = 0;
  inactifsCount: number = 0;

  // -------------------------------------------------------------------------
  // MODALE 1 : Création / Modification d'un ouvrier
  // -------------------------------------------------------------------------
  showOuvrierModal: boolean = false;
  isCreateMode: boolean = false;
  selectedOuvrierForEdit: OuvrierDisplayItem | null = null;
  editForm = {
    nom: '',
    prenom: '',
    libelleQualification: '',
    actif: true
  };
  isSavingOuvrier: boolean = false;
  ouvrierErrorMessage: string = '';

  ngOnInit(): void {
    this.loadOuvriersData();
  }

  /**
   * Charge la liste des ouvriers et les sessions de travail associées depuis le backend NestJS
   */
  loadOuvriersData(): void {
    this.isLoading = true;

    forkJoin({
      ouvriers: this.apiService.getOuvriers(),
      sessions: this.apiService.getSessions()
    }).subscribe({
      next: (res) => {
        this.processOuvriersList(res.ouvriers || [], res.sessions || []);
        this.isLoading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement du personnel :', err);
        this.loadFallbackData();
        this.isLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  /**
   * Formate les nombres avec séparateurs d'espaces (ex: 120,5)
   */
  private formatNumber(num: number | null | undefined): string {
    if (num == null || isNaN(num)) return '0,0';
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  /**
   * Traite et enrichit les données des ouvriers avec le cumul d'heures prestées
   */
  private processOuvriersList(ouvriersApi: OuvrierApi[], sessionsApi: SessionTravailApi[]): void {
    if (!ouvriersApi || ouvriersApi.length === 0) {
      this.loadFallbackData();
      return;
    }

    this.ouvriersList = ouvriersApi.map(o => {
      // Sessions de travail liées à cet ouvrier ayant un chantier rattaché
      const sessionsOuvrier = sessionsApi.filter(s => s.ouvrier?.idOuvrier === o.idOuvrier && s.chantier);

      // Calcul du cumul d'heures totales pour cet ouvrier
      const totalHeures = sessionsOuvrier.reduce((sum, s) => sum + (Number(s.heuresPrestees) || 0), 0);

      // Vérification si l'ouvrier est affecté à un chantier
      const estAffecte = sessionsOuvrier.length > 0;
      const nomChantierAffecte = estAffecte ? (sessionsOuvrier[0].chantier?.nomProjet || 'Chantier en cours') : undefined;

      // Extraction du libellé de qualification
      let qualif = 'Ouvrier polyvalent';
      if (typeof o.qualification === 'object' && o.qualification !== null) {
        qualif = o.qualification.libelle || 'Ouvrier qualifié';
      } else if (typeof o.qualification === 'string') {
        qualif = o.qualification;
      }

      return {
        idOuvrier: o.idOuvrier,
        nom: o.nom || '',
        prenom: o.prenom || '',
        nomComplet: `${o.prenom || ''} ${o.nom || ''}`.trim(),
        qualification: qualif,
        actif: o.actif ?? true,
        totalHeures,
        cumulHeuresFormatted: `${this.formatNumber(totalHeures)} hrs`,
        estAffecte,
        nomChantierAffecte
      };
    });

    // Tri : Actifs d'abord (true avant false), puis par ordre alphabétique Nom / Prénom
    this.sortOuvriersList();

    // Calcul des statistiques
    this.totalOuvriers = this.ouvriersList.length;
    this.actifsCount = this.ouvriersList.filter(o => o.actif).length;
    this.inactifsCount = this.ouvriersList.filter(o => !o.actif).length;
  }

  /**
   * Données de secours (fallback) si aucune donnée en base de données
   */
  private loadFallbackData(): void {
    const defaultOuvriers: OuvrierDisplayItem[] = [
      {
        idOuvrier: '1',
        nom: 'Doe',
        prenom: 'John',
        nomComplet: 'John Doe',
        qualification: 'Grutier Senior',
        actif: true,
        totalHeures: 142.5,
        cumulHeuresFormatted: '142,5 hrs',
        estAffecte: true,
        nomChantierAffecte: 'Résidence Les Lilas'
      },
      {
        idOuvrier: '2',
        nom: 'Martin',
        prenom: 'Marc',
        nomComplet: 'Marc Martin',
        qualification: 'Chauffeur Poids Lourds',
        actif: true,
        totalHeures: 98.0,
        cumulHeuresFormatted: '98,0 hrs',
        estAffecte: true,
        nomChantierAffecte: 'Tour Horizon'
      },
      {
        idOuvrier: '3',
        nom: 'Simpson',
        prenom: 'Homer',
        nomComplet: 'Homer Simpson',
        qualification: 'Apprenti Manœuvre',
        actif: false,
        totalHeures: 28.5,
        cumulHeuresFormatted: '28,5 hrs',
        estAffecte: false
      }
    ];

    this.ouvriersList = defaultOuvriers;
    this.sortOuvriersList();

    this.totalOuvriers = this.ouvriersList.length;
    this.actifsCount = this.ouvriersList.filter(o => o.actif).length;
    this.inactifsCount = this.ouvriersList.filter(o => !o.actif).length;
  }

  // =========================================================================
  // GESTION DE LA MODALE 1 : Création / Modification d'un ouvrier
  // =========================================================================
  openCreateModal(): void {
    this.isCreateMode = true;
    this.selectedOuvrierForEdit = null;
    this.editForm = {
      nom: '',
      prenom: '',
      libelleQualification: 'Grutier qualifié',
      actif: true
    };
    this.ouvrierErrorMessage = '';
    this.showOuvrierModal = true;
  }

  openEditModal(ouvrier: OuvrierDisplayItem): void {
    this.isCreateMode = false;
    this.selectedOuvrierForEdit = ouvrier;
    this.editForm = {
      nom: ouvrier.nom,
      prenom: ouvrier.prenom,
      libelleQualification: ouvrier.qualification,
      actif: ouvrier.actif
    };
    this.ouvrierErrorMessage = '';
    this.showOuvrierModal = true;
  }

  submitSaveOuvrier(): void {
    if (!this.editForm.nom.trim() || !this.editForm.prenom.trim()) {
      this.ouvrierErrorMessage = 'Le nom et le prénom sont obligatoires.';
      return;
    }

    if (!this.editForm.libelleQualification.trim()) {
      this.ouvrierErrorMessage = 'La qualification est obligatoire.';
      return;
    }

    this.isSavingOuvrier = true;
    this.ouvrierErrorMessage = '';

    const payload = {
      nom: this.editForm.nom.trim(),
      prenom: this.editForm.prenom.trim(),
      libelleQualification: this.editForm.libelleQualification.trim(),
      actif: this.editForm.actif
    };

    const isCreate = this.isCreateMode;
    const targetId = this.selectedOuvrierForEdit?.idOuvrier;

    // Fermeture synchrone immédiate de la modale
    this.closeOuvrierModal();

    if (isCreate) {
      this.apiService.createOuvrier(payload).subscribe({
        next: () => {
          this.loadOuvriersData();
        },
        error: (err) => {
          console.error('Erreur lors de la création de l\'ouvrier :', err);
          this.loadOuvriersData();
        }
      });
    } else if (targetId) {
      this.apiService.updateOuvrier(targetId, payload).subscribe({
        next: () => {
          this.loadOuvriersData();
        },
        error: (err) => {
          console.error('Erreur lors de la modification de l\'ouvrier :', err);
          this.loadOuvriersData();
        }
      });
    }
  }

  closeOuvrierModal(): void {
    this.showOuvrierModal = false;
    this.selectedOuvrierForEdit = null;
    this.ouvrierErrorMessage = '';
    this.isSavingOuvrier = false;
    this.cd.detectChanges();
  }

  /**
   * Tri dynamique : Actifs d'abord (true avant false), puis par ordre alphabétique Nom / Prénom
   */
  private sortOuvriersList(): void {
    this.ouvriersList.sort((a, b) => {
      if (a.actif !== b.actif) {
        return a.actif ? -1 : 1;
      }
      const cmpNom = a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
      if (cmpNom !== 0) return cmpNom;
      return a.prenom.localeCompare(b.prenom, 'fr', { sensitivity: 'base' });
    });
  }

  /**
   * Bascule rapidement le statut actif/inactif d'un ouvrier avec ré-ordonnancement dynamique immédiat
   */
  toggleStatus(ouvrier: OuvrierDisplayItem): void {
    const newStatus = !ouvrier.actif;
    ouvrier.actif = newStatus;

    // Ré-ordonnancement dynamique immédiat du tableau
    this.sortOuvriersList();
    this.actifsCount = this.ouvriersList.filter(o => o.actif).length;
    this.inactifsCount = this.ouvriersList.filter(o => !o.actif).length;
    this.cd.detectChanges();

    this.apiService.updateOuvrier(ouvrier.idOuvrier, { actif: newStatus }).subscribe({
      error: (err) => {
        console.error('Erreur lors du changement de statut :', err);
        // En cas d'erreur de communication API, rétablissement du statut précédent
        ouvrier.actif = !newStatus;
        this.sortOuvriersList();
        this.actifsCount = this.ouvriersList.filter(o => o.actif).length;
        this.inactifsCount = this.ouvriersList.filter(o => !o.actif).length;
        this.cd.detectChanges();
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
