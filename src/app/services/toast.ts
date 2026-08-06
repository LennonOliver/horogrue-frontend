import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  type: 'success' | 'danger' | 'warning' | 'info';
  title: string;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<ToastMessage[]>([]);
  confirmModal = signal<ConfirmOptions | null>(null);

  show(type: 'success' | 'danger' | 'warning' | 'info', title: string, message: string): void {
    const id = Math.random().toString(36).substring(2);
    const toast: ToastMessage = { id, type, title, message };
    this.toasts.update(list => [...list, toast]);

    setTimeout(() => {
      this.remove(id);
    }, 5000);
  }

  success(message: string, title: string = 'Succès'): void {
    this.show('success', title, message);
  }

  error(message: string, title: string = 'Attention'): void {
    this.show('danger', title, message);
  }

  warning(message: string, title: string = 'Avertissement'): void {
    this.show('warning', title, message);
  }

  info(message: string, title: string = 'Information'): void {
    this.show('info', title, message);
  }

  remove(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  confirm(options: ConfirmOptions): void {
    this.confirmModal.set(options);
  }

  closeConfirm(): void {
    this.confirmModal.set(null);
  }
}
