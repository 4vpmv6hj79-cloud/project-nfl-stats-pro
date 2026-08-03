import { Game } from '../../models/domain/game.model';

export class GameAdapter {

  private static logo(team: any): string {
    return team.logos?.[0]?.href ?? team.logo ?? '';
  }

  static adapt(response: any): Game[] {

    return response.events.map((event: any) => {

      const competition = event.competitions[0];
      const home = competition.competitors.find((c: any) => c.homeAway === 'home');
      const away = competition.competitors.find((c: any) => c.homeAway === 'away');

      return {
        id:        event.id,
        homeTeam:  home.team.displayName,
        awayTeam:  away.team.displayName,
        homeLogo:  GameAdapter.logo(home.team),
        awayLogo:  GameAdapter.logo(away.team),
        homeScore: Number(home.score),
        awayScore: Number(away.score),
        status:    competition.status.type.shortDetail,
      };

    });

  }

}
