import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  Subscription,
  interval,
  startWith,
  switchMap,
} from 'rxjs';

import { ScoreService } from '../../../../core/services/api/score.service';
import { Game } from '../../../../shared/models/domain/game.model';
import {
  differenceInMexicoCalendarDays,
  formatMexicoGameDateTime,
  formatMexicoTime,
} from '../../../../shared/utils/mexico-date-time.util';
import { fadeIn } from '../../../../shared/animations/animations';

const REFRESH_MS = 30_000;
const UPCOMING_GAME_LIMIT = 16;
const FINAL_GAME_LIMIT = 5;

@Component({
  selector: 'app-dashboard-scoreboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-scoreboard.html',
  styleUrl: './dashboard-scoreboard.scss',
  animations: [fadeIn],
})
export class DashboardScoreboardComponent
  implements OnInit, OnDestroy
{
  private readonly router = inject(Router);
  private readonly scoreService = inject(ScoreService);

  readonly games = signal<Game[]>([]);
  readonly loading = signal(true);
  readonly lastUpdated = signal<Date | null>(null);

  private sub!: Subscription;

  readonly liveGames = computed(() =>
    this.games().filter(
      (game) => game.statusState === 'in',
    ),
  );

  readonly finalGames = computed(() =>
    this.games()
      .filter((game) => game.statusState === 'post')
      .sort(
        (first, second) =>
          this.gameTimestamp(second) -
          this.gameTimestamp(first),
      ),
  );

  readonly upcomingGames = computed(() =>
    this.games()
      .filter((game) => game.statusState === 'pre')
      .sort(
        (first, second) =>
          this.gameTimestamp(first) -
          this.gameTimestamp(second),
      ),
  );

  readonly upcomingGamesToDisplay = computed(() => {
    const now = new Date();

    return this.upcomingGames()
      .filter((game) => {
        const calendarDaysUntilStart =
          differenceInMexicoCalendarDays(
            game.startTime,
            now,
          );

        return (
          calendarDaysUntilStart !== null &&
          calendarDaysUntilStart >= 0 &&
          calendarDaysUntilStart <= 1
        );
      })
      .slice(0, UPCOMING_GAME_LIMIT);
  });

  readonly finalGamesToDisplay = computed(() => {
    if (this.upcomingGamesToDisplay().length > 0) {
      return [];
    }

    return this.finalGames().slice(
      0,
      FINAL_GAME_LIMIT,
    );
  });

  readonly hasVisibleGames = computed(
    () =>
      this.liveGames().length > 0 ||
      this.finalGamesToDisplay().length > 0 ||
      this.upcomingGamesToDisplay().length > 0,
  );

  ngOnInit(): void {
    this.sub = interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.scoreService.getScoreboardWindow(7, 7),
        ),
      )
      .subscribe({
        next: (games: Game[]) => {
          this.games.set(games);
          this.loading.set(false);
          this.lastUpdated.set(new Date());
        },
        error: () => {
          this.loading.set(false);
        },
      });
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

  formatTime(date: Date | null): string {
    return formatMexicoTime(date);
  }

  formatGameStart(startTime: string): string {
    return formatMexicoGameDateTime(startTime);
  }

  isWinning(
    scoreA: number,
    scoreB: number,
  ): boolean {
    return scoreA > scoreB;
  }

  openGame(game: Game): void {
    this.router.navigate(['/scores', game.id]);
  }

  private gameTimestamp(game: Game): number {
    const timestamp = Date.parse(game.startTime);

    return Number.isNaN(timestamp)
      ? 0
      : timestamp;
  }
}
