import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

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

  readonly favorites = signal<FavoriteTeam[]>(this.load());

  toggle(team: FavoriteTeam): void {
    const current = this.favorites();
    const exists = current.some(t => t.id === team.id);

    if (exists) {
      this.favorites.set(current.filter(t => t.id !== team.id));
    } else {
      this.favorites.set([...current, team]);
    }

    this.save();
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

  private save(): void {
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favorites()));
    }
  }

  private load(): FavoriteTeam[] {
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
}
