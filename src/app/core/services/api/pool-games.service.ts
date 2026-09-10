import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

/**
 * Partido para la quiniela: datos mínimos + resultado real y si empezó.
 */
export interface PoolGame {
  id: string;
  week: number;
  startTime: string;
  started: boolean;          // true si el partido ya comenzó (bloquea predicción)
  isFinal: boolean;          // true si ya terminó
  homeAbbr: string;
  homeName: string;
  homeLogo: string;
  awayAbbr: string;
  awayName: string;
  awayLogo: string;
  /** Ganador real: 'home' | 'away' | null (si no ha terminado o empate) */
  winner: 'home' | 'away' | null;
}

@Injectable({ providedIn: 'root' })
export class PoolGamesService {
  private readonly http = inject(HttpClient);

  private readonly scoreboardEndpoint =
    '/api/apis/site/v2/sports/football/nfl/scoreboard';

  /** Obtiene los partidos de una semana de temporada regular. */
  getWeekGames(week: number, seasonType = 2): Observable<PoolGame[]> {
    const params = new HttpParams()
      .set('week', week)
      .set('seasontype', seasonType)
      .set('limit', 50);

    return this.http
      .get<any>(this.scoreboardEndpoint, { params })
      .pipe(map((response) => this.adapt(response, week)));
  }

  private adapt(response: any, week: number): PoolGame[] {
    const events = response?.events ?? [];

    return events.map((event: any) => {
      const competition = event.competitions?.[0];
      const home = competition?.competitors?.find(
        (c: any) => c.homeAway === 'home',
      );
      const away = competition?.competitors?.find(
        (c: any) => c.homeAway === 'away',
      );

      const state = competition?.status?.type?.state ?? 'pre';
      const started = state === 'in' || state === 'post';
      const isFinal = state === 'post';

      let winner: 'home' | 'away' | null = null;
      if (isFinal) {
        const hs = Number(home?.score ?? 0);
        const as = Number(away?.score ?? 0);
        if (hs > as) winner = 'home';
        else if (as > hs) winner = 'away';
        // empate → null (raro en NFL, pero posible)
      }

      return {
        id: event.id ?? '',
        week,
        startTime: event.date ?? competition?.date ?? '',
        started,
        isFinal,
        homeAbbr: home?.team?.abbreviation ?? '',
        homeName: home?.team?.displayName ?? '',
        homeLogo: home?.team?.logos?.[0]?.href ?? home?.team?.logo ?? '',
        awayAbbr: away?.team?.abbreviation ?? '',
        awayName: away?.team?.displayName ?? '',
        awayLogo: away?.team?.logos?.[0]?.href ?? away?.team?.logo ?? '',
        winner,
      } as PoolGame;
    });
  }
}
