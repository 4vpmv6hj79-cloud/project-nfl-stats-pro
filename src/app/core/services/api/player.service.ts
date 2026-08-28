import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import {
  PlayerSearchResult,
  PlayerProfile,
  PlayerStat,
} from '../../../shared/models/domain/player-stats.model';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly http = inject(HttpClient);

  /**
   * Busca jugadores por nombre usando el endpoint de búsqueda de ESPN.
   */
  searchPlayers(query: string): Observable<PlayerSearchResult[]> {
    if (!query || query.trim().length < 2) {
      return new Observable(sub => {
        sub.next([]);
        sub.complete();
      });
    }

    const params = new HttpParams()
      .set('query', query.trim())
      .set('limit', '10')
      .set('type', 'player')
      .set('sport', 'football')
      .set('league', 'nfl');

    return this.http
      .get<any>('/api/apis/common/v3/search', { params })
      .pipe(map(response => this.adaptSearchResults(response)));
  }

  /**
   * Obtiene el perfil completo con estadísticas de un jugador.
   */
  getPlayerStats(playerId: string): Observable<PlayerProfile> {
    const params = new HttpParams()
      .set('origin', 'site-web');

    return this.http
      .get<any>(`/api/apis/common/v3/sports/football/nfl/athletes/${playerId}/overview`, { params })
      .pipe(map(response => this.adaptPlayerProfile(playerId, response)));
  }

  private adaptSearchResults(response: any): PlayerSearchResult[] {
    const items = response?.items ?? [];

    return items
      .filter((item: any) => item.type === 'player')
      .map((item: any) => {
        const teamRel = item.leagueRelationships?.[0];
        const team = teamRel?.season?.athletes?.[0]?.team ??
                     item.teamRelationships?.[0] ?? {};

        return {
          id: item.id ?? '',
          displayName: item.displayName ?? '',
          shortName: item.shortName ?? '',
          position: team.position?.abbreviation ?? item.position ?? '',
          teamAbbr: team.abbreviation ?? '',
          teamName: team.displayName ?? '',
          headshot: item.headshot?.href ?? '',
        };
      });
  }

  private adaptPlayerProfile(playerId: string, response: any): PlayerProfile {
    const stats = response?.statistics ?? {};
    const labels = stats?.labels ?? [];
    const names = stats?.names ?? [];
    const displayNames = stats?.displayNames ?? [];
    const categories = (stats?.categories ?? []).map((c: any) => c.displayName ?? c.name ?? '');

    // Usar primera split (Regular Season) o la primera disponible
    const splits = stats?.splits ?? [];
    const regularSeason = splits.find((s: any) =>
      s.displayName?.toLowerCase().includes('regular')
    ) ?? splits[0];

    const values: string[] = regularSeason?.stats ?? [];

    const playerStats: PlayerStat[] = [];
    for (let i = 0; i < labels.length && i < values.length; i++) {
      playerStats.push({
        name: names[i] ?? '',
        label: labels[i] ?? '',
        displayName: displayNames[i] ?? '',
        value: values[i] ?? '-',
      });
    }

    // Extraer info del header/athlete
    const header = response?.athlete ?? response?.header ?? {};
    const athlete = header?.athlete ?? header;

    // ESPN headshot URL estándar (siempre disponible)
    const headshotUrl = `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`;

    return {
      id: playerId,
      displayName: athlete?.displayName ?? '',
      position: athlete?.position?.abbreviation ?? categories[0] ?? '',
      teamAbbr: athlete?.team?.abbreviation ?? '',
      teamName: athlete?.team?.displayName ?? '',
      teamLogo: athlete?.team?.logos?.[0]?.href ?? athlete?.team?.logo ?? '',
      jersey: athlete?.jersey ?? '',
      headshot: athlete?.headshot?.href || headshotUrl,
      stats: playerStats,
      categories,
    };
  }
}
