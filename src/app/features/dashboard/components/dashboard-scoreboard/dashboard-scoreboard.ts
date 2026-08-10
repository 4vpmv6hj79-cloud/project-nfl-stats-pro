import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription, startWith, switchMap } from 'rxjs';

import { ScoreService } from '../../../../core/services/api/score.service';
import { Game } from '../../../../shared/models/domain/game.model';
import {
  formatMexicoGameDateTime,
  formatMexicoTime,
} from '../../../../shared/utils/mexico-date-time.util';

const REFRESH_MS = 30_000;

@Component({
  selector: 'app-dashboard-scoreboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-scoreboard.html',
  styleUrl: './dashboard-scoreboard.scss',
})
export class DashboardScoreboardComponent implements OnInit, OnDestroy {

  private scoreService = inject(ScoreService);

  games       = signal<Game[]>([]);
  loading     = signal(true);
  lastUpdated = signal<Date | null>(null);

  private sub!: Subscription;

  liveGames = computed(() =>
    this.games().filter(g => this.isLive(g.status))
  );

  finalGames = computed(() =>
    this.games().filter(g => this.isFinal(g.status))
  );

  upcomingGames = computed(() =>
    this.games().filter(g => !this.isLive(g.status) && !this.isFinal(g.status))
  );

  ngOnInit(): void {
    this.sub = interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.scoreService.getScoreboard())
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

  isLive(status: string): boolean {
    const normalizedStatus = status
      .trim()
      .toLowerCase();

    const isScheduledTime =
      normalizedStatus.includes(' am') ||
      normalizedStatus.includes(' pm') ||
      normalizedStatus.includes('a.m.') ||
      normalizedStatus.includes('p.m.');

    if (isScheduledTime) {
      return false;
    }

    return (
      normalizedStatus.includes('half') ||
      normalizedStatus.includes('ot') ||
      /\bq[1-4]\b/.test(normalizedStatus) ||
      /^\d{1,2}:\d{2}\s*-\s*(1st|2nd|3rd|4th)/.test(
        normalizedStatus
      )
    );
  }

  isFinal(status: string): boolean {
    return status.toLowerCase().includes('final');
  }

  formatTime(date: Date | null): string {
    return formatMexicoTime(date);
  }

  formatGameStart(startTime: string): string {
    return formatMexicoGameDateTime(startTime);
  }

  isWinning(scoreA: number, scoreB: number): boolean {
    return scoreA > scoreB;
  }

}
