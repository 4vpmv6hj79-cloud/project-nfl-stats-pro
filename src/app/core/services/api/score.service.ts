import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { GameAdapter } from '../../../shared/adapters/team/game.adapter';
import { Game } from '../../../shared/models/domain/game.model';

@Injectable({
  providedIn: 'root'
})
export class ScoreService {

  private http = inject(HttpClient);

  getScoreboard() {

    return this.http
      .get<any>(
        '/api/apis/site/v2/sports/football/nfl/scoreboard'
      )
      .pipe(
        map(response => GameAdapter.adapt(response))
      );

  }

}