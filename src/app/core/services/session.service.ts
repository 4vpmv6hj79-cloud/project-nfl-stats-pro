import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { FirebaseService } from './firebase.service';

/**
 * Servicio que garantiza UNA sola sesión activa por usuario.
 *
 * Estrategia:
 * - Al iniciar sesión se genera un sessionId único y se guarda en
 *   Firestore (users/{uid}.activeSessionId).
 * - Cada dispositivo escucha ese campo. Si el sessionId en Firestore
 *   deja de coincidir con el local (porque alguien más inició sesión),
 *   se dispara onSessionInvalidated para cerrar la sesión aquí.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly firebase = inject(FirebaseService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /** sessionId de ESTE dispositivo */
  private currentSessionId: string | null = null;

  /** Función para cancelar el listener de Firestore */
  private unsubscribe: (() => void) | null = null;

  /** Se activa cuando la sesión fue invalidada por otro inicio de sesión */
  readonly invalidated = signal(false);

  /**
   * Registra esta sesión como la activa para el usuario.
   * Sobrescribe cualquier sesión previa en otros dispositivos.
   */
  async registerSession(uid: string): Promise<void> {
    if (!this.isBrowser) return;

    await this.firebase.initialize();
    const firestore = this.firebase.firestore;
    if (!firestore) return;

    this.currentSessionId = this.generateSessionId();
    this.invalidated.set(false);

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const ref = doc(firestore, 'users', uid);
      await setDoc(
        ref,
        {
          activeSessionId: this.currentSessionId,
          lastLoginAt: Date.now(),
        },
        { merge: true },
      );

      this.watchSession(uid);
    } catch {
      // Si falla, no bloqueamos el login; solo no habrá control de sesión única
    }
  }

  /**
   * Al reabrir la app con una sesión persistida, adopta el sessionId
   * que ya está en Firestore como el propio y empieza a vigilarlo.
   * No lo sobrescribe (eso solo pasa en un login/register explícito),
   * así no invalida otras sesiones al simplemente abrir la app.
   */
  async watchExisting(uid: string): Promise<void> {
    if (!this.isBrowser) return;

    await this.firebase.initialize();
    const firestore = this.firebase.firestore;
    if (!firestore) return;

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const ref = doc(firestore, 'users', uid);
      const snap = await getDoc(ref);
      const data = snap.data();

      // Adoptar el sessionId existente como el nuestro
      this.currentSessionId = data?.['activeSessionId'] ?? this.generateSessionId();
      this.invalidated.set(false);

      this.watchSession(uid);
    } catch {
      // Silenciar
    }
  }

  /**
   * Escucha cambios en el activeSessionId. Si cambia y ya no coincide
   * con el de este dispositivo, marca la sesión como invalidada.
   */
  private async watchSession(uid: string): Promise<void> {
    const firestore = this.firebase.firestore;
    if (!firestore) return;

    this.stopWatching();

    try {
      const { doc, onSnapshot } = await import('firebase/firestore');
      const ref = doc(firestore, 'users', uid);

      this.unsubscribe = onSnapshot(ref, (snapshot: any) => {
        const data = snapshot.data();
        if (!data) return;

        const remoteSessionId = data.activeSessionId;

        // Si hay un sessionId remoto y NO coincide con el nuestro,
        // significa que alguien más inició sesión: invalidamos esta.
        if (
          remoteSessionId &&
          this.currentSessionId &&
          remoteSessionId !== this.currentSessionId
        ) {
          this.invalidated.set(true);
          this.stopWatching();
        }
      });
    } catch {
      // Silenciar
    }
  }

  /** Detiene la vigilancia (al cerrar sesión) */
  stopWatching(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /** Limpia el estado al cerrar sesión */
  clear(): void {
    this.stopWatching();
    this.currentSessionId = null;
    this.invalidated.set(false);
  }

  private generateSessionId(): string {
    // ID aleatorio suficientemente único para distinguir dispositivos
    return (
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 10)
    );
  }
}
