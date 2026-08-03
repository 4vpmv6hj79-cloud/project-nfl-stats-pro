import { ScheduleGame } from '../../models/domain/schedule-game.model';

export class ScheduleAdapter {

  private static logo(team: any): string {
    return team?.logos?.[0]?.href ?? team?.logo ?? '';
  }

  static adapt(response: any, teamId: number): ScheduleGame[] {

    const events: any[] = response.events ?? [];

    return events.map(event => {

      const competition  = event.competitions?.[0];
      const competitors  = competition?.competitors ?? [];

      const teamComp     = competitors.find((c: any) => Number(c.id) === teamId);
      const opponentComp = competitors.find((c: any) => Number(c.id) !== teamId);

      const homeAway: 'home' | 'away' =
        teamComp?.homeAway === 'home' ? 'home' : 'away';

      const completed: boolean = competition?.status?.type?.completed ?? false;
      const teamScore          = completed ? Number(teamComp?.score)     ?? null : null;
      const opponentScore      = completed ? Number(opponentComp?.score) ?? null : null;

      let result: ScheduleGame['result'] = null;
      if (completed && teamScore !== null && opponentScore !== null) {
        if (teamScore > opponentScore)      result = 'W';
        else if (teamScore < opponentScore) result = 'L';
        else                                result = 'T';
      }

      const seasonType = response.season?.type ?? event.seasonType?.type?.id ?? 2;
      const isPlayoff  = Number(seasonType) === 3;

      return {
        id:            String(event.id),
        week:          event.week?.number ?? 0,
        date:          event.date         ?? '',
        homeAway,
        opponent:      opponentComp?.team?.displayName  ?? '',
        opponentAbbr:  opponentComp?.team?.abbreviation ?? '',
        opponentLogo:  ScheduleAdapter.logo(opponentComp?.team),
        result,
        teamScore,
        opponentScore,
        isPlayoff,
      };

    });

  }

}
