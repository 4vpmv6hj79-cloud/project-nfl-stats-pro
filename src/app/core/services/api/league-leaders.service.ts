import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import {
  LeaderCategory,
  LeaderEntry,
} from '../../../shared/models/domain/league-leaders.model';

// Categorías a mostrar con su traducción al español
const CATEGORY_LABELS: Record<string, string> = {
  passingYards: 'Yardas por Pase',
  passingTouchdowns: 'Touchdowns de Pase',
  quarterbackRating: 'Rating de QB',
  rushingYards: 'Yardas por Tierra',
  rushingTouchdowns: 'Touchdowns por Tierra',
  receivingYards: 'Yardas por Recepción',
  receivingTouchdowns: 'Touchdowns por Recepción',
  receptions: 'Recepciones',
  totalTackles: 'Tacleadas',
  sacks: 'Capturas (Sacks)',
  interceptions: 'Intercepciones',
};

// Orden en que se muestran las categorías
const CATEGORY_ORDER = [
  'passingYards',
  'passingTouchdowns',
  'rushingYards',
  'rushingTouchdowns',
  'receivingYards',
  'receivingTouchdowns',
  'receptions',
  'sacks',
  'interceptions',
  'totalTackles',
  'quarterbackRating',
];

@Injectable({ providedIn: 'root' })
export class LeagueLeadersService {
  private readonly http = inject(HttpClient);

  /**
   * Obtiene los líderes de la liga por categoría.
   */
  getLeaders(season: number, seasonType = 2): Observable<LeaderCategory[]> {
    const params = new HttpParams()
      .set('origin', 'site-web')
      .set('season', season)
      .set('seasontype', seasonType);

    return this.http
      .get<any>('/api/apis/site/v3/sports/football/nfl/leaders', { params })
      .pipe(map(response => this.adaptLeaders(response)));
  }

  private adaptLeaders(response: any): LeaderCategory[] {
    const categories = response?.leaders?.categories ?? [];

    const mapped: LeaderCategory[] = categories
      .filter((c: any) => CATEGORY_LABELS[c.name])
      .map((c: any) => {
        const leaders: LeaderEntry[] = (c.leaders ?? [])
          .slice(0, 10)
          .map((l: any, index: number) => {
            const athlete = l.athlete ?? {};
            return {
              rank: index + 1,
              athleteId: String(athlete.id ?? ''),
              athleteName: athlete.displayName ?? '',
              headshot:
                athlete.headshot?.href ??
                (athlete.id
                  ? `https://a.espncdn.com/i/headshots/nfl/players/full/${athlete.id}.png`
                  : ''),
              position:
                typeof athlete.position === 'object'
                  ? athlete.position?.abbreviation ?? ''
                  : athlete.position ?? '',
              displayValue: l.displayValue ?? '',
            };
          });

        return {
          name: c.name,
          displayName: CATEGORY_LABELS[c.name] ?? c.displayName ?? c.name,
          abbreviation: c.abbreviation ?? '',
          leaders,
        };
      });

    // Ordenar según CATEGORY_ORDER
    return mapped.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.name);
      const bi = CATEGORY_ORDER.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }
}
