import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { ScoreService } from '../../../core/services/api/score.service';
import { NotificationService } from '../../../core/services/api/notification.service';
import { LoadingSpinnerComponent } from '../../../shared/feedback/loading-spinner/loading-spinner';
import { Game } from '../../../shared/models/domain/game.model';

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
})
export class Scores implements OnInit {

  private scoreService   = inject(ScoreService);
  private notification   = inject(NotificationService);

  games   = signal<Game[]>([]);
  filter  = signal<'all' | 'live' | 'final' | 'upcoming'>('all');
  loading = signal(true);

  filtered = computed(() => {

    const all = this.games();
    const f   = this.filter();

    if (f === 'all') return all;

    return all.filter(game => {
      const s = game.status.toLowerCase();
      if (f === 'live')     return s.includes('q') || s.includes('half') || s.includes('ot');
      if (f === 'final')    return s.includes('final');
      if (f === 'upcoming') return s.includes('am') || s.includes('pm') || s.includes(':');
      return true;
    });

  });

  ngOnInit(): void {

    this.scoreService.getScoreboard().subscribe({

      next: (games: Game[]) => {
        this.games.set(games);
        this.loading.set(false);
      },

      error: () => {
        this.loading.set(false);
        this.notification.error('No fue posible cargar los marcadores.');
      }

    });

  }

  onFilterChange(value: 'all' | 'live' | 'final' | 'upcoming'): void {
    this.filter.set(value);
  }

  isHomeWinning(game: Game): boolean {
    return game.homeScore > game.awayScore;
  }

  isAwayWinning(game: Game): boolean {
    return game.awayScore > game.homeScore;
  }

}
