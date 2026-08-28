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
  private _auth: any = null;
  private _firestore: any = null;
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  get auth(): any {
    return this._auth;
  }

  get firestore(): any {
    return this._firestore;
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

      const app = initializeApp(environment.firebase);
      this._auth = getAuth(app);
      this._firestore = getFirestore(app);
      this._initialized = true;
    } catch (e) {
      console.error('Failed to initialize Firebase:', e);
    }
  }
}
