/**
 * Modelos para el Simulador de Playoffs.
 * Permite al usuario asignar resultados hipotéticos
 * a partidos futuros y recalcular standings/seeds.
 */

export interface SimulatorGame {
  id: string;
  week: number;
  homeTeamAbbr: string;
  homeTeamName: string;
  homeTeamLogo: string;
  homeTeamId: string;
  awayTeamAbbr: string;
  awayTeamName: string;
  awayTeamLogo: string;
  awayTeamId: string;
  /** null = no decidido, 'home' = gana local, 'away' = gana visitante */
  result: 'home' | 'away' | null;
  /** true si ya se jugó en la realidad */
  isPlayed: boolean;
}

export interface SimulatorStanding {
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
  /** Cambio respecto a posición actual (positivo = subió) */
  seedChange: number;
  seed: number;
  isDivisionWinner: boolean;
  /** true = clasifica a playoffs */
  inPlayoffs: boolean;
}

export interface SimulatorWeek {
  number: number;
  label: string;
  games: SimulatorGame[];
}
