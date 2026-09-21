import { ScheduleGame } from '../../models/domain/schedule-game.model';

export class ScheduleAdapter {

  private static logo(team: any): string {
    return team?.logos?.[0]?.href ?? team?.logo ?? '';
  }

  private static score(raw: unknown): number | null {
    let value = raw;
    if (typeof raw === 'object' && raw !== null) {
      const score = raw as { value?: unknown; displayValue?: unknown };
      value = score.value ?? score.displayValue;
    }

    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && value.trim() === '') return null;

    const score = Number(value);
    return Number.isFinite(score) ? score : null;
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
      const teamScore          = completed ? ScheduleAdapter.score(teamComp?.score) : null;
      const opponentScore      = completed ? ScheduleAdapter.score(opponentComp?.score) : null;

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
