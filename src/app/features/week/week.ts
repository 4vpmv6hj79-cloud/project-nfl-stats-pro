import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, interval, startWith, switchMap } from 'rxjs';

import { ScoreService } from '../../core/services/api/score.service';
import { Game } from '../../shared/models/domain/game.model';
import {
  formatMexicoDayLabel,
  formatMexicoTime,
  mexicoDayKey,
} from '../../shared/utils/mexico-date-time.util';

interface DayGroup {
  key: string;
  label: string;
  timestamp: number;
  games: Game[];
}

const REFRESH_MS = 30_000;

@Component({
  selector: 'app-week',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './week.html',
  styleUrl: './week.scss',
})
export class WeekComponent implements OnInit, OnDestroy {
  private readonly scoreService = inject(ScoreService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private sub: Subscription | null = null;

  readonly games = signal<Game[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  /**
   * Partidos visibles. Si ya hay temporada regular/postemporada en la
   * respuesta, ocultamos la pretemporada para no mezclar exhibiciones.
   */
  readonly visibleGames = computed<Game[]>(() => {
    const games = this.games();
    const hasRegularOrPlayoffs = games.some(
      (g) => g.seasonType === 'regular' || g.seasonType === 'postseason',
    );

    return hasRegularOrPlayoffs
      ? games.filter((g) => g.seasonType !== 'preseason')
      : games;
  });

  /** Partidos agrupados por día (jueves, domingo, lunes...) */
  readonly dayGroups = computed<DayGroup[]>(() => {
    const games = this.visibleGames();
    const groups = new Map<string, DayGroup>();

    for (const game of games) {
      const key = mexicoDayKey(game.startTime);
      const existing = groups.get(key);

      if (existing) {
        existing.games.push(game);
      } else {
        groups.set(key, {
          key,
          label: formatMexicoDayLabel(game.startTime),
          timestamp: Date.parse(game.startTime) || 0,
          games: [game],
        });
      }
    }

    // Ordenar días cronológicamente y juegos dentro de cada día
    const result = Array.from(groups.values());
    result.sort((a, b) => a.timestamp - b.timestamp);
    for (const group of result) {
      group.games.sort(
        (a, b) => (Date.parse(a.startTime) || 0) - (Date.parse(b.startTime) || 0)
      );
    }

    return result;
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.sub = interval(REFRESH_MS)
        .pipe(
          startWith(0),
          switchMap(() => this.scoreService.getScoreboard()),
        )
        .subscribe({
          next: games => {
            this.games.set(games);
            this.loading.set(false);
          },
          error: () => {
            this.error.set(true);
            this.loading.set(false);
          },
        });
    } else {
      this.scoreService.getScoreboard().subscribe({
        next: games => {
          this.games.set(games);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  isLive(game: Game): boolean {
    return game.statusState === 'in';
  }

  isFinal(game: Game): boolean {
    return game.statusState === 'post';
  }

  gameTime(game: Game): string {
    return formatMexicoTime(game.startTime);
  }

  openGame(game: Game): void {
    this.router.navigate(['/scores', game.id]);
  }
}
