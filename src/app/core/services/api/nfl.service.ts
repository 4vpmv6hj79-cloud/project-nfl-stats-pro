import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { Team } from '../../../shared/models/domain/team.model';
import { TeamAdapter } from '../../../shared/adapters/team/team.adapter';
import { TeamDetailAdapter } from '../../../shared/adapters/team/team-detail.adapter';
import { TeamDetail } from '../../../shared/models/domain/team-detail.model';
import { Standing } from '../../../shared/models/domain/standing.model';
import { StandingAdapter } from '../../../shared/adapters/team/standing.adapter';
import { Player } from '../../../shared/models/domain/player.model';
import { PlayerAdapter } from '../../../shared/adapters/team/player.adapter';
import { ScheduleGame } from '../../../shared/models/domain/schedule-game.model';
import { ScheduleAdapter } from '../../../shared/adapters/team/schedule.adapter';
import { NewsArticle } from '../../../shared/models/domain/news-article.model';
import { NewsAdapter } from '../../../shared/adapters/team/news.adapter';

@Injectable({
  providedIn: 'root'
})
export class NFLService {

  private http = inject(HttpClient);

  private readonly base = '/api/apis/site/v2/sports/football/nfl';

  getTeams(): Observable<Team[]> {

    return this.http
      .get<any>(`${this.base}/teams`)
      .pipe(
        map(response => TeamAdapter.adapt(response))
      );

  }

  getTeamById(id: number): Observable<Team | undefined> {

    return this.getTeams().pipe(
      map((teams: Team[]) =>
        teams.find((team: Team) => team.id === id)
      )
    );

  }

  getTeamDetail(id: number): Observable<TeamDetail> {

    return this.http
      .get<any>(`${this.base}/teams/${id}?enable=venue`)
      .pipe(
        map(response => TeamDetailAdapter.adapt(response))
      );

  }

  getStandings(): Observable<Standing[]> {

    return this.http
      .get<any>(`${this.base}/standings?seasontype=2`)
      .pipe(
        map(response => StandingAdapter.adapt(response))
      );

  }

  getRoster(teamId: number): Observable<Player[]> {

    return this.http
      .get<any>(`${this.base}/teams/${teamId}/roster`)
      .pipe(
        map(response => PlayerAdapter.adapt(response))
      );

  }

  getSchedule(teamId: number): Observable<ScheduleGame[]> {

    return this.http
      .get<any>(`${this.base}/teams/${teamId}/schedule`)
      .pipe(
        map(response => ScheduleAdapter.adapt(response, teamId))
      );

  }

  getNews(limit = 20): Observable<NewsArticle[]> {

    return this.http
      .get<any>(`${this.base}/news?lang=es&region=mx&limit=${limit}`)
      .pipe(
        map(response => NewsAdapter.adapt(response))
      );

  }

}
