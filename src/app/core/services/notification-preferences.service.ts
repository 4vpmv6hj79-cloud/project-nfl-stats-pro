import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface NotificationPreferences {
  gameStart: boolean;      // Inicio del partido
  touchdowns: boolean;     // Touchdowns
  finalScore: boolean;     // Resultado final
  redZone: boolean;        // Cuando el equipo entra a zona roja
  closeGame: boolean;      // Partido cerrado en el 4to cuarto
}

export type NotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

const STORAGE_KEY = 'nfl-notification-prefs';

const DEFAULT_PREFS: NotificationPreferences = {
  gameStart: true,
  touchdowns: true,
  finalScore: true,
  redZone: false,
  closeGame: false,
};

@Injectable({ providedIn: 'root' })
export class NotificationPreferencesService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly preferences = signal<NotificationPreferences>(this.load());
  readonly permission = signal<NotificationPermission>(this.getPermission());

  constructor() {
    effect(() => {
      const prefs = this.preferences();
      if (this.isBrowser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      }
    });
  }

  /** Solicita permiso al usuario para mostrar notificaciones */
  async requestPermission(): Promise<boolean> {
    if (!this.isBrowser || !('Notification' in window)) {
      this.permission.set('unsupported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      this.permission.set(result as NotificationPermission);
      return result === 'granted';
    } catch {
      return false;
    }
  }

  /** Actualiza una preferencia específica */
  updatePreference(key: keyof NotificationPreferences, value: boolean): void {
    this.preferences.update(prefs => ({ ...prefs, [key]: value }));
  }

  /** Muestra una notificación nativa del navegador */
  notify(title: string, options?: { body?: string; icon?: string; tag?: string }): void {
    if (!this.isBrowser || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      new Notification(title, {
        body: options?.body,
        icon: options?.icon ?? '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag: options?.tag,
      });
    } catch {
      // Silenciar errores de notificación
    }
  }

  private getPermission(): NotificationPermission {
    if (!this.isBrowser || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as NotificationPermission;
  }

  private load(): NotificationPreferences {
    if (!this.isBrowser) return DEFAULT_PREFS;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  }
}
