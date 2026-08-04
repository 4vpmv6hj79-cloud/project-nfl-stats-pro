export interface PlayoffTeam {
  id: number;
  name: string;
  abbreviation: string;
  logo: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  percentage: number;
  seed: number;
  /** true = ganó su división, false = wild card */
  isDivisionWinner: boolean;
  /** proyectado a playoffs o ya clasificado */
  isProjected: boolean;
}

export interface PlayoffMatchup {
  id: string;
  home: PlayoffTeam | null;
  away: PlayoffTeam | null;
  /** null = por jugar */
  winner: PlayoffTeam | null;
  round: PlayoffRound;
  conference: 'AFC' | 'NFC' | 'SuperBowl';
}

export type PlayoffRound = 'wildcard' | 'divisional' | 'championship' | 'superbowl';

export interface PlayoffBracket {
  afc: ConferenceBracket;
  nfc: ConferenceBracket;
  superBowl: PlayoffMatchup;
}

export interface ConferenceBracket {
  conference: 'AFC' | 'NFC';
  seeds: PlayoffTeam[];       // 7 seeds ordenados
  wildCard: PlayoffMatchup[]; // 3 partidos: (2v7, 3v6, 4v5)
  divisional: PlayoffMatchup[]; // 2 partidos
  championship: PlayoffMatchup; // 1 partido
}
