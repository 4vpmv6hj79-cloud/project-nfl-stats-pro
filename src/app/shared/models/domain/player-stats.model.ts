/**
 * Modelos para el Comparador de Jugadores.
 */

export interface PlayerSearchResult {
  id: string;
  displayName: string;
  shortName: string;
  position?: string;
  teamAbbr?: string;
  teamName?: string;
  headshot?: string;
}

export interface PlayerStat {
  name: string;           // e.g. "completions"
  label: string;          // e.g. "CMP"
  displayName: string;    // e.g. "Completions"
  value: string;          // e.g. "173"
}

export interface PlayerProfile {
  id: string;
  displayName: string;
  position: string;
  teamAbbr: string;
  teamName: string;
  teamLogo: string;
  jersey: string;
  headshot: string;
  stats: PlayerStat[];
  categories: string[];   // e.g. ["Passing", "Rushing"]
}
