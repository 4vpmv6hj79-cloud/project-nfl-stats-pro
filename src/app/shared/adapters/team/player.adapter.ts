import { Player } from '../../models/domain/player.model';

export class PlayerAdapter {

  static adapt(response: any): Player[] {

    const athletes: any[] = response.athletes ?? [];

    // La API devuelve los jugadores agrupados por posición
    // Cada grupo tiene: position (name) y items (array de atletas)
    const players: Player[] = [];

    for (const group of athletes) {

      const positionName: string  = group.position ?? '';
      const items: any[]          = group.items    ?? [];

      for (const athlete of items) {

        const injury = athlete.injuries?.[0];

        players.push({
          id:                Number(athlete.id),
          fullName:          athlete.fullName      ?? '',
          jersey:            athlete.jersey        ?? '-',
          position:          athlete.position?.displayName ?? positionName,
          positionAbbr:      athlete.position?.abbreviation ?? '',
          age:               athlete.age           ?? 0,
          height:            athlete.displayHeight ?? '',
          weight:            athlete.displayWeight ?? '',
          college:           athlete.college?.name ?? '',
          headshot:          athlete.headshot?.href ?? '',
          injuryStatus:      this.parseInjuryStatus(injury?.status),
          injuryDescription: injury?.longComment ?? injury?.shortComment ?? '',
        });

      }

    }

    return players;

  }

  private static parseInjuryStatus(
    status: string | undefined
  ): Player['injuryStatus'] {

    const map: Record<string, Player['injuryStatus']> = {
      'Active':     'Active',
      'Questionable': 'Questionable',
      'Doubtful':   'Doubtful',
      'Out':        'Out',
      'Injured Reserve': 'IR',
      'IR':         'IR',
      'PUP':        'PUP',
      'Suspended':  'Suspended',
    };

    return map[status ?? ''] ?? '';

  }

}
