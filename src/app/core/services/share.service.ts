import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AnalyticsService } from './analytics.service';

export interface ShareContent {
  title: string;
  text: string;
  url?: string;
}

@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly analytics = inject(AnalyticsService);

  /** Se activa brevemente cuando se copia al portapapeles (para feedback UI) */
  readonly copied = signal(false);

  /**
   * Comparte contenido usando la Web Share API nativa.
   * Si no está disponible, copia el texto+URL al portapapeles.
   */
  async share(content: ShareContent): Promise<void> {
    if (!this.isBrowser) return;

    this.analytics.logEvent('share', { title: content.title });

    const url = content.url ?? (typeof window !== 'undefined' ? window.location.href : '');

    // Web Share API (móviles y algunos navegadores desktop)
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as any).share({
          title: content.title,
          text: content.text,
          url,
        });
        return;
      } catch {
        // Usuario canceló o falló; intentar copiar como fallback
      }
    }

    // Fallback: copiar al portapapeles
    await this.copyToClipboard(`${content.text}\n${url}`);
  }

  private async copyToClipboard(text: string): Promise<void> {
    if (!this.isBrowser) return;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback legacy
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Silenciar
    }
  }

  get canShare(): boolean {
    return this.isBrowser;
  }
}
