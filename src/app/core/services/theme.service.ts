import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'nfl-theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly mode = signal<ThemeMode>(this.getInitialTheme());

  constructor() {
    effect(() => {
      const theme = this.mode();

      if (this.isBrowser) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
      }
    });
  }

  toggle(): void {
    this.mode.update(current => current === 'dark' ? 'light' : 'dark');
  }

  private getInitialTheme(): ThemeMode {
    if (!this.isBrowser) {
      return 'dark';
    }

    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;

    if (stored === 'dark' || stored === 'light') {
      return stored;
    }

    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
}
