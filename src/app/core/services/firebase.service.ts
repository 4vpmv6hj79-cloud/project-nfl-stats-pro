import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { environment } from '../../../environments/environment';

/**
 * Servicio singleton que inicializa Firebase lazily y expone Auth y Firestore.
 * Usa dynamic imports para que Firebase no entre en el bundle inicial.
 * Solo se inicializa en el browser (no en SSR).
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private readonly platformId = inject(PLATFORM_ID);
  private _app: any = null;
  private _auth: any = null;
  private _firestore: any = null;
  private _analytics: any = null;
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  get auth(): any {
    return this._auth;
  }

  get firestore(): any {
    return this._firestore;
  }

  get analytics(): any {
    return this._analytics;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Inicializa Firebase de forma lazy. Debe llamarse antes de usar auth/firestore.
   * Se puede llamar múltiples veces de forma segura.
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (!isPlatformBrowser(this.platformId)) return;

    if (!this._initPromise) {
      this._initPromise = this.doInitialize();
    }

    return this._initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      const { initializeApp } = await import('firebase/app');
      const { getAuth } = await import('firebase/auth');
      const { getFirestore } = await import('firebase/firestore');

      this._app = initializeApp(environment.firebase);
      this._auth = getAuth(this._app);
      this._firestore = getFirestore(this._app);
      this._initialized = true;

      // Analytics: solo si hay measurementId configurado y el navegador lo soporta
      await this.initAnalytics();
    } catch (e) {
      console.error('Failed to initialize Firebase:', e);
    }
  }

  private async initAnalytics(): Promise<void> {
    // Solo si el proyecto tiene measurementId (Google Analytics habilitado)
    const measurementId = (environment.firebase as any).measurementId;
    if (!measurementId) return;

    try {
      const { getAnalytics, isSupported } = await import('firebase/analytics');
      const supported = await isSupported();
      if (supported && this._app) {
        this._analytics = getAnalytics(this._app);
      }
    } catch {
      // Analytics no disponible; continuar sin él
    }
  }
}
