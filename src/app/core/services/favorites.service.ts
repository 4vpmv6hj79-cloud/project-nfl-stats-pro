import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';

export interface FavoriteTeam {
  id: number;
  name: string;
  abbreviation: string;
  logo: string;
}

const STORAGE_KEY = 'nfl-favorites';

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly firebase = inject(FirebaseService);
  private readonly authService = inject(AuthService);

  readonly favorites = signal<FavoriteTeam[]>(this.loadLocal());

  private syncing = false;

  constructor() {
    // Cuando el usuario se autentique, sincronizar con Firestore
    effect(() => {
      const user = this.authService.user();

      if (user && this.isBrowser) {
        this.syncFromFirestore(user.uid);
      }
    });
  }

  toggle(team: FavoriteTeam): void {
    const current = this.favorites();
    const exists = current.some(t => t.id === team.id);

    if (exists) {
      this.favorites.set(current.filter(t => t.id !== team.id));
    } else {
      this.favorites.set([...current, team]);
    }

    this.saveLocal();
    this.saveToFirestore();
  }

  isFavorite(teamId: number): boolean {
    return this.favorites().some(t => t.id === teamId);
  }

  isFavoriteByAbbr(abbr: string): boolean {
    if (!abbr) return false;
    return this.favorites().some(
      t => t.abbreviation.toUpperCase() === abbr.toUpperCase()
    );
  }

  // ── Local Storage ─────────────────────────────────────────

  private saveLocal(): void {
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favorites()));
    }
  }

  private loadLocal(): FavoriteTeam[] {
    if (!this.isBrowser) {
      return [];
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // ── Firestore Sync ────────────────────────────────────────

  /**
   * Al iniciar sesión, descarga favoritos de Firestore.
   * Si el usuario tiene favoritos en la nube, los usa.
   * Si tiene favoritos locales pero no en la nube, sube los locales.
   */
  private async syncFromFirestore(uid: string): Promise<void> {
    const firestore = this.firebase.firestore;
    if (!firestore || this.syncing) return;

    this.syncing = true;

    try {
      const docRef = doc(firestore, 'users', uid);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        const cloudFavorites: FavoriteTeam[] = data['favorites'] ?? [];

        if (cloudFavorites.length > 0) {
          // La nube tiene datos — usar esos (merge con locales)
          const merged = this.mergeFavorites(this.favorites(), cloudFavorites);
          this.favorites.set(merged);
          this.saveLocal();

          // Si hubo merge, guardar el resultado en la nube
          if (merged.length !== cloudFavorites.length) {
            await this.saveToFirestoreInternal(uid, merged);
          }
        } else {
          // La nube está vacía — subir los locales
          const local = this.favorites();
          if (local.length > 0) {
            await this.saveToFirestoreInternal(uid, local);
          }
        }
      } else {
        // No existe documento — crear con los favoritos locales
        const local = this.favorites();
        await this.saveToFirestoreInternal(uid, local);
      }
    } catch (e) {
      console.error('Error syncing favorites:', e);
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Guarda los favoritos actuales en Firestore (si hay usuario autenticado).
   */
  private async saveToFirestore(): Promise<void> {
    const user = this.authService.user();
    if (!user) return;

    await this.saveToFirestoreInternal(user.uid, this.favorites());
  }

  private async saveToFirestoreInternal(uid: string, favorites: FavoriteTeam[]): Promise<void> {
    const firestore = this.firebase.firestore;
    if (!firestore) return;

    try {
      const docRef = doc(firestore, 'users', uid);
      await setDoc(docRef, { favorites }, { merge: true });
    } catch (e) {
      console.error('Error saving favorites to Firestore:', e);
    }
  }

  /**
   * Merge favoritos locales con los de la nube (sin duplicados por id).
   */
  private mergeFavorites(local: FavoriteTeam[], cloud: FavoriteTeam[]): FavoriteTeam[] {
    const merged = new Map<number, FavoriteTeam>();

    for (const t of cloud) {
      merged.set(t.id, t);
    }
    for (const t of local) {
      merged.set(t.id, t);
    }

    return Array.from(merged.values());
  }
}
