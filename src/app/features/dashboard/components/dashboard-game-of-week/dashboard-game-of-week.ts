import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { ScoreService } from '../../../../core/services/api/score.service';
import { Game } from '../../../../shared/models/domain/game.model';
import { formatMexicoGameDateTime } from '../../../../shared/utils/mexico-date-time.util';

@Component({
  selector: 'app-dashboard-game-of-week',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './dashboard-game-of-week.html',
  styleUrl: './dashboard-game-of-week.scss',
})
export class DashboardGameOfWeekComponent implements OnInit {
  private readonly scoreService = inject(ScoreService);
  private readonly router = inject(Router);

  readonly games = signal<Game[]>([]);

  /**
   * Selecciona el "juego de la semana": el próximo partido más atractivo.
   * Prioriza: partidos en vivo > próximos con ambos equipos con buen récord.
   */
  readonly gameOfWeek = computed<Game | null>(() => {
    const games = this.games();
    if (games.length === 0) return null;

    // Prioridad 1: partido en vivo
    const live = games.filter(g => g.statusState === 'in');
    if (live.length > 0) {
      return live.sort((a, b) => this.excitement(b) - this.excitement(a))[0];
    }

    // Prioridad 2: próximo partido más atractivo
    const upcoming = games
      .filter(g => g.statusState === 'pre')
      .sort((a, b) => {
        const timeA = Date.parse(a.startTime) || 0;
        const timeB = Date.parse(b.startTime) || 0;
        // Primero por cercanía, luego por atractivo
        if (Math.abs(timeA - timeB) > 6 * 60 * 60 * 1000) {
          return timeA - timeB;
        }
        return this.excitement(b) - this.excitement(a);
      });

    return upcoming[0] ?? null;
  });

  ngOnInit(): void {
    this.scoreService.getScoreboard().subscribe({
      next: games => this.games.set(games),
    });
  }

  /**
   * Puntúa qué tan atractivo es un partido según el récord combinado
   * de ambos equipos (más victorias = más atractivo).
   */
  private excitement(game: Game): number {
    const parseWins = (record: string): number => {
      const wins = parseInt(record.split('-')[0], 10);
      return Number.isNaN(wins) ? 0 : wins;
    };
    return parseWins(game.homeRecord) + parseWins(game.awayRecord);
  }

  gameDateTime(game: Game): string {
    return formatMexicoGameDateTime(game.startTime);
  }

  isLive(game: Game): boolean {
    return game.statusState === 'in';
  }

  openGame(game: Game): void {
    this.router.navigate(['/scores', game.id]);
  }
}
