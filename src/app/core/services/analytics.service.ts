import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { FirebaseService } from './firebase.service';

/**
 * Servicio de analítica. Envuelve Firebase Analytics para registrar
 * vistas de página y eventos personalizados sin romper si Analytics
 * no está configurado (measurementId ausente) o en SSR.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly firebase = inject(FirebaseService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Registra un evento personalizado (ej: sign_up, add_favorite, share).
   */
  async logEvent(name: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.isBrowser) return;

    try {
      await this.firebase.initialize();
      const analytics = this.firebase.analytics;
      if (!analytics) return;

      const { logEvent } = await import('firebase/analytics');
      logEvent(analytics, name, params);
    } catch {
      // Silenciar: la analítica nunca debe romper la app
    }
  }

  /**
   * Registra una vista de página.
   */
  async logPageView(path: string, title?: string): Promise<void> {
    await this.logEvent('page_view', {
      page_path: path,
      page_title: title ?? path,
    });
  }
}
