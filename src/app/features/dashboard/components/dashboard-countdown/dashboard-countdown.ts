import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { ScoreService } from '../../../../core/services/api/score.service';
import { FavoritesService, FavoriteTeam } from '../../../../core/services/favorites.service';
import { Game } from '../../../../shared/models/domain/game.model';

export interface CountdownData {
  game: Game;
  teamName: string;
  teamLogo: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

@Component({
  selector: 'app-dashboard-countdown',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './dashboard-countdown.html',
  styleUrl: './dashboard-countdown.scss',
})
export class DashboardCountdownComponent implements OnInit, OnDestroy {
  private readonly scoreService = inject(ScoreService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly platformId = inject(PLATFORM_ID);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly upcomingGames = signal<Game[]>([]);
  readonly now = signal(new Date());

  /** Lista de countdowns para TODOS los equipos favoritos, ordenados del más cercano al más lejano */
  readonly countdowns = computed<CountdownData[]>(() => {
    const favorites = this.favoritesService.favorites();

    if (favorites.length === 0) {
      return [];
    }

    const games = this.upcomingGames();
    const currentTime = this.now();

    const upcoming = games.filter(g => g.statusState === 'pre');

    const results: CountdownData[] = [];

    for (const fav of favorites) {
      // Buscar el próximo juego de este equipo favorito
      const nextGame = upcoming
        .filter(g => this.teamMatchesFavorite(g, fav))
        .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
        [0];

      if (!nextGame) {
        continue;
      }

      const gameTime = Date.parse(nextGame.startTime);
      const diff = gameTime - currentTime.getTime();

      if (diff <= 0) {
        continue;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      results.push({
        game: nextGame,
        teamName: fav.name,
        teamLogo: fav.logo,
        days,
        hours,
        minutes,
        seconds,
      });
    }

    // Ordenar del más cercano al más lejano
    return results.sort((a, b) => {
      const totalA = a.days * 86400 + a.hours * 3600 + a.minutes * 60 + a.seconds;
      const totalB = b.days * 86400 + b.hours * 3600 + b.minutes * 60 + b.seconds;
      return totalA - totalB;
    });
  });

  ngOnInit(): void {
    this.scoreService.getScoreboardWindow(0, 14).subscribe({
      next: (games) => this.upcomingGames.set(games),
      error: () => {
        // Widget secundario: si falla, el countdown simplemente no se muestra
        this.upcomingGames.set([]);
      },
    });

    if (isPlatformBrowser(this.platformId)) {
      this.intervalId = setInterval(() => {
        this.now.set(new Date());
      }, 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
  }

  pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  private teamMatchesFavorite(game: Game, fav: FavoriteTeam): boolean {
    const favName = fav.name.toLowerCase();
    const favLastWord = favName.split(' ').pop() ?? '';

    const homeName = game.homeTeam.toLowerCase();
    const awayName = game.awayTeam.toLowerCase();

    return (
      homeName.includes(favLastWord) ||
      awayName.includes(favLastWord) ||
      homeName.includes(favName) ||
      awayName.includes(favName)
    );
  }
}
