import { Injectable, inject, signal, effect, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';

/**
 * Servicio que expone el estado de suscripción (Pro) del usuario.
 *
 * Lee el campo `pro` del documento users/{uid} en Firestore, que es
 * actualizado por el webhook de Stripe (api/stripe-webhook.mjs) cuando
 * un pago se completa o una suscripción cambia de estado.
 *
 * Se mantiene sincronizado en tiempo real con onSnapshot, así que si el
 * usuario paga en otra pestaña, el acceso Pro se refleja sin recargar.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly firebase = inject(FirebaseService);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /** true si el usuario tiene acceso Pro activo */
  readonly isPro = signal(false);

  /** true mientras se resuelve el estado inicial */
  readonly loading = signal(true);

  private unsubscribe: (() => void) | null = null;

  constructor() {
    if (!this.isBrowser) {
      this.loading.set(false);
      return;
    }

    // Cuando cambia el usuario, (re)suscribirse a su documento
    effect(() => {
      const user = this.authService.user();
      this.stopWatching();

      if (user) {
        this.watchPro(user.uid);
      } else {
        this.isPro.set(false);
        this.loading.set(false);
      }
    });
  }

  private async watchPro(uid: string): Promise<void> {
    await this.firebase.initialize();
    const firestore = this.firebase.firestore;
    if (!firestore) {
      this.loading.set(false);
      return;
    }

    try {
      const { doc, onSnapshot } = await import('firebase/firestore');
      const ref = doc(firestore, 'users', uid);

      this.unsubscribe = onSnapshot(
        ref,
        (snapshot: any) => {
          const data = snapshot.data();
          this.isPro.set(data?.pro === true);
          this.loading.set(false);
        },
        () => {
          // Ante error de lectura, asumir no-Pro (fail closed)
          this.isPro.set(false);
          this.loading.set(false);
        },
      );
    } catch {
      this.isPro.set(false);
      this.loading.set(false);
    }
  }

  private stopWatching(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
