import { Standing } from '../../models/domain/standing.model';

export class StandingAdapter {

  static adapt(response: any): Standing[] {

    if (!response?.children) {
      return [];
    }

    const standings: Standing[] = [];

    // Nivel 1: AFC / NFC
    for (const conference of response.children) {

      const conferenceName: string = conference.abbreviation ?? '';

      // Nivel 2: divisiones (North, South, East, West)
      const divisions = conference.children ?? [];

      for (const division of divisions) {

        const divisionName: string = division.name ?? '';
        const entries = division.standings?.entries ?? [];

        for (const entry of entries) {

          const team = entry.team;

          const stat = (name: string): number =>
            entry.stats?.find((s: any) => s.name === name)?.value ?? 0;

          standings.push({
            id:           Number(team.id),
            name:         team.displayName ?? '',
            abbreviation: team.abbreviation ?? '',
            logo:         team.logos?.[0]?.href ?? '',
            conference:   conferenceName,
            division:     divisionName,
            wins:         stat('wins'),
            losses:       stat('losses'),
            ties:         stat('ties'),
            percentage:   stat('winPercent'),
          });

        }

      }

    }

    return standings;

  }

}
