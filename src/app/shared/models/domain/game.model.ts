export type NflSeasonType =
  | 'preseason'
  | 'regular'
  | 'postseason'
  | 'offseason'
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
  status: string;
  seasonType: NflSeasonType;
  week: number;
}