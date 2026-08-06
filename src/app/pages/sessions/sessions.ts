import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth';
import { ApiService, SessionTravailApi, SessionForfaitApi, OuvrierApi, ChantierApi, VehiculeApi } from '../../services/api';
import { ToastService } from '../../services/toast';

/**
 * Interface pour le relevé agrégé par ouvrier
 */
export interface ReleveOuvrierItem {
  idOuvrier: string;
  nomComplet: string;
  qualification: string;
  heuresP1: number;
  heuresP2: number;
  heuresSelectionnees: number;
  totalMois: number;
  montantP1Htva: number;
  montantP2Htva: number;
  montantSelectionneHtva: number;
  totalMoisHtva: number;
  chantiersParticipes: string[];
}

/**
 * Interface pour le relevé agrégé par chantier
 */
export interface ReleveChantierItem {
  idChantier: string;
  nomProjet: string;
  adresseFormatted: string;
  heuresP1: number;
  heuresP2: number;
  heuresSelectionnees: number;
  totalMois: number;
  montantP1Htva: number;
  montantP2Htva: number;
  montantSelectionneHtva: number;
  totalMoisHtva: number;
  ouvriersParticipantsCount: number;
}

/**
 * Interface unifiée regroupant Sessions à l'heure et Sessions au forfait
 */
export interface SessionUnifiedDisplay {
  id: string;
  entityType: 'HEURE' | 'FORFAIT';
  dateStartIso: string;
  dateEndIso: string;
  periodeAffichageFormatted: string;
  heuresPrestees: number;
  tauxHoraireApplique?: number | null;
  montantForfait?: number | null;
  montantTotalHtva: number;
  montantTotalHtvaFormatted: string;
  idChantier: string;
  nomChantier: string;
  idOuvriers: string[];
  nomOuvriersFormatted: string;
  idVehicule?: string;
  immatriculationVehicule?: string;
  rawSessionHoraire?: SessionTravailApi;
  rawSessionForfait?: SessionForfaitApi;
}

/**
 * Interface pour le regroupement chronologique par jour (Timeline)
 */
export interface SessionGroupDay {
  dateIso: string;
  dayLabelFr: string;
  sessions: SessionUnifiedDisplay[];
  totalHeuresJour: number;
  totalMontantJour: number;
}

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sessions.html',
  styleUrl: './sessions.css'
})
export class Sessions implements OnInit {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  private cd = inject(ChangeDetectorRef);

  isLoading: boolean = true;
  activeTab: 'ouvriers' | 'chantiers' | 'heures' | 'forfaits' = 'ouvriers';

  // -------------------------------------------------------------------------
  // FILTRES DE PÉRIODE
  // -------------------------------------------------------------------------
  selectedYear: number = new Date().getFullYear();
  selectedMonth: number = new Date().getMonth() + 1; // 1-12
  selectedPeriode: 'p1' | 'p2' | 'all' = new Date().getDate() <= 15 ? 'p1' : 'p2';

  availableYears: number[] = [2024, 2025, 2026, 2027];
  monthsList = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' }
  ];

  // Données brutes de l'API REST NestJS
  sessionsHoraire: SessionTravailApi[] = [];
  sessionsForfait: SessionForfaitApi[] = [];
  allOuvriers: OuvrierApi[] = [];
  allChantiers: ChantierApi[] = [];
  allVehicules: VehiculeApi[] = [];

  // Agrégations & Vues séparées
  releveParOuvrier: ReleveOuvrierItem[] = [];
  releveParChantier: ReleveChantierItem[] = [];
  filteredSessionsList: SessionUnifiedDisplay[] = [];
  filteredSessionsHoraire: SessionUnifiedDisplay[] = [];
  filteredSessionsForfait: SessionUnifiedDisplay[] = [];
  groupedHoraireByDay: SessionGroupDay[] = [];

  // KPIs Période
  totalHeuresPeriode: number = 0;
  totalMontantPeriodeHtva: number = 0;
  totalOuvriersActifs: number = 0;
  totalChantiersActifs: number = 0;

  // Modale de création / édition
  showSessionModal: boolean = false;
  isCreateMode: boolean = false;
  selectedSessionForEdit: SessionUnifiedDisplay | null = null;

  sessionForm = {
    dateSession: this.extractDateIso(new Date()),
    dateFinSession: '',
    heuresPrestees: 8,
    typeTarification: 'HEURE' as 'HEURE' | 'FORFAIT',
    tauxHoraireApplique: 30.0 as number | null,
    montantForfait: null as number | null,
    idChantier: '',
    idOuvrier: '',
    idVehicule: ''
  };

  isSavingSession: boolean = false;
  sessionErrorMessage: string = '';

  get currentDateFr(): string {
    return this.formatDateFr(this.extractDateIso(new Date()));
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  loadAllData(): void {
    this.isLoading = true;

    forkJoin({
      sessionsHoraire: this.apiService.getSessions(),
      sessionsForfait: this.apiService.getSessionForfaits(),
      ouvriers: this.apiService.getOuvriers(),
      chantiers: this.apiService.getChantiers(),
      vehicules: this.apiService.getVehicules()
    }).subscribe({
      next: (res) => {
        this.sessionsHoraire = res.sessionsHoraire || [];
        this.sessionsForfait = res.sessionsForfait || [];
        this.allOuvriers = res.ouvriers || [];
        this.allChantiers = res.chantiers || [];
        this.allVehicules = res.vehicules || [];

        this.applyFilterAndAggregate();
        this.isLoading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement API :', err);
        this.isLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  onFilterChange(): void {
    this.applyFilterAndAggregate();
    this.cd.detectChanges();
  }

  extractDateIso(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '';
    if (typeof dateInput === 'string') return dateInput.split('T')[0];
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateFr(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    const cleanStr = this.extractDateIso(dateStr);
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  formatNumber(num: number | null | undefined): string {
    if (num == null || isNaN(num)) return '0,0';
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  formatCurrency(num: number | null | undefined): string {
    if (num == null || isNaN(num)) return '0,00 €';
    return num.toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' });
  }

  private getMetricsHoraireForPeriod(s: SessionTravailApi, periodStartIso: string, periodEndIso: string): { amount: number; hours: number } {
    const dIso = this.extractDateIso(s.dateSession);
    if (dIso >= periodStartIso && dIso <= periodEndIso) {
      const hours = Number(s.heuresPrestees) || 0;
      const rate = Number(s.tauxHoraireApplique) || 0;
      return { amount: hours * rate, hours };
    }
    return { amount: 0, hours: 0 };
  }

  private getMetricsForfaitForPeriod(f: SessionForfaitApi, periodStartIso: string, periodEndIso: string): { amount: number; hours: number } {
    const dStart = this.extractDateIso(f.dateDebut);
    const dEnd = this.extractDateIso(f.dateFin) || dStart;

    const totalAmount = Number(f.montantForfait) || 0;
    const tStart = new Date(dStart).getTime();
    const tEnd = new Date(dEnd).getTime();

    if (isNaN(tStart) || isNaN(tEnd) || tEnd < tStart) {
      return (dStart >= periodStartIso && dStart <= periodEndIso) ? { amount: totalAmount, hours: 0 } : { amount: 0, hours: 0 };
    }

    const totalDays = Math.max(1, Math.round((tEnd - tStart) / (1000 * 3600 * 24)) + 1);

    const oStartIso = dStart > periodStartIso ? dStart : periodStartIso;
    const oEndIso = dEnd < periodEndIso ? dEnd : periodEndIso;

    if (oStartIso > oEndIso) {
      return { amount: 0, hours: 0 };
    }

    const oStart = new Date(oStartIso).getTime();
    const oEnd = new Date(oEndIso).getTime();
    const overlapDays = Math.max(0, Math.round((oEnd - oStart) / (1000 * 3600 * 24)) + 1);

    return {
      amount: (totalAmount / totalDays) * overlapDays,
      hours: 0
    };
  }

  private applyFilterAndAggregate(): void {
    const year = Number(this.selectedYear);
    const month = Number(this.selectedMonth);
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    const monthStartIso = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEndIso = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const p1Start = monthStartIso;
    const p1End = `${year}-${String(month).padStart(2, '0')}-15`;
    const p2Start = `${year}-${String(month).padStart(2, '0')}-16`;
    const p2End = monthEndIso;

    let currentPeriodStart = monthStartIso;
    let currentPeriodEnd = monthEndIso;

    if (this.selectedPeriode === 'p1') {
      currentPeriodStart = p1Start;
      currentPeriodEnd = p1End;
    } else if (this.selectedPeriode === 'p2') {
      currentPeriodStart = p2Start;
      currentPeriodEnd = p2End;
    }

    const sHoraireMonth = this.sessionsHoraire.filter(s => {
      const d = this.extractDateIso(s.dateSession);
      return d >= monthStartIso && d <= monthEndIso;
    });

    const sForfaitMonth = this.sessionsForfait.filter(f => {
      const dStart = this.extractDateIso(f.dateDebut);
      const dEnd = this.extractDateIso(f.dateFin) || dStart;
      return dStart <= monthEndIso && dEnd >= monthStartIso;
    });

    // 1. SESSIONS À L'HEURE (HORAIRE)
    this.filteredSessionsHoraire = sHoraireMonth
      .filter(s => {
        const d = this.extractDateIso(s.dateSession);
        return d >= currentPeriodStart && d <= currentPeriodEnd;
      })
      .map(s => {
        const dStart = this.extractDateIso(s.dateSession);
        const m = this.getMetricsHoraireForPeriod(s, currentPeriodStart, currentPeriodEnd);
        const nomOuv = s.ouvrier ? `${s.ouvrier.prenom || ''} ${s.ouvrier.nom || ''}`.trim() : 'Inconnu';
        const immatriculationVehicule = s.vehicule?.immatriculation || undefined;

        return {
          id: s.idSession,
          entityType: 'HEURE' as const,
          dateStartIso: dStart,
          dateEndIso: dStart,
          periodeAffichageFormatted: this.formatDateFr(dStart),
          heuresPrestees: m.hours,
          tauxHoraireApplique: s.tauxHoraireApplique != null ? Number(s.tauxHoraireApplique) : null,
          montantTotalHtva: m.amount,
          montantTotalHtvaFormatted: this.formatCurrency(m.amount),
          idChantier: s.chantier?.idChantier || '',
          nomChantier: s.chantier?.nomProjet || 'Non assigné',
          idOuvriers: s.ouvrier?.idOuvrier ? [s.ouvrier.idOuvrier] : [],
          nomOuvriersFormatted: nomOuv,
          idVehicule: s.vehicule?.idVehicule,
          immatriculationVehicule,
          rawSessionHoraire: s
        };
      })
      .sort((a, b) => b.dateStartIso.localeCompare(a.dateStartIso));

    // 2. SESSIONS AU FORFAIT
    this.filteredSessionsForfait = sForfaitMonth
      .filter(f => {
        const dStart = this.extractDateIso(f.dateDebut);
        const dEnd = this.extractDateIso(f.dateFin) || dStart;
        return dStart <= currentPeriodEnd && dEnd >= currentPeriodStart;
      })
      .map(f => {
        const dStart = this.extractDateIso(f.dateDebut);
        const dEnd = this.extractDateIso(f.dateFin);
        const m = this.getMetricsForfaitForPeriod(f, currentPeriodStart, currentPeriodEnd);
        const nomOuv = f.ouvrier ? `${f.ouvrier.prenom || ''} ${f.ouvrier.nom || ''}`.trim() : 'Inconnu';

        let periodeStr = this.formatDateFr(dStart);
        if (dEnd && dEnd !== dStart) {
          periodeStr = `Du ${this.formatDateFr(dStart)} au ${this.formatDateFr(dEnd)}`;
        }

        const immatriculationVehicule = f.vehicule?.immatriculation || undefined;

        return {
          id: f.idSessionForfait,
          entityType: 'FORFAIT' as const,
          dateStartIso: dStart,
          dateEndIso: dEnd || dStart,
          periodeAffichageFormatted: periodeStr,
          heuresPrestees: 0,
          montantForfait: Number(f.montantForfait) || 0,
          montantTotalHtva: m.amount,
          montantTotalHtvaFormatted: this.formatCurrency(m.amount),
          idChantier: f.chantier?.idChantier || '',
          nomChantier: f.chantier?.nomProjet || 'Non assigné',
          idOuvriers: f.ouvrier?.idOuvrier ? [f.ouvrier.idOuvrier] : [],
          nomOuvriersFormatted: nomOuv,
          idVehicule: f.vehicule?.idVehicule,
          immatriculationVehicule,
          rawSessionForfait: f
        };
      })
      .sort((a, b) => b.dateStartIso.localeCompare(a.dateStartIso));

    this.filteredSessionsList = [...this.filteredSessionsHoraire, ...this.filteredSessionsForfait]
      .sort((a, b) => b.dateStartIso.localeCompare(a.dateStartIso));

    // Groupement par jour EXCLUSIVEMENT pour les prestations à l'heure (Timeline)
    const dayMap = new Map<string, SessionUnifiedDisplay[]>();
    this.filteredSessionsHoraire.forEach(s => {
      const dIso = s.dateStartIso;
      if (!dayMap.has(dIso)) dayMap.set(dIso, []);
      dayMap.get(dIso)!.push(s);
    });

    const daysSorted = Array.from(dayMap.keys()).sort((a, b) => b.localeCompare(a));
    this.groupedHoraireByDay = daysSorted.map(dIso => {
      const sess = dayMap.get(dIso)!;
      const parts = dIso.split('-');
      let dayLabelFr = dIso;
      if (parts.length === 3) {
        const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(dObj.getTime())) {
          const raw = dObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          dayLabelFr = raw.charAt(0).toUpperCase() + raw.slice(1);
        }
      }

      return {
        dateIso: dIso,
        dayLabelFr,
        sessions: sess,
        totalHeuresJour: sess.reduce((sum, s) => sum + s.heuresPrestees, 0),
        totalMontantJour: sess.reduce((sum, s) => sum + s.montantTotalHtva, 0)
      };
    });

    // 3. AGRÉGATION OUVRIERS
    const mapOuvriers = new Map<string, ReleveOuvrierItem>();

    this.allOuvriers.forEach(o => {
      const qualif = typeof o.qualification === 'object' && o.qualification ? (o.qualification.libelle || 'Ouvrier') : 'Ouvrier polyvalent';
      mapOuvriers.set(o.idOuvrier, {
        idOuvrier: o.idOuvrier,
        nomComplet: `${o.prenom || ''} ${o.nom || ''}`.trim() || 'Collaborateur',
        qualification: qualif,
        heuresP1: 0,
        heuresP2: 0,
        heuresSelectionnees: 0,
        totalMois: 0,
        montantP1Htva: 0,
        montantP2Htva: 0,
        montantSelectionneHtva: 0,
        totalMoisHtva: 0,
        chantiersParticipes: []
      });
    });

    sHoraireMonth.forEach(s => {
      if (!s.ouvrier?.idOuvrier) return;
      const idOuv = s.ouvrier.idOuvrier;
      let item = mapOuvriers.get(idOuv);
      if (!item) {
        item = {
          idOuvrier: idOuv,
          nomComplet: `${s.ouvrier.prenom || ''} ${s.ouvrier.nom || ''}`.trim(),
          qualification: 'Collaborateur',
          heuresP1: 0, heuresP2: 0, heuresSelectionnees: 0, totalMois: 0,
          montantP1Htva: 0, montantP2Htva: 0, montantSelectionneHtva: 0, totalMoisHtva: 0,
          chantiersParticipes: []
        };
        mapOuvriers.set(idOuv, item);
      }

      const mP1 = this.getMetricsHoraireForPeriod(s, p1Start, p1End);
      const mP2 = this.getMetricsHoraireForPeriod(s, p2Start, p2End);
      const mMois = this.getMetricsHoraireForPeriod(s, monthStartIso, monthEndIso);

      item.heuresP1 += mP1.hours;
      item.montantP1Htva += mP1.amount;
      item.heuresP2 += mP2.hours;
      item.montantP2Htva += mP2.amount;
      item.totalMois += mMois.hours;
      item.totalMoisHtva += mMois.amount;

      if (s.chantier?.nomProjet && !item.chantiersParticipes.includes(s.chantier.nomProjet)) {
        item.chantiersParticipes.push(s.chantier.nomProjet);
      }
    });

    sForfaitMonth.forEach(f => {
      if (!f.ouvrier?.idOuvrier) return;
      const idOuv = f.ouvrier.idOuvrier;

      const mP1 = this.getMetricsForfaitForPeriod(f, p1Start, p1End);
      const mP2 = this.getMetricsForfaitForPeriod(f, p2Start, p2End);
      const mMois = this.getMetricsForfaitForPeriod(f, monthStartIso, monthEndIso);

      let item = mapOuvriers.get(idOuv);
      if (!item) {
        item = {
          idOuvrier: idOuv,
          nomComplet: `${f.ouvrier.prenom || ''} ${f.ouvrier.nom || ''}`.trim(),
          qualification: 'Collaborateur',
          heuresP1: 0, heuresP2: 0, heuresSelectionnees: 0, totalMois: 0,
          montantP1Htva: 0, montantP2Htva: 0, montantSelectionneHtva: 0, totalMoisHtva: 0,
          chantiersParticipes: []
        };
        mapOuvriers.set(idOuv, item);
      }

      item.montantP1Htva += mP1.amount;
      item.montantP2Htva += mP2.amount;
      item.totalMoisHtva += mMois.amount;

      if (f.chantier?.nomProjet && !item.chantiersParticipes.includes(f.chantier.nomProjet)) {
        item.chantiersParticipes.push(f.chantier.nomProjet);
      }
    });

    mapOuvriers.forEach(item => {
      if (this.selectedPeriode === 'p1') {
        item.heuresSelectionnees = item.heuresP1;
        item.montantSelectionneHtva = item.montantP1Htva;
      } else if (this.selectedPeriode === 'p2') {
        item.heuresSelectionnees = item.heuresP2;
        item.montantSelectionneHtva = item.montantP2Htva;
      } else {
        item.heuresSelectionnees = item.totalMois;
        item.montantSelectionneHtva = item.totalMoisHtva;
      }
    });

    this.releveParOuvrier = Array.from(mapOuvriers.values())
      .filter(o => o.totalMois > 0 || o.heuresSelectionnees > 0 || o.totalMoisHtva > 0)
      .sort((a, b) => b.montantSelectionneHtva - a.montantSelectionneHtva);

    // 4. AGRÉGATION CHANTIERS
    const mapChantiers = new Map<string, { item: ReleveChantierItem; ouvrierSet: Set<string> }>();

    this.allChantiers.forEach(c => {
      const adr = c.adresse;
      const ville = adr?.localite?.nomVille || adr?.nomVille || adr?.ville?.nomVille || '';
      const cp = adr?.localite?.codePostal || adr?.codePostal || '';
      const adresseFormatted = [cp, ville].filter(Boolean).join(' ');

      mapChantiers.set(c.idChantier, {
        item: {
          idChantier: c.idChantier,
          nomProjet: c.nomProjet || 'Chantier',
          adresseFormatted: adresseFormatted || 'Emplacement non défini',
          heuresP1: 0, heuresP2: 0, heuresSelectionnees: 0, totalMois: 0,
          montantP1Htva: 0, montantP2Htva: 0, montantSelectionneHtva: 0, totalMoisHtva: 0,
          ouvriersParticipantsCount: 0
        },
        ouvrierSet: new Set<string>()
      });
    });

    sHoraireMonth.forEach(s => {
      if (!s.chantier?.idChantier) return;
      const idChant = s.chantier.idChantier;
      let entry = mapChantiers.get(idChant);
      if (!entry) return;

      const mP1 = this.getMetricsHoraireForPeriod(s, p1Start, p1End);
      const mP2 = this.getMetricsHoraireForPeriod(s, p2Start, p2End);
      const mMois = this.getMetricsHoraireForPeriod(s, monthStartIso, monthEndIso);

      entry.item.heuresP1 += mP1.hours;
      entry.item.montantP1Htva += mP1.amount;
      entry.item.heuresP2 += mP2.hours;
      entry.item.montantP2Htva += mP2.amount;
      entry.item.totalMois += mMois.hours;
      entry.item.totalMoisHtva += mMois.amount;

      if (s.ouvrier?.idOuvrier) entry.ouvrierSet.add(s.ouvrier.idOuvrier);
    });

    sForfaitMonth.forEach(f => {
      if (!f.chantier?.idChantier) return;
      const idChant = f.chantier.idChantier;
      let entry = mapChantiers.get(idChant);
      if (!entry) return;

      const mP1 = this.getMetricsForfaitForPeriod(f, p1Start, p1End);
      const mP2 = this.getMetricsForfaitForPeriod(f, p2Start, p2End);
      const mMois = this.getMetricsForfaitForPeriod(f, monthStartIso, monthEndIso);

      entry.item.montantP1Htva += mP1.amount;
      entry.item.montantP2Htva += mP2.amount;
      entry.item.totalMoisHtva += mMois.amount;

      if (f.ouvrier?.idOuvrier) entry.ouvrierSet.add(f.ouvrier.idOuvrier);
    });

    mapChantiers.forEach(entry => {
      if (this.selectedPeriode === 'p1') {
        entry.item.heuresSelectionnees = entry.item.heuresP1;
        entry.item.montantSelectionneHtva = entry.item.montantP1Htva;
      } else if (this.selectedPeriode === 'p2') {
        entry.item.heuresSelectionnees = entry.item.heuresP2;
        entry.item.montantSelectionneHtva = entry.item.montantP2Htva;
      } else {
        entry.item.heuresSelectionnees = entry.item.totalMois;
        entry.item.montantSelectionneHtva = entry.item.totalMoisHtva;
      }
      entry.item.ouvriersParticipantsCount = entry.ouvrierSet.size;
    });

    this.releveParChantier = Array.from(mapChantiers.values())
      .map(e => e.item)
      .filter(c => c.totalMois > 0 || c.heuresSelectionnees > 0 || c.totalMoisHtva > 0)
      .sort((a, b) => b.montantSelectionneHtva - a.montantSelectionneHtva);

    // 5. KPIS DE LA PÉRIODE SÉLECTIONNÉE
    this.totalHeuresPeriode = this.filteredSessionsList.reduce((sum, item) => sum + item.heuresPrestees, 0);
    this.totalMontantPeriodeHtva = this.filteredSessionsList.reduce((sum, item) => sum + item.montantTotalHtva, 0);

    const activeWorkerSet = new Set<string>();
    this.filteredSessionsList.forEach(item => {
      item.idOuvriers.forEach(id => activeWorkerSet.add(id));
    });
    this.totalOuvriersActifs = activeWorkerSet.size;
    this.totalChantiersActifs = new Set(this.filteredSessionsList.map(item => item.idChantier).filter(Boolean)).size;
  }

  openCreateSessionModal(): void {
    this.isCreateMode = true;
    this.selectedSessionForEdit = null;
    const defaultOuvrierId = this.allOuvriers[0]?.idOuvrier || '';

    this.sessionForm = {
      dateSession: this.extractDateIso(new Date()),
      dateFinSession: '',
      heuresPrestees: 8,
      typeTarification: 'HEURE',
      tauxHoraireApplique: 30.0,
      montantForfait: null,
      idChantier: this.allChantiers[0]?.idChantier || '',
      idOuvrier: defaultOuvrierId,
      idVehicule: ''
    };
    this.sessionErrorMessage = '';
    this.showSessionModal = true;
  }

  openEditSessionModal(item: SessionUnifiedDisplay): void {
    this.isCreateMode = false;
    this.selectedSessionForEdit = item;

    this.sessionForm = {
      dateSession: item.dateStartIso,
      dateFinSession: item.dateEndIso !== item.dateStartIso ? item.dateEndIso : '',
      heuresPrestees: item.heuresPrestees,
      typeTarification: item.entityType,
      tauxHoraireApplique: item.tauxHoraireApplique != null ? Number(item.tauxHoraireApplique) : 30.0,
      montantForfait: item.montantForfait != null ? item.montantForfait : null,
      idChantier: item.idChantier,
      idOuvrier: item.idOuvriers[0] || '',
      idVehicule: item.idVehicule || ''
    };
    this.sessionErrorMessage = '';
    this.showSessionModal = true;
  }

  closeSessionModal(): void {
    this.showSessionModal = false;
    this.selectedSessionForEdit = null;
    this.sessionErrorMessage = '';
    this.isSavingSession = false;
    this.cd.detectChanges();
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

  submitSaveSession(): void {
    if (!this.sessionForm.dateSession) {
      this.sessionErrorMessage = 'La date est obligatoire.';
      return;
    }
    if (!this.sessionForm.idChantier) {
      this.sessionErrorMessage = 'Veuillez sélectionner un chantier.';
      return;
    }
    if (!this.sessionForm.idOuvrier) {
      this.sessionErrorMessage = 'Veuillez sélectionner un ouvrier.';
      return;
    }

    this.isSavingSession = true;
    this.sessionErrorMessage = '';

    const isCreate = this.isCreateMode;
    const isForfait = this.sessionForm.typeTarification === 'FORFAIT';

    if (isForfait) {
      if (this.sessionForm.montantForfait == null || this.sessionForm.montantForfait <= 0) {
        this.sessionErrorMessage = 'Veuillez inscrire un montant au forfait valide.';
        this.isSavingSession = false;
        return;
      }

      const dtoForfait: any = {
        dateDebut: this.sessionForm.dateSession,
        dateFin: this.sessionForm.dateFinSession ? this.sessionForm.dateFinSession : null,
        montantForfait: Number(this.sessionForm.montantForfait),
        idChantier: this.sessionForm.idChantier,
        idOuvrier: this.sessionForm.idOuvrier,
        idVehicule: this.sessionForm.idVehicule || undefined
      };

      if (isCreate) {
        this.apiService.createSessionForfait(dtoForfait).subscribe({
          next: () => { this.closeSessionModal(); this.loadAllData(); },
          error: (err) => { this.isSavingSession = false; this.sessionErrorMessage = this.formatApiError(err, 'Erreur lors de la création du forfait.'); this.cd.detectChanges(); }
        });
      } else {
        const idForfait = this.selectedSessionForEdit?.id;
        if (idForfait) {
          this.apiService.updateSessionForfait(idForfait, dtoForfait).subscribe({
            next: () => { this.closeSessionModal(); this.loadAllData(); },
            error: (err) => { this.isSavingSession = false; this.sessionErrorMessage = this.formatApiError(err, 'Erreur lors de la modification du forfait.'); this.cd.detectChanges(); }
          });
        }
      }

    } else {
      if (!this.sessionForm.heuresPrestees || this.sessionForm.heuresPrestees <= 0) {
        this.sessionErrorMessage = 'Veuillez inscrire un nombre d\'heures valide.';
        this.isSavingSession = false;
        return;
      }
      if (this.sessionForm.tauxHoraireApplique == null || this.sessionForm.tauxHoraireApplique <= 0) {
        this.sessionErrorMessage = 'Veuillez saisir un taux horaire HTVA valide.';
        this.isSavingSession = false;
        return;
      }

      const dtoHoraire: any = {
        dateSession: this.sessionForm.dateSession,
        heuresPrestees: Number(this.sessionForm.heuresPrestees),
        tauxHoraireApplique: Number(this.sessionForm.tauxHoraireApplique),
        idChantier: this.sessionForm.idChantier,
        idOuvrier: this.sessionForm.idOuvrier,
        idVehicule: this.sessionForm.idVehicule || undefined
      };

      if (isCreate) {
        this.apiService.createSession(dtoHoraire).subscribe({
          next: () => { this.closeSessionModal(); this.loadAllData(); },
          error: (err) => { this.isSavingSession = false; this.sessionErrorMessage = this.formatApiError(err, 'Erreur lors de la création de la session.'); this.cd.detectChanges(); }
        });
      } else {
        const idHoraire = this.selectedSessionForEdit?.id;
        if (idHoraire) {
          this.apiService.updateSession(idHoraire, dtoHoraire).subscribe({
            next: () => { this.closeSessionModal(); this.loadAllData(); },
            error: (err) => { this.isSavingSession = false; this.sessionErrorMessage = this.formatApiError(err, 'Erreur lors de la modification de la session.'); this.cd.detectChanges(); }
          });
        }
      }
    }
  }

  deleteSession(item: SessionUnifiedDisplay): void {
    this.toastService.confirm({
      title: 'Supprimer la prestation',
      message: `Voulez-vous vraiment supprimer cet enregistrement (${item.entityType === 'FORFAIT' ? 'Session au forfait' : 'Prestation à l\'heure'}) ?`,
      confirmText: 'Supprimer',
      type: 'danger',
      onConfirm: () => {
        if (item.entityType === 'FORFAIT') {
          this.apiService.deleteSessionForfait(item.id).subscribe({
            next: () => {
              this.toastService.success('La session au forfait a été supprimée.');
              this.loadAllData();
            },
            error: (err) => {
              const msg = err.error?.message || 'Erreur lors de la suppression de la session.';
              this.toastService.error(msg, 'Suppression impossible');
            }
          });
        } else {
          this.apiService.deleteSession(item.id).subscribe({
            next: () => {
              this.toastService.success('La prestation à l\'heure a été supprimée.');
              this.loadAllData();
            },
            error: (err) => {
              const msg = err.error?.message || 'Erreur lors de la suppression de la prestation.';
              this.toastService.error(msg, 'Suppression impossible');
            }
          });
        }
      }
    });
  }

  async exportPdf(): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const monthLabel = this.monthsList[this.selectedMonth - 1]?.label || '';
    let periodeStr = 'Mois complet';
    if (this.selectedPeriode === 'p1') periodeStr = '1ère Période (01 au 15)';
    else if (this.selectedPeriode === 'p2') periodeStr = '2ème Période (16 au dernier jour)';

    doc.setFontSize(16);
    doc.setTextColor(13, 110, 253);
    doc.text('HoroGrue - Relevé d\'Heures & Montants (HTVA)', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Période : ${periodeStr} - ${monthLabel} ${this.selectedYear}`, 14, 25);
    doc.text(`Total Heures : ${this.formatNumber(this.totalHeuresPeriode)} hrs | Total Montant : ${this.formatCurrency(this.totalMontantPeriodeHtva)} HTVA`, 14, 31);
    doc.text(`Date d'exportation : ${this.currentDateFr}`, 14, 37);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 40, 196, 40);

    if (this.activeTab === 'ouvriers') {
      const head = [['Ouvrier', 'Qualification', 'P1 (01-15)', 'P2 (16-Fin)', 'Total Heures', 'Montant HTVA']];
      const body = this.releveParOuvrier.map(item => [
        item.nomComplet,
        item.qualification,
        `${this.formatNumber(item.heuresP1)} h`,
        `${this.formatNumber(item.heuresP2)} h`,
        `${this.formatNumber(item.heuresSelectionnees)} h`,
        this.formatCurrency(item.montantSelectionneHtva)
      ]);
      autoTable(doc, {
        startY: 44,
        head: head,
        body: body,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [13, 110, 253], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 35 },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 23, halign: 'center' },
          5: { cellWidth: 35, halign: 'right' }
        }
      });
    } else if (this.activeTab === 'chantiers') {
      const head = [['Nom du Chantier', 'Emplacement', 'P1 (01-15)', 'P2 (16-Fin)', 'Total Heures', 'Montant HTVA']];
      const body = this.releveParChantier.map(c => [
        c.nomProjet,
        c.adresseFormatted || '-',
        `${this.formatNumber(c.heuresP1)} h`,
        `${this.formatNumber(c.heuresP2)} h`,
        `${this.formatNumber(c.heuresSelectionnees)} h`,
        this.formatCurrency(c.montantSelectionneHtva)
      ]);
      autoTable(doc, {
        startY: 44,
        head: head,
        body: body,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [13, 110, 253], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 40 },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 27, halign: 'right' }
        }
      });
    } else if (this.activeTab === 'heures') {
      const head = [['Date', 'Intervenant', 'Chantier', 'Heures', 'Taux', 'Montant HTVA']];
      const body = this.filteredSessionsHoraire.map(s => [
        s.periodeAffichageFormatted,
        s.nomOuvriersFormatted,
        s.nomChantier,
        `${this.formatNumber(s.heuresPrestees)} h`,
        `${this.formatNumber(s.tauxHoraireApplique)} €/h`,
        s.montantTotalHtvaFormatted
      ]);
      autoTable(doc, {
        startY: 44,
        head: head,
        body: body,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [13, 110, 253], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 45 },
          2: { cellWidth: 40 },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 23, halign: 'center' },
          5: { cellWidth: 32, halign: 'right' }
        }
      });
    } else {
      const head = [['Période (Forfait)', 'Intervenant', 'Chantier', 'Montant Fixe HTVA']];
      const body = this.filteredSessionsForfait.map(f => [
        f.periodeAffichageFormatted,
        f.nomOuvriersFormatted,
        f.nomChantier,
        f.montantTotalHtvaFormatted
      ]);
      autoTable(doc, {
        startY: 44,
        head: head,
        body: body,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [106, 27, 154], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 42, halign: 'right' }
        }
      });
    }

    doc.save(`Releve_${this.selectedYear}_${monthLabel}_${this.selectedPeriode.toUpperCase()}.pdf`);
  }

  logout(): void {
    this.authService.logout();
  }
}
