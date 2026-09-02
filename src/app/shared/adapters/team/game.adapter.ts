import {
  Game,
  GameStatusState,
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
    private static statusState(competition: any,): GameStatusState {
    const state = competition?.status?.type?.state;

    if (
      state === 'pre' ||
      state === 'in' ||
      state === 'post'
    ) {
      return state;
    }

    if (competition?.status?.type?.completed === true) {
      return 'post';
    }

    const detail = String(
      competition?.status?.type?.shortDetail ?? '',
    ).toLowerCase();

    if (detail.includes('final')) {
      return 'post';
    }

    return 'unknown';
  }

  private static translateStatus(status: string): string {
    if (!status) {
      return '';
    }

    return status
      .replace(/^Halftime$/i, 'Medio Tiempo')
      .replace(/^Half$/i, 'Medio Tiempo')
      .replace(/^Final\/OT$/i, 'Final/TE')
      .replace(/^End of (\d)/i, 'Fin del $1');
  }

  private static possession(
    situation: any,
    home: any,
    away: any,
  ): 'home' | 'away' | undefined {
    const possTeamId = situation?.possession;

    if (!possTeamId) {
      return undefined;
    }

    const homeId = String(home?.team?.id ?? home?.id ?? '');
    const awayId = String(away?.team?.id ?? away?.id ?? '');

    if (String(possTeamId) === homeId) {
      return 'home';
    }

    if (String(possTeamId) === awayId) {
      return 'away';
    }

    return undefined;
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

      const situation = competition.situation;
      const favorite = GameAdapter.favorite(competition);

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
        status: GameAdapter.translateStatus(competition.status.type.shortDetail),
        statusState: GameAdapter.statusState(competition),
        seasonType: GameAdapter.seasonType(
          event.season?.type ?? responseSeasonType,
        ),
        week: event.week?.number ?? response?.week?.number ?? 0,

        // Situación en vivo
        possession: GameAdapter.possession(situation, home, away),
        down: situation?.down ?? undefined,
        distance: situation?.distance ?? undefined,
        yardLine: situation?.yardLine ?? undefined,
        downDistanceText: situation?.downDistanceText
          ? String(situation.downDistanceText).replace(' at ', ' en ')
          : undefined,
        isRedZone: situation?.isRedZone ?? undefined,

        // Predicción pre-partido
        favorite,
      };
    });
  }

  /**
   * Determina el equipo favorito según los datos de análisis de ESPN.
   * Solo se usa el indicador de favorito (sin spreads ni líneas de apuestas).
   */
  private static favorite(competition: any): 'home' | 'away' | undefined {
    const odds = competition?.odds?.[0];
    if (!odds) return undefined;

    if (odds.homeTeamOdds?.favorite === true) return 'home';
    if (odds.awayTeamOdds?.favorite === true) return 'away';

    return undefined;
  }
}
