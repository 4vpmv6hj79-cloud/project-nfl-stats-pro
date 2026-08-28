import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

import { environment } from '../../../environments/environment';

/**
 * Servicio singleton que inicializa Firebase y expone Auth y Firestore.
 * Solo se inicializa en el browser (no en SSR).
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private readonly platformId = inject(PLATFORM_ID);
  private app: FirebaseApp | null = null;
  private _auth: Auth | null = null;
  private _firestore: Firestore | null = null;

  get auth(): Auth | null {
    if (!this._auth && isPlatformBrowser(this.platformId)) {
      this.initialize();
    }
    return this._auth;
  }

  get firestore(): Firestore | null {
    if (!this._firestore && isPlatformBrowser(this.platformId)) {
      this.initialize();
    }
    return this._firestore;
  }

  private initialize(): void {
    if (this.app) return;

    this.app = initializeApp(environment.firebase);
    this._auth = getAuth(this.app);
    this._firestore = getFirestore(this.app);
  }
}
