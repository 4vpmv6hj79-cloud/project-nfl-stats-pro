import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { NotificationService } from './api/notification.service';
import { AnalyticsService } from './analytics.service';

export interface ShareContent {
  title?: string;
  text?: string;
  url?: string;
}

/**
 * Servicio para compartir contenido de la app.
 *
 * Usa la Web Share API nativa cuando está disponible (abre el menú de
 * compartir del sistema: WhatsApp, Instagram, Telegram, etc., ideal en
 * móvil). Si no está disponible (muchos navegadores de escritorio),
 * copia el enlace al portapapeles como alternativa.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly notification = inject(NotificationService);
  private readonly analytics = inject(AnalyticsService);

  /**
   * true durante unos segundos después de compartir/copiar, para que la
   * UI pueda mostrar un ícono de confirmación (ej. un check).
   */
  readonly copied = signal(false);

  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  private flagCopied(): void {
    this.copied.set(true);
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(false), 2500);
  }

  /**
   * Comparte el contenido dado. Devuelve true si se compartió o copió,
   * false si el usuario canceló o hubo un error.
   */
  async share(content: ShareContent): Promise<boolean> {
    if (!this.isBrowser) return false;

    const data: ShareContent = {
      title: content.title ?? 'Centro NFL',
      text: content.text ?? 'Sigue la NFL en español: marcadores en vivo, standings y más.',
      url: content.url ?? window.location.href,
    };

    // 1) Web Share API nativa (móvil y algunos navegadores modernos)
    const nav = navigator as Navigator & {
      share?: (data: ShareContent) => Promise<void>;
    };

    if (typeof nav.share === 'function') {
      try {
        await nav.share(data);
        this.flagCopied();
        this.analytics.logEvent('share', { method: 'web_share' });
        return true;
      } catch (err: any) {
        // El usuario canceló el diálogo: no es un error que mostrar
        if (err?.name === 'AbortError') return false;
        // Si falla por otra razón, caemos al método de copiar
      }
    }

    // 2) Fallback: copiar el enlace al portapapeles
    return this.copyLink(data.url ?? window.location.href);
  }

  /** Copia un enlace al portapapeles y avisa al usuario */
  private async copyLink(url: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback muy antiguo
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }

      this.flagCopied();
      this.notification.success('¡Enlace copiado! Ya puedes compartirlo.');
      this.analytics.logEvent('share', { method: 'copy_link' });
      return true;
    } catch {
      this.notification.error('No se pudo compartir. Copia el enlace manualmente.');
      return false;
    }
  }
}
