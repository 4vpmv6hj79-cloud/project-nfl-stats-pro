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
import { FavoritesService } from '../../../../core/services/favorites.service';
import { Game } from '../../../../shared/models/domain/game.model';

interface CountdownData {
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

  readonly countdown = computed<CountdownData | null>(() => {
    const favorites = this.favoritesService.favorites();

    if (favorites.length === 0) {
      return null;
    }

    const games = this.upcomingGames();
    const currentTime = this.now();

    // Buscar el próximo juego de un equipo favorito
    const favAbbrs = new Set(favorites.map(f => f.abbreviation.toUpperCase()));

    const nextGame = games
      .filter(g => g.statusState === 'pre')
      .filter(g => {
        const homeAbbr = this.extractAbbr(g.homeTeam, games, g, 'home');
        const awayAbbr = this.extractAbbr(g.awayTeam, games, g, 'away');
        return favAbbrs.has(homeAbbr) || favAbbrs.has(awayAbbr);
      })
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
      [0];

    if (!nextGame) {
      return null;
    }

    const gameTime = Date.parse(nextGame.startTime);
    const diff = gameTime - currentTime.getTime();

    if (diff <= 0) {
      return null;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Determinar cuál equipo favorito juega
    const favTeam = favorites.find(f => {
      const abbr = f.abbreviation.toUpperCase();
      const homeAbbr = this.extractAbbr(nextGame.homeTeam, games, nextGame, 'home');
      const awayAbbr = this.extractAbbr(nextGame.awayTeam, games, nextGame, 'away');
      return abbr === homeAbbr || abbr === awayAbbr;
    });

    return {
      game: nextGame,
      teamName: favTeam?.name ?? nextGame.homeTeam,
      teamLogo: favTeam?.logo ?? nextGame.homeLogo,
      days,
      hours,
      minutes,
      seconds,
    };
  });

  ngOnInit(): void {
    this.scoreService.getScoreboardWindow(0, 14).subscribe({
      next: (games) => this.upcomingGames.set(games),
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

  /**
   * Intenta extraer la abreviatura del nombre del equipo.
   * Como el Game model no tiene un campo de abreviatura directamente,
   * usamos los logos que contienen la abreviatura en la URL de ESPN.
   */
  private extractAbbr(teamName: string, games: Game[], game: Game, side: 'home' | 'away'): string {
    const logo = side === 'home' ? game.homeLogo : game.awayLogo;
    // ESPN logos: .../nfl/500/xxx.png donde xxx es el team id
    // Fallback: buscar en favoritos por nombre parcial
    const favorites = this.favoritesService.favorites();
    const match = favorites.find(f =>
      teamName.toLowerCase().includes(f.name.toLowerCase()) ||
      f.name.toLowerCase().includes(teamName.split(' ').pop()?.toLowerCase() ?? '')
    );
    return match?.abbreviation.toUpperCase() ?? '';
  }
}
