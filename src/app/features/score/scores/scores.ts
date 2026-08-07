import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { NotificationService } from '../../../core/services/api/notification.service';
import { ScoreService } from '../../../core/services/api/score.service';
import { LoadingSpinnerComponent } from '../../../shared/feedback/loading-spinner/loading-spinner';
import { Game } from '../../../shared/models/domain/game.model';

type GameStatusFilter = 'all' | 'live' | 'final' | 'upcoming';

@Component({
  selector: 'app-scores',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonToggleModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './scores.html',
  styleUrl: './scores.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Scores implements OnInit {
  private readonly scoreService = inject(ScoreService);
  private readonly notification = inject(NotificationService);

  readonly games = signal<Game[]>([]);
  readonly filter = signal<GameStatusFilter>('all');
  readonly loading = signal(true);

  readonly hasPreseasonGames = computed(() =>
    this.games().some((game) => game.seasonType === 'preseason'),
  );

  readonly filtered = computed(() => {
    const games = this.games();
    const filter = this.filter();

    if (filter === 'all') {
      return games;
    }

    return games.filter((game) => {
      const status = game.status.toLowerCase();

      if (filter === 'live') {
        return (
          status.includes('q') ||
          status.includes('half') ||
          status.includes('ot')
        );
      }

      if (filter === 'final') {
        return status.includes('final');
      }

      if (filter === 'upcoming') {
        return (
          status.includes('am') ||
          status.includes('pm') ||
          status.includes(':')
        );
      }

      return true;
    });
  });

  ngOnInit(): void {
    this.scoreService.getScoreboardWindow().subscribe({
      next: (games: Game[]) => {
        this.games.set(games);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error(
          'No fue posible cargar los marcadores.',
        );
      },
    });
  }

  onFilterChange(value: GameStatusFilter): void {
    this.filter.set(value);
  }

  seasonLabel(game: Game): string {
    switch (game.seasonType) {
      case 'preseason':
        return 'Pretemporada';
      case 'regular':
        return 'Temporada regular';
      case 'postseason':
        return 'Postemporada';
      case 'offseason':
        return 'Fuera de temporada';
      default:
        return 'Temporada';
    }
  }

  recordLabel(game: Game): string {
    switch (game.seasonType) {
      case 'preseason':
        return 'Récord de pretemporada';
      case 'regular':
        return 'Récord de temporada regular';
      case 'postseason':
        return 'Récord de postemporada';
      default:
        return 'Récord';
    }
  }

  isHomeWinning(game: Game): boolean {
    return game.homeScore > game.awayScore;
  }

  isAwayWinning(game: Game): boolean {
    return game.awayScore > game.homeScore;
  }
}
