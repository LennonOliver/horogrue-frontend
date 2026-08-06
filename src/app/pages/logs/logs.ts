import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, LogActionApi } from '../../services/api';

export interface LogDisplayItem {
  idLog: string;
  dateFormatted: string;
  typeAction: string;
  badgeClass: string;
  description: string;
  nomGerant: string;
}

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logs.html',
  styleUrl: './logs.css'
})
export class Logs implements OnInit {
  private apiService = inject(ApiService);
  private cd = inject(ChangeDetectorRef);

  isLoading: boolean = true;
  logsList: LogDisplayItem[] = [];
  filteredLogs: LogDisplayItem[] = [];
  searchTerm: string = '';

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading = true;
    this.apiService.getLogs().subscribe({
      next: (res) => {
        this.processLogs(res || []);
        this.isLoading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement logs :', err);
        this.isLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  private processLogs(apiLogs: LogActionApi[]): void {
    this.logsList = apiLogs.map(l => {
      let badgeClass = 'bg-secondary-subtle text-secondary border-secondary-subtle';
      const type = (l.typeAction || '').toUpperCase();

      if (type.includes('CREATE')) {
        badgeClass = 'bg-success-subtle text-success border border-success-subtle';
      } else if (type.includes('UPDATE')) {
        badgeClass = 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      } else if (type.includes('DELETE')) {
        badgeClass = 'bg-danger-subtle text-danger border border-danger-subtle';
      } else if (type.includes('LOGIN')) {
        badgeClass = 'bg-primary-subtle text-primary border border-primary-subtle';
      }

      // Formatage précis de la date et de l'heure en fuseau horaire Europe/Brussels
      let dateFormatted = '-';
      if (l.dateAction) {
        let d = new Date(l.dateAction);
        if (isNaN(d.getTime()) && typeof l.dateAction === 'string') {
          d = new Date((l.dateAction as string).replace(' ', 'T'));
        }
        if (!isNaN(d.getTime())) {
          dateFormatted = d.toLocaleString('fr-BE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            timeZone: 'Europe/Brussels'
          });
        }
      }

      const nomGerant = (l.gerant && (l.gerant.prenom || l.gerant.nom))
        ? `${l.gerant.prenom || ''} ${l.gerant.nom || ''}`.trim()
        : 'Olivier Hollebeke';

      return {
        idLog: l.idLog,
        dateFormatted,
        typeAction: l.typeAction || 'ACTION',
        badgeClass,
        description: l.description || 'Aucune description',
        nomGerant
      };
    });

    this.onSearchChange();
  }

  onSearchChange(): void {
    const term = (this.searchTerm || '').toLowerCase().trim();
    if (!term) {
      this.filteredLogs = [...this.logsList];
    } else {
      this.filteredLogs = this.logsList.filter(l =>
        l.typeAction.toLowerCase().includes(term) ||
        l.description.toLowerCase().includes(term) ||
        l.nomGerant.toLowerCase().includes(term) ||
        l.dateFormatted.toLowerCase().includes(term)
      );
    }
  }
}
