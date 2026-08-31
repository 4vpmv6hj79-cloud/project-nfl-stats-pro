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

  // Escenarios de clasificación (combinación matemática + concreta)
  clinchAnalysis?: ClinchAnalysis;
}

export interface ScenarioInsight {
  icon: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}

/**
 * Análisis de clasificación en capas:
 * 1. Resumen matemático (cuántas victorias necesita)
 * 2. Escenarios concretos (gana + que pierdan rivales)
 * 3. Rivales directos por el puesto
 */
export interface ClinchAnalysis {
  // Resumen matemático
  mathSummary: string;

  // Victorias necesarias estimadas para clasificar
  winsNeeded: number;
  winsNeededForDivision: number;

  // Escenarios concretos
  scenarios: ClinchScenario[];

  // Rivales directos por el puesto de wildcard/división
  directRivals: DirectRival[];

  // Próximos partidos del equipo
  upcomingGames: UpcomingGame[];

  // Nota aclaratoria (escenarios estimados)
  disclaimer: string;
}

export interface ClinchScenario {
  icon: string;
  /** Condiciones que deben cumplirse */
  conditions: string[];
  /** Resultado si se cumplen */
  outcome: string;
  type: 'clinch' | 'help' | 'eliminate';
}

export interface DirectRival {
  teamAbbr: string;
  teamName: string;
  teamLogo: string;
  record: string;
  gamesBehindOrAhead: number;  // positivo = adelante del equipo, negativo = atrás
}

export interface UpcomingGame {
  week: number;
  opponentAbbr: string;
  opponentName: string;
  opponentLogo: string;
  isHome: boolean;
  opponentRecord: string;
}
