/**
 * Modelos para la página de Líderes de Estadísticas de la liga.
 */

export interface LeaderEntry {
  rank: number;
  athleteId: string;
  athleteName: string;
  headshot: string;
  position: string;
  displayValue: string;
}

export interface LeaderCategory {
  name: string;          // e.g. "passingYards"
  displayName: string;   // e.g. "Yardas por Pase"
  abbreviation: string;  // e.g. "YDS"
  leaders: LeaderEntry[];
}
