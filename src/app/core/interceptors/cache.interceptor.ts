import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';

interface CacheEntry {
  response: HttpResponse<unknown>;
  expiresAt: number;
}

/**
 * TTL por tipo de endpoint (en milisegundos).
 * Los marcadores en vivo se refrescan frecuentemente, así que tienen TTL corto.
 * Los equipos y standings cambian poco, TTL más largo.
 */
const TTL_MAP: Record<string, number> = {
  '/scoreboard': 15_000,         // 15 segundos para marcadores
  '/news': 120_000,              // 2 minutos para noticias
  '/teams': 300_000,             // 5 minutos para equipos
  '/standings': 300_000,         // 5 minutos para standings
  '/roster': 600_000,            // 10 minutos para rosters
  '/schedule': 300_000,          // 5 minutos para calendario
};

const DEFAULT_TTL = 60_000; // 1 minuto por defecto

@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cache = new Map<string, CacheEntry>();

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Solo cachear GETs en el browser
    if (req.method !== 'GET' || !isPlatformBrowser(this.platformId)) {
      return next.handle(req);
    }

    // Solo cachear nuestras llamadas a la API
    if (!req.url.includes('/api/')) {
      return next.handle(req);
    }

    const cacheKey = req.urlWithParams;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.response.clone());
    }

    // Si está expirado, eliminar
    if (cached) {
      this.cache.delete(cacheKey);
    }

    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse && event.status === 200) {
          const ttl = this.getTtl(req.url);
          this.cache.set(cacheKey, {
            response: event.clone(),
            expiresAt: Date.now() + ttl,
          });

          // Limpiar entradas viejas si el cache crece mucho
          if (this.cache.size > 50) {
            this.pruneExpired();
          }
        }
      })
    );
  }

  private getTtl(url: string): number {
    for (const [pattern, ttl] of Object.entries(TTL_MAP)) {
      if (url.includes(pattern)) {
        return ttl;
      }
    }
    return DEFAULT_TTL;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}
