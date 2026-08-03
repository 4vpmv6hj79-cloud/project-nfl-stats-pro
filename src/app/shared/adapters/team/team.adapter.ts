import { Team } from '../../models/domain/team.model';
import { NFL_TEAM_INFO } from '../../constants/nfl-divisions';

export class TeamAdapter {

  static adapt(response: any): Team[] {

    return response.sports[0]
      .leagues[0]
      .teams
      .map((item: any) => {

        const team = item.team;
        const info = NFL_TEAM_INFO[team.abbreviation];

        return {
          id:           Number(team.id),
          name:         team.displayName,
          city:         team.location,
          abbreviation: team.abbreviation,
          logo:         team.logos?.[0]?.href ?? '',
          conference:   info?.conference ?? '',
          division:     info?.division   ?? '',
        };

      });

  }

}
