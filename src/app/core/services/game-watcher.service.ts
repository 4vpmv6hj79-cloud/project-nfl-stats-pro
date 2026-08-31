import { Injectable, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription, interval, startWith, switchMap } from 'rxjs';

import { ScoreService } from './api/score.service';
import { FavoritesService } from './favorites.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { Game } from '../../shared/models/domain/game.model';

interface GameSnapshot {
  statusState: string;
  homeScore: number;
  awayScore: number;
  isRedZone: boolean;
}

const WATCH_INTERVAL_MS = 30_000;

/**
 * Vigila los partidos de los equipos favoritos y dispara
 * notificaciones locales cuando ocurren eventos relevantes.
 * Solo funciona mientras la app está abierta.
 */
@Injectable({ providedIn: 'root' })
export class GameWatcherService implements OnDestroy {
  private readonly scoreService = inject(ScoreService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly notifications = inject(NotificationPreferencesService);
  private readonly platformId = inject(PLATFORM_ID);

  private sub: Subscription | null = null;
  private snapshots = new Map<string, GameSnapshot>();
  private started = false;

  /** Inicia la vigilancia de partidos (llamar una vez tras dar permiso) */
  start(): void {
    if (this.started || !isPlatformBrowser(this.platformId)) return;
    this.started = true;

    this.sub = interval(WATCH_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.scoreService.getScoreboardWindow(1, 1)),
      )
      .subscribe({
        next: games => this.processGames(games),
      });
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = null;
    this.started = false;
    this.snapshots.clear();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private processGames(games: Game[]): void {
    const favorites = this.favoritesService.favorites();
    if (favorites.length === 0) return;

    const favAbbrs = new Set(
      favorites.map(f => f.abbreviation.toUpperCase())
    );

    const prefs = this.notifications.preferences();

    for (const game of games) {
      // Solo partidos que involucran a un equipo favorito
      const involvesFav = this.gameInvolvesFavorite(game, favAbbrs);
      if (!involvesFav) continue;

      const prev = this.snapshots.get(game.id);
      const current: GameSnapshot = {
        statusState: game.statusState,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        isRedZone: game.isRedZone ?? false,
      };

      if (prev) {
        this.detectEvents(game, prev, current, prefs);
      }

      this.snapshots.set(game.id, current);
    }
  }

  private detectEvents(
    game: Game,
    prev: GameSnapshot,
    current: GameSnapshot,
    prefs: ReturnType<NotificationPreferencesService['preferences']>,
  ): void {
    const matchup = `${game.awayTeam} vs ${game.homeTeam}`;

    // Inicio del partido (pre -> in)
    if (prefs.gameStart && prev.statusState === 'pre' && current.statusState === 'in') {
      this.notifications.notify('🏈 ¡Comenzó el partido!', {
        body: matchup,
        tag: `start-${game.id}`,
      });
    }

    // Touchdown (aumento de 6 o 7 puntos)
    if (prefs.touchdowns && current.statusState === 'in') {
      const homeDiff = current.homeScore - prev.homeScore;
      const awayDiff = current.awayScore - prev.awayScore;

      if (homeDiff === 6 || homeDiff === 7 || homeDiff === 8) {
        this.notifications.notify('🏈 ¡Touchdown!', {
          body: `${game.homeTeam} anota · ${game.awayTeam} ${current.awayScore} - ${current.homeScore} ${game.homeTeam}`,
          tag: `td-${game.id}-${current.homeScore}`,
        });
      } else if (awayDiff === 6 || awayDiff === 7 || awayDiff === 8) {
        this.notifications.notify('🏈 ¡Touchdown!', {
          body: `${game.awayTeam} anota · ${game.awayTeam} ${current.awayScore} - ${current.homeScore} ${game.homeTeam}`,
          tag: `td-${game.id}-${current.awayScore}`,
        });
      }
    }

    // Resultado final (in -> post)
    if (prefs.finalScore && prev.statusState === 'in' && current.statusState === 'post') {
      const winner = current.homeScore > current.awayScore ? game.homeTeam : game.awayTeam;
      this.notifications.notify('🏁 Final del partido', {
        body: `${matchup} · Final: ${current.awayScore}-${current.homeScore}. Ganó ${winner}.`,
        tag: `final-${game.id}`,
      });
    }

    // Zona roja (entró a red zone)
    if (prefs.redZone && current.statusState === 'in' && !prev.isRedZone && current.isRedZone) {
      this.notifications.notify('🎯 Zona Roja', {
        body: `${matchup} · Un equipo está en zona roja.`,
        tag: `redzone-${game.id}`,
      });
    }
  }

  private gameInvolvesFavorite(game: Game, favAbbrs: Set<string>): boolean {
    const homeWords = game.homeTeam.toLowerCase();
    const awayWords = game.awayTeam.toLowerCase();

    for (const abbr of favAbbrs) {
      // No tenemos abbr directo en Game, comparamos por nombre parcial
      if (homeWords.includes(abbr.toLowerCase()) || awayWords.includes(abbr.toLowerCase())) {
        return true;
      }
    }

    // Fallback: comparar por nombre completo del favorito
    const favorites = this.favoritesService.favorites();
    for (const fav of favorites) {
      const favLast = fav.name.toLowerCase().split(' ').pop() ?? '';
      if (homeWords.includes(favLast) || awayWords.includes(favLast)) {
        return true;
      }
    }

    return false;
  }
}
