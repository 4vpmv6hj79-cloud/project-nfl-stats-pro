import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';
import {
  Injectable,
  inject,
} from '@angular/core';
import {
  Observable,
  forkJoin,
  map,
  of,
  switchMap,
} from 'rxjs';

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
      .pipe(
        map((response) =>
          GameAdapter.adapt(response),
        ),
      );
  }

  getScoreboardWindow(
    pastDays = 7,
    futureDays = 28,
  ): Observable<Game[]> {
    const startDate = new Date();

    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(
      startDate.getUTCDate() - pastDays,
    );

    const endDate = new Date();

    endDate.setUTCHours(23, 59, 59, 999);
    endDate.setUTCDate(
      endDate.getUTCDate() + futureDays,
    );

    return this.http
      .get<any>(this.endpoint)
      .pipe(
        switchMap((scoreboard) => {
          const requests = this.weekRequests(
            scoreboard,
            startDate,
            endDate,
          );

          if (requests.length === 0) {
            return of([scoreboard]);
          }

          return forkJoin(requests).pipe(
            map((responses) => [
              scoreboard,
              ...responses,
            ]),
          );
        }),

        map((responses) =>
          responses.flatMap((response) =>
            GameAdapter.adapt(response),
          ),
        ),

        map((games) =>
          games.filter((game) => {
            const startTime =
              Date.parse(game.startTime);

            return (
              Number.isFinite(startTime) &&
              startTime >= startDate.getTime() &&
              startTime <= endDate.getTime()
            );
          }),
        ),

        map((games) =>
          Array.from(
            new Map(
              games.map((game) => [
                game.id,
                game,
              ]),
            ).values(),
          ).sort(
            (first, second) =>
              Date.parse(first.startTime) -
              Date.parse(second.startTime),
          ),
        ),
      );
  }

  private weekRequests(
    scoreboard: any,
    startDate: Date,
    endDate: Date,
  ): Observable<unknown>[] {
    const league =
      scoreboard?.leagues?.[0];

    const seasonYear =
      scoreboard?.season?.year ??
      league?.season?.year;

    const calendar =
      league?.calendar ?? [];

    if (
      !seasonYear ||
      !Array.isArray(calendar)
    ) {
      return [];
    }

    return calendar.flatMap(
      (season: any) => {
        const seasonType =
          Number(season?.value);

        const entries =
          season?.entries ?? [];

        if (
          !Number.isFinite(seasonType) ||
          !Array.isArray(entries)
        ) {
          return [];
        }

        return entries
          .filter((entry: any) =>
            this.overlapsWindow(
              entry?.startDate,
              entry?.endDate,
              startDate,
              endDate,
            ),
          )
          .map((entry: any) => {
            const params = new HttpParams()
              .set(
                'dates',
                String(seasonYear),
              )
              .set(
                'seasontype',
                String(seasonType),
              )
              .set(
                'week',
                String(entry.value),
              )
              .set('limit', 100);

            return this.http.get<unknown>(
              this.endpoint,
              { params },
            );
          });
      },
    );
  }

  private overlapsWindow(
    entryStart: string | undefined,
    entryEnd: string | undefined,
    windowStart: Date,
    windowEnd: Date,
  ): boolean {
    const startTime =
      Date.parse(entryStart ?? '');

    const endTime =
      Date.parse(entryEnd ?? '');

    return (
      Number.isFinite(startTime) &&
      Number.isFinite(endTime) &&
      startTime <= windowEnd.getTime() &&
      endTime >= windowStart.getTime()
    );
  }
}