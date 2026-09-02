import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'nfl-onboarding-done';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /** true si se debe mostrar el onboarding (usuario nuevo) */
  readonly showOnboarding = signal(false);

  /** Verifica si el usuario ya completó el onboarding */
  checkOnboarding(): void {
    if (!this.isBrowser) return;

    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      this.showOnboarding.set(true);
    }
  }

  /** Marca el onboarding como completado */
  complete(): void {
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    this.showOnboarding.set(false);
  }

  /** Permite reabrir el onboarding manualmente */
  reopen(): void {
    this.showOnboarding.set(true);
  }
}
