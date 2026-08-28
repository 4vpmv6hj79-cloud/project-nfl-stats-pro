/**
 * Modelo completo de un juego con datos detallados:
 * drives, scoring plays, líderes, momentum, estadísticas.
 */

export interface GameDetailTeam {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
  score: number;
  record: string;
  color?: string;
}

export interface GameDrive {
  id: string;
  teamAbbr: string;
  teamName: string;
  result: string;              // TD, FG, PUNT, INT, FUMBLE, DOWNS, END OF HALF, etc.
  shortResult: string;         // Texto corto del resultado
  description: string;         // "7 plays, 70 yards, 3:53"
  yards: number;
  plays: number;
  isScore: boolean;
}

export interface ScoringPlay {
  id: string;
  text: string;                // "Drake London 14 Yd pass from Kirk Cousins (Koo Kick)"
  type: string;                // "Passing Touchdown", "Field Goal", etc.
  teamName: string;
  teamAbbr: string;
  homeScore: number;
  awayScore: number;
  quarter: number;
  clock: string;               // "11:07"
}

export interface GameLeader {
  category: string;            // "Passing Yards", "Rushing Yards", "Receiving Yards"
  athleteName: string;
  athletePhoto?: string;
  displayValue: string;        // "20/29, 230 YDS, 1 TD"
  teamAbbr: string;
}

export interface MomentumPoint {
  homeWinPercentage: number;
  playId?: string;
}

export interface GameDetail {
  id: string;
  status: string;
  statusState: 'pre' | 'in' | 'post' | 'unknown';
  quarter?: number;
  clock?: string;
  venue?: string;

  homeTeam: GameDetailTeam;
  awayTeam: GameDetailTeam;

  // Momentum (win probability)
  momentum: MomentumPoint[];
  currentHomeWinPct: number;

  // Últimos drives (más reciente primero)
  drives: GameDrive[];

  // Scoring plays
  scoringPlays: ScoringPlay[];

  // Líderes por equipo
  homeLeaders: GameLeader[];
  awayLeaders: GameLeader[];

  // Situación actual (si está en vivo)
  possession?: 'home' | 'away';
  downDistanceText?: string;
  isRedZone?: boolean;
}
