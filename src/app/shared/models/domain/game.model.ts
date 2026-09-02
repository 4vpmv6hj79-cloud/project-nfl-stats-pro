export type NflSeasonType =
  | 'preseason'
  | 'regular'
  | 'postseason'
  | 'offseason'
  | 'unknown';

export type GameStatusState =
  | 'pre'
  | 'in'
  | 'post'
  | 'unknown';

export interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeScore: number;
  awayScore: number;
  homeRecord: string;
  awayRecord: string;
  startTime: string;
  status: string;
  statusState: GameStatusState;
  seasonType: NflSeasonType;
  week: number;

  // Situación en vivo (solo disponible para juegos en curso)
  possession?: 'home' | 'away';
  down?: number;
  distance?: number;
  yardLine?: number;
  downDistanceText?: string;
  isRedZone?: boolean;

  // Predicción pre-partido (favorito según casas de análisis, sin apuestas)
  favorite?: 'home' | 'away';
}
