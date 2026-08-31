/**
 * Modelos para la funcionalidad "¿Qué necesita mi equipo?".
 * Analiza la situación de clasificación a playoffs de un equipo.
 */

export type PlayoffStatus =
  | 'clinched-division'   // Ganó su división
  | 'clinched-playoff'    // Clasificado a playoffs
  | 'in-hunt'             // En la pelea
  | 'bubble'              // En la burbuja (borde de clasificación)
  | 'longshot'            // Posibilidades remotas
  | 'eliminated';         // Eliminado

export interface TeamScenario {
  teamId: number;
  teamName: string;
  teamAbbr: string;
  teamLogo: string;
  conference: string;
  division: string;

  // Record
  wins: number;
  losses: number;
  ties: number;
  winPercentage: number;

  // Posición
  playoffSeed: number;
  divisionRank: number;
  conferenceRank: number;
  gamesBehindDivision: number;

  // Estado
  status: PlayoffStatus;
  statusLabel: string;

  // Contexto
  streak: string;
  pointDifferential: number;
  gamesRemaining: number;

  // Análisis
  playoffProbability: number;   // Estimación 0-100
  insights: ScenarioInsight[];
}

export interface ScenarioInsight {
  icon: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}
