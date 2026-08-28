import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { GameDetail } from '../../../shared/models/domain/game-detail.model';
import { GameDetailAdapter } from '../../../shared/adapters/team/game-detail.adapter';

@Injectable({
  providedIn: 'root',
})
export class GameDetailService {
  private readonly http = inject(HttpClient);

  private readonly endpoint =
    '/api/apis/site/v2/sports/football/nfl/summary';

  /**
   * Obtiene los detalles completos de un juego:
   * drives, scoring plays, líderes, momentum, situación.
   */
  getGameDetail(eventId: string): Observable<GameDetail> {
    return this.http
      .get<unknown>(this.endpoint, {
        params: { event: eventId },
      })
      .pipe(map((response) => GameDetailAdapter.adapt(response)));
  }
}
