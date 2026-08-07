import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { GameAdapter } from '../../../shared/adapters/team/game.adapter';
import { Game } from '../../../shared/models/domain/game.model';

@Injectable({
  providedIn: 'root',
})
export class ScoreService {
  private readonly http = inject(HttpClient);

  private readonly endpoint =
    '/api/apis/site/v2/sports/football/nfl/scoreboard';

  getScoreboard(): Observable<Game[]> {
    return this.http
      .get<unknown>(this.endpoint)
      .pipe(map((response) => GameAdapter.adapt(response)));
  }

  getScoreboardWindow(days = 28): Observable<Game[]> {
    const startDate = new Date();

    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - 1);

    const endDate = new Date();

    endDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCDate(endDate.getUTCDate() + days);

    endDate.setUTCDate(endDate.getUTCDate() + days);

    const dateRange = [
      this.formatDate(startDate),
      this.formatDate(endDate),
    ].join('-');

    const params = new HttpParams()
      .set('dates', dateRange)
      .set('limit', 100);

    return this.http
      .get<unknown>(this.endpoint, { params })
      .pipe(map((response) => GameAdapter.adapt(response)));
  }

  private formatDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  }
}