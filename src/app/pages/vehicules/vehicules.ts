import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { ApiService, VehiculeApi } from '../../services/api';

/**
 * Interface représentant un véhicule enrichi pour l'affichage dans le tableau de bord
 */
export interface VehiculeDisplayItem {
  idVehicule: string;
  immatriculation: string;
  numeroChassis: string;
  dateMec: string;
  nomMarque: string;
  nomModele: string;
  marqueModele: string;
  kilometrageActuel: number;
  kilometrageActuelFormatted: string;
  dateProchainCt: string | null;
  dateProchainCtFormatted: string;
  daysUntilCt: number | null;
  kmProchainEntretien: number | null;
  kmProchainEntretienFormatted: string;
  kmRestantsEntretien: number | null;
  kmRestantsAbsFormatted: string;
  statusEntretien: 'ok' | 'warning' | 'danger';
  statusCt: 'ok' | 'warning' | 'danger';
}

@Component({
  selector: 'app-vehicules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicules.html',
  styleUrl: './vehicules.css'
})
export class Vehicules implements OnInit {
  // Injection des services d'authentification, de communication API NestJS et du détection de changements Angular
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private cd = inject(ChangeDetectorRef);

  // Informations de l'utilisateur connecté
  userFullName: string = 'Olivier Hollebeke';

  // Date d'aujourd'hui au format YYYY-MM-DD pour restreindre le sélecteur HTML5
  maxDateToday: string = new Date().toISOString().substring(0, 10);

  // État de chargement et listes de véhicules
  isLoading: boolean = true;
  vehiculesRaw: VehiculeApi[] = [];
  vehiculesList: VehiculeDisplayItem[] = [];

  // Statistiques calculées pour le haut de page
  totalVehicules: number = 0;
  alertesEntretienCount: number = 0;
  alertesCtCount: number = 0;

  // -------------------------------------------------------------------------
  // MODALE 1 : Mise à jour rapide du kilométrage
  // -------------------------------------------------------------------------
  selectedVehiculeForKm: VehiculeDisplayItem | null = null;
  newKilometrage: number | null = null;
  isUpdatingKm: boolean = false;
  kmErrorMessage: string = '';

  // -------------------------------------------------------------------------
  // MODALE 2 : Création & Modification d'un véhicule
  // -------------------------------------------------------------------------
  showVehiculeModal: boolean = false;
  isCreateMode: boolean = false;
  selectedVehiculeForEdit: VehiculeDisplayItem | null = null;
  editForm = {
    immatriculation: '',
    numeroChassis: '',
    dateMec: '',
    nomMarque: '',
    nomModele: '',
    kilometrageActuel: 0,
    kmProchainEntretien: null as number | null,
    dateProchainCt: ''
  };
  isSavingVehicule: boolean = false;
  vehiculeErrorMessage: string = '';

  // -------------------------------------------------------------------------
  // MODALE 3 : Suppression d'un véhicule
  // -------------------------------------------------------------------------
  selectedVehiculeForDelete: VehiculeDisplayItem | null = null;
  isDeletingVehicule: boolean = false;
  deleteErrorMessage: string = '';

  ngOnInit(): void {
    // Chargement initial des véhicules depuis le backend lors de l'initialisation du composant
    this.loadVehicules();
  }

  /**
   * Interroge l'API REST pour récupérer tous les véhicules
   */
  loadVehicules(): void {
    this.isLoading = true;
    this.apiService.getVehicules().subscribe({
      next: (data) => {
        this.vehiculesRaw = data;
        this.processVehiculesList(data);
        this.isLoading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des véhicules :', err);
        // Utilisation de données de démonstration de secours si l'API ne répond pas ou est vide
        this.loadFallbackData();
        this.isLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  /**
   * Formate les nombres avec séparateurs d'espaces (ex: 148 550)
   */
  private formatNumber(num: number | null | undefined): string {
    if (num == null || isNaN(num)) return '0';
    return Math.round(num).toLocaleString('fr-FR');
  }

  /**
   * Formate une date au format français DD/MM/YYYY
   */
  private formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return 'Non planifié';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Traite et enrichit les données de véhicules pour calculer dynamiquement les statuts
   */
  private processVehiculesList(data: VehiculeApi[]): void {
    if (!data || data.length === 0) {
      this.loadFallbackData();
      return;
    }

    const aujourdhui = new Date();

    this.vehiculesList = data.map(v => {
      // Extraction de la marque et du modèle
      let marque = '';
      if (typeof v.modele?.marque === 'object' && v.modele?.marque !== null) {
        marque = (v.modele.marque as any).nomMarque || (v.modele.marque as any).nom || '';
      } else if (typeof v.modele?.marque === 'string') {
        marque = v.modele.marque;
      }
      const nomModele = v.modele?.nomModele || '';
      const marqueModele = [marque, nomModele].filter(Boolean).join(' ') || 'Camionnette';

      const kmActuel = Number(v.kilometrageActuel ?? 0);
      const kmProchain = v.kmProchainEntretien != null ? Number(v.kmProchainEntretien) : null;

      // 1. Évaluation dynamique du statut d'entretien par kilométrage
      let kmRestants: number | null = null;
      let statusEntretien: 'ok' | 'warning' | 'danger' = 'ok';

      if (kmProchain != null) {
        kmRestants = kmProchain - kmActuel;
        if (kmRestants < 0) {
          statusEntretien = 'danger'; // Entretien dépassé
        } else if (kmRestants <= 5000) {
          statusEntretien = 'warning'; // Entretien proche
        }
      }

      // 2. Évaluation dynamique du statut de contrôle technique par date
      let daysUntilCt: number | null = null;
      let statusCt: 'ok' | 'warning' | 'danger' = 'ok';

      if (v.dateProchainCt) {
        const dateCt = new Date(v.dateProchainCt);
        if (!isNaN(dateCt.getTime())) {
          daysUntilCt = Math.ceil((dateCt.getTime() - aujourdhui.getTime()) / (1000 * 3600 * 24));
          if (daysUntilCt <= 0) {
            statusCt = 'danger'; // CT expiré ou aujourd'hui
          } else if (daysUntilCt <= 30) {
            statusCt = 'warning'; // CT prévu dans moins de 30 jours
          }
        }
      }

      return {
        idVehicule: v.idVehicule,
        immatriculation: v.immatriculation || 'Non renseignée',
        numeroChassis: v.numeroChassis || 'N/A',
        dateMec: v.dateMec || '',
        nomMarque: marque,
        nomModele,
        marqueModele,
        kilometrageActuel: kmActuel,
        kilometrageActuelFormatted: `${this.formatNumber(kmActuel)} km`,
        dateProchainCt: v.dateProchainCt || null,
        dateProchainCtFormatted: this.formatDate(v.dateProchainCt),
        daysUntilCt,
        kmProchainEntretien: kmProchain,
        kmProchainEntretienFormatted: kmProchain != null ? `${this.formatNumber(kmProchain)} km` : 'Non défini',
        kmRestantsEntretien: kmRestants,
        kmRestantsAbsFormatted: kmRestants != null ? this.formatNumber(Math.abs(kmRestants)) : '0',
        statusEntretien,
        statusCt
      };
    });

    // Tri alphabétique par Marque & Modèle (puis par Immatriculation)
    this.vehiculesList.sort((a, b) => {
      const cmp = a.marqueModele.localeCompare(b.marqueModele, 'fr', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return a.immatriculation.localeCompare(b.immatriculation, 'fr', { sensitivity: 'base' });
    });

    // Mise à jour des compteurs globaux
    this.totalVehicules = this.vehiculesList.length;
    this.alertesEntretienCount = this.vehiculesList.filter(v => v.statusEntretien !== 'ok').length;
    this.alertesCtCount = this.vehiculesList.filter(v => v.statusCt !== 'ok').length;
  }

  /**
   * Données par défaut si aucune donnée n'est renvoyée par la base de données
   */
  private loadFallbackData(): void {
    const defaultData: VehiculeApi[] = [
      {
        idVehicule: '1',
        immatriculation: '2-ABC-111',
        numeroChassis: 'VF1R1234567890123',
        dateMec: '2021-03-15',
        kmProchainEntretien: 150000,
        kilometrageActuel: 148550,
        dateProchainCt: '2026-11-15',
        modele: { nomModele: 'Master', marque: { nomMarque: 'Renault' } }
      },
      {
        idVehicule: '2',
        immatriculation: '1-XYZ-999',
        numeroChassis: 'VF3M9876543210987',
        dateMec: '2020-06-20',
        kmProchainEntretien: 200000,
        kilometrageActuel: 195000,
        dateProchainCt: '2026-08-17',
        modele: { nomModele: 'Boxer', marque: { nomMarque: 'Peugeot' } }
      },
      {
        idVehicule: '3',
        immatriculation: '1-ABC-123',
        numeroChassis: 'JTDKN36U901234567',
        dateMec: '2019-01-10',
        kmProchainEntretien: 70000,
        kilometrageActuel: 65001,
        dateProchainCt: '2026-09-07',
        modele: { nomModele: 'Yaris', marque: { nomMarque: 'Toyota' } }
      }
    ];

    this.processVehiculesList(defaultData);
  }

  // =========================================================================
  // GESTION DE LA MODALE 1 : Mise à jour Kilométrage
  // =========================================================================
  openKmModal(vehicule: VehiculeDisplayItem): void {
    this.selectedVehiculeForKm = vehicule;
    this.newKilometrage = vehicule.kilometrageActuel;
    this.kmErrorMessage = '';
  }

  submitKilometrage(): void {
    if (!this.selectedVehiculeForKm || this.newKilometrage === null) return;

    if (this.newKilometrage < 0) {
      this.kmErrorMessage = 'Le kilométrage ne peut pas être négatif.';
      return;
    }

    const idVehicule = this.selectedVehiculeForKm.idVehicule;
    const newKm = Number(this.newKilometrage);

    // Fermeture immédiate de la modale
    this.closeKmModal();

    this.apiService.updateKilometrageVehicule(idVehicule, newKm).subscribe({
      next: () => {
        this.loadVehicules();
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour du kilométrage :', err);
        this.loadVehicules();
      }
    });
  }

  closeKmModal(): void {
    this.selectedVehiculeForKm = null;
    this.newKilometrage = null;
    this.kmErrorMessage = '';
    this.isUpdatingKm = false;
    this.cd.detectChanges();
  }

  // =========================================================================
  // GESTION DE LA MODALE 2 : Création et Modification du Véhicule
  // =========================================================================
  openCreateModal(): void {
    this.isCreateMode = true;
    this.selectedVehiculeForEdit = null;
    this.editForm = {
      immatriculation: '',
      numeroChassis: '',
      dateMec: '',
      nomMarque: '',
      nomModele: '',
      kilometrageActuel: 0,
      kmProchainEntretien: null,
      dateProchainCt: ''
    };
    this.vehiculeErrorMessage = '';
    this.showVehiculeModal = true;
  }

  openEditModal(vehicule: VehiculeDisplayItem): void {
    this.isCreateMode = false;
    this.selectedVehiculeForEdit = vehicule;
    this.editForm = {
      immatriculation: vehicule.immatriculation,
      numeroChassis: vehicule.numeroChassis,
      dateMec: vehicule.dateMec ? vehicule.dateMec.substring(0, 10) : '',
      nomMarque: vehicule.nomMarque || 'Toyota',
      nomModele: vehicule.nomModele || 'Yaris',
      kilometrageActuel: vehicule.kilometrageActuel,
      kmProchainEntretien: vehicule.kmProchainEntretien,
      dateProchainCt: vehicule.dateProchainCt ? vehicule.dateProchainCt.substring(0, 10) : ''
    };
    this.vehiculeErrorMessage = '';
    this.showVehiculeModal = true;
  }

  private formatApiError(err: any, fallbackMessage: string): string {
    if (err?.error?.message) {
      if (Array.isArray(err.error.message)) {
        return err.error.message.join(', ');
      }
      return String(err.error.message);
    }
    return fallbackMessage;
  }

  submitSaveVehicule(): void {
    if (!this.editForm.immatriculation || !this.editForm.numeroChassis) {
      this.vehiculeErrorMessage = 'L\'immatriculation et le numéro de châssis sont obligatoires.';
      return;
    }

    const cleanImmat = this.editForm.immatriculation.trim().toUpperCase();
    const cleanChassis = this.editForm.numeroChassis.trim().toUpperCase();

    if (cleanImmat.length > 9) {
      this.vehiculeErrorMessage = "L'immatriculation ne peut pas comporter plus de 9 caractères.";
      return;
    }

    // 1. Vérification d'unicité de l'immatriculation sur le Front
    const duplicateImmat = this.vehiculesList.find(v => 
      v.immatriculation.trim().toUpperCase() === cleanImmat && 
      (this.isCreateMode || (this.selectedVehiculeForEdit && v.idVehicule !== this.selectedVehiculeForEdit.idVehicule))
    );
    if (duplicateImmat) {
      this.vehiculeErrorMessage = `Un véhicule avec l'immatriculation "${cleanImmat}" existe déjà.`;
      return;
    }

    // 2. Vérification d'unicité du numéro de châssis sur le Front
    const duplicateChassis = this.vehiculesList.find(v => 
      v.numeroChassis.trim().toUpperCase() === cleanChassis && 
      (this.isCreateMode || (this.selectedVehiculeForEdit && v.idVehicule !== this.selectedVehiculeForEdit.idVehicule))
    );
    if (duplicateChassis) {
      this.vehiculeErrorMessage = `Un véhicule avec le numéro de châssis "${cleanChassis}" existe déjà.`;
      return;
    }

    // 3. Vérification de la date de mise en circulation (pas dans le futur)
    if (this.editForm.dateMec) {
      const selectedDate = new Date(this.editForm.dateMec);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) {
        this.vehiculeErrorMessage = 'La date de mise en circulation ne peut pas être située dans le futur.';
        return;
      }
    }

    const payload = {
      immatriculation: cleanImmat,
      numeroChassis: cleanChassis,
      dateMec: this.editForm.dateMec || undefined,
      nomMarque: this.editForm.nomMarque?.trim() || undefined,
      nomModele: this.editForm.nomModele?.trim() || undefined,
      kilometrageActuel: Number(this.editForm.kilometrageActuel) || 0,
      kmProchainEntretien: this.editForm.kmProchainEntretien ? Number(this.editForm.kmProchainEntretien) : undefined,
      dateProchainCt: this.editForm.dateProchainCt || undefined
    };

    const isCreate = this.isCreateMode;
    const editVehiculeId = this.selectedVehiculeForEdit?.idVehicule;

    this.isSavingVehicule = true;
    this.vehiculeErrorMessage = '';

    if (isCreate) {
      // 1. Mode Création
      this.apiService.createVehicule(payload).subscribe({
        next: () => {
          this.closeVehiculeModal();
          this.loadVehicules();
        },
        error: (err) => {
          this.isSavingVehicule = false;
          this.vehiculeErrorMessage = this.formatApiError(err, 'Erreur lors de la création du véhicule.');
          this.cd.detectChanges();
        }
      });
    } else if (editVehiculeId) {
      // 2. Mode Modification
      this.apiService.updateVehicule(editVehiculeId, payload).subscribe({
        next: () => {
          this.closeVehiculeModal();
          this.loadVehicules();
        },
        error: (err) => {
          this.isSavingVehicule = false;
          this.vehiculeErrorMessage = this.formatApiError(err, 'Erreur lors de la modification du véhicule.');
          this.cd.detectChanges();
        }
      });
    }
  }

  closeVehiculeModal(): void {
    this.showVehiculeModal = false;
    this.selectedVehiculeForEdit = null;
    this.vehiculeErrorMessage = '';
    this.isSavingVehicule = false;
    this.cd.detectChanges();
  }

  // =========================================================================
  // GESTION DE LA MODALE 3 : Suppression de Véhicule
  // =========================================================================
  openDeleteModal(vehicule: VehiculeDisplayItem): void {
    this.selectedVehiculeForDelete = vehicule;
    this.deleteErrorMessage = '';
  }

  closeDeleteModal(): void {
    this.selectedVehiculeForDelete = null;
    this.deleteErrorMessage = '';
    this.isDeletingVehicule = false;
    this.cd.detectChanges();
  }

  confirmDeleteVehicule(): void {
    if (!this.selectedVehiculeForDelete) return;

    const targetId = this.selectedVehiculeForDelete.idVehicule;

    // Fermeture immédiate et garantie de la modale de suppression
    this.closeDeleteModal();

    this.apiService.deleteVehicule(targetId).subscribe({
      next: () => {
        this.loadVehicules();
      },
      error: (err) => {
        console.error('Erreur lors de la suppression du véhicule :', err);
        // Suppression locale en mode fallback / démo
        this.vehiculesList = this.vehiculesList.filter(v => v.idVehicule !== targetId);
        this.totalVehicules = this.vehiculesList.length;
        this.cd.detectChanges();
      }
    });
  }

  /**
   * Déconnexion de l'application
   */
  logout(): void {
    this.authService.logout();
  }
}
