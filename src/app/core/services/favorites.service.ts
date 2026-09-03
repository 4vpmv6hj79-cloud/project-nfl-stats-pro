import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { AnalyticsService } from './analytics.service';

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
  private readonly analytics = inject(AnalyticsService);

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
      this.analytics.logEvent('remove_favorite', { team: team.abbreviation });
    } else {
      this.favorites.set([...current, team]);
      this.analytics.logEvent('add_favorite', { team: team.abbreviation });
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
      const { doc, getDoc } = await import('firebase/firestore');
      const docRef = doc(firestore, 'users', uid);
      const snapshot = await getDoc(docRef);

      // IMPORTANTE: releer el estado local AQUÍ, después del await del getDoc,
      // para no perder favoritos que el usuario haya agregado mientras la
      // lectura de red estaba en vuelo (p. ej. al terminar el onboarding).
      const localNow = this.favorites();
      const cloudFavorites: FavoriteTeam[] = snapshot.exists()
        ? (snapshot.data()['favorites'] ?? [])
        : [];

      // Siempre unir nube + local (sin duplicados). Nunca sobreescribir con
      // un snapshot que podría estar desactualizado respecto al signal local.
      const merged = this.mergeFavorites(localNow, cloudFavorites);

      // Actualizar el signal solo si el resultado difiere del estado actual,
      // para evitar renders innecesarios.
      if (!this.sameFavorites(localNow, merged)) {
        this.favorites.set(merged);
        this.saveLocal();
      }

      // Sincronizar la nube si difiere del merge (o si el doc no existía).
      if (!snapshot.exists() || !this.sameFavorites(cloudFavorites, merged)) {
        await this.saveToFirestoreInternal(uid, merged);
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
      const { doc, setDoc } = await import('firebase/firestore');
      const docRef = doc(firestore, 'users', uid);
      await setDoc(docRef, { favorites }, { merge: true });
    } catch (e) {
      console.error('Error saving favorites to Firestore:', e);
    }
  }

  /**
   * Compara dos listas de favoritos por el conjunto de ids (ignora orden).
   */
  private sameFavorites(a: FavoriteTeam[], b: FavoriteTeam[]): boolean {
    if (a.length !== b.length) return false;
    const idsA = new Set(a.map(t => t.id));
    return b.every(t => idsA.has(t.id));
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
