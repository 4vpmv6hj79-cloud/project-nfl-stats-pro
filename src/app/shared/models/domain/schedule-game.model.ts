export interface ScheduleGame {

  id: string;
  week: number;
  date: string;           // ISO string
  homeAway: 'home' | 'away';
  opponent: string;
  opponentLogo: string;
  opponentAbbr: string;
  result: 'W' | 'L' | 'T' | null;   // null = partido no jugado
  teamScore: number | null;
  opponentScore: number | null;
  isPlayoff: boolean;

}
