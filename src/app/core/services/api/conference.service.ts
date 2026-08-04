import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';

import { NFLService } from './nfl.service';
import { Conference } from '../../../shared/models/domain/conference.model';
import { Team } from '../../../shared/models/domain/team.model';

@Injectable({
  providedIn: 'root',
})
export class ConferenceService {

  private nflService = inject(NFLService);

  getConferences() {
    return this.nflService.getTeams().pipe(
      map((teams: Team[]) => {

        const groups = teams.reduce((acc: Record<string, Team[]>, team: Team) => {
          if (!acc[team.conference]) acc[team.conference] = [];
          acc[team.conference].push(team);
          return acc;
        }, {});

        return Object.keys(groups).map((conferenceName): Conference => ({

          id: conferenceName,

          name: conferenceName === 'AFC'
            ? 'American Football Conference'
            : 'National Football Conference',

          divisions: (() => {
            const divMap = groups[conferenceName].reduce(
              (acc: Record<string, Team[]>, team: Team) => {
                if (!acc[team.division]) acc[team.division] = [];
                acc[team.division].push(team);
                return acc;
              }, {}
            );

            // Orden fijo: Norte → Sur → Este → Oeste
            const ORDER = ['Norte', 'Sur', 'Este', 'Oeste',
                           'North','South','East','West'];

            return Object.entries(divMap)
              .sort(([a], [b]) => {
                const dirA = a.split(' ').pop() ?? a;
                const dirB = b.split(' ').pop() ?? b;
                return ORDER.indexOf(dirA) - ORDER.indexOf(dirB);
              })
              .map(([, divTeams], index) => ({
                id:    String(index),
                name:  divTeams[0].division,
                teams: divTeams
                  .sort((x, y) => x.name.localeCompare(y.name))
                  .map(t => t.name),
              }));
          })(),

        }));

      })
    );
  }

}
