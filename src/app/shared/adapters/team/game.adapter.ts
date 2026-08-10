import {
  Game,
  NflSeasonType,
} from '../../models/domain/game.model';

export class GameAdapter {
  private static logo(team: any): string {
    return team.logos?.[0]?.href ?? team.logo ?? '';
  }

  private static record(competitor: any): string {
    const overallRecord = competitor.records?.find(
      (record: any) =>
        record.name === 'overall' || record.type === 'total',
    );

    return overallRecord?.summary ?? '0-0';
  }

  private static seasonType(
    type: number | undefined,
  ): NflSeasonType {
    switch (type) {
      case 1:
        return 'preseason';
      case 2:
        return 'regular';
      case 3:
        return 'postseason';
      case 4:
        return 'offseason';
      default:
        return 'unknown';
    }
  }

  static adapt(response: any): Game[] {
    const responseSeasonType = response?.season?.type;

    return (response?.events ?? []).map((event: any) => {
      const competition = event.competitions[0];
      const home = competition.competitors.find(
        (competitor: any) => competitor.homeAway === 'home',
      );
      const away = competition.competitors.find(
        (competitor: any) => competitor.homeAway === 'away',
      );

      return {
        id: event.id,
        homeTeam: home.team.displayName,
        awayTeam: away.team.displayName,
        homeLogo: GameAdapter.logo(home.team),
        awayLogo: GameAdapter.logo(away.team),
        homeScore: Number(home.score ?? 0),
        awayScore: Number(away.score ?? 0),
        homeRecord: GameAdapter.record(home),
        awayRecord: GameAdapter.record(away),
        startTime: event.date ?? competition.date ?? '',
        status: competition.status.type.shortDetail,
        seasonType: GameAdapter.seasonType(
          event.season?.type ?? responseSeasonType,
        ),
        week: event.week?.number ?? response?.week?.number ?? 0,
      };
    });
  }
}
