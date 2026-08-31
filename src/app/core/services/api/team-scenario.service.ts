import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import {
  TeamScenario,
  PlayoffStatus,
  ScenarioInsight,
} from '../../../shared/models/domain/team-scenario.model';

// Total de partidos en temporada regular NFL
const TOTAL_REGULAR_GAMES = 17;

interface RawTeamEntry {
  teamId: number;
  teamName: string;
  teamAbbr: string;
  teamLogo: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  winPercentage: number;
  playoffSeed: number;
  gamesBehind: number;
  streak: string;
  pointDifferential: number;
}

@Injectable({ providedIn: 'root' })
export class TeamScenarioService {
  private readonly http = inject(HttpClient);

  private readonly endpoint =
    '/api/apis/v2/sports/football/nfl/standings?level=3';

  /**
   * Obtiene los escenarios de todos los equipos.
   */
  getScenarios(): Observable<TeamScenario[]> {
    return this.http
      .get<any>(this.endpoint)
      .pipe(map(response => this.buildScenarios(response)));
  }

  private buildScenarios(response: any): TeamScenario[] {
    const rawEntries = this.parseStandings(response);

    // Agrupar por conferencia para calcular seeds/ranks
    const scenarios: TeamScenario[] = [];

    for (const conf of ['American Football Conference', 'National Football Conference']) {
      const confTeams = rawEntries
        .filter(t => t.conference === conf)
        .sort((a, b) => a.playoffSeed - b.playoffSeed || b.winPercentage - a.winPercentage);

      // Calcular ranking en conferencia
      const sortedByRecord = [...confTeams].sort(
        (a, b) => b.winPercentage - a.winPercentage || b.wins - a.wins
      );

      for (const team of confTeams) {
        const conferenceRank = sortedByRecord.findIndex(t => t.teamId === team.teamId) + 1;

        // Rank dentro de la división
        const divTeams = confTeams
          .filter(t => t.division === team.division)
          .sort((a, b) => b.winPercentage - a.winPercentage || b.wins - a.wins);
        const divisionRank = divTeams.findIndex(t => t.teamId === team.teamId) + 1;

        scenarios.push(this.buildTeamScenario(team, conferenceRank, divisionRank));
      }
    }

    return scenarios;
  }

  private parseStandings(response: any): RawTeamEntry[] {
    const entries: RawTeamEntry[] = [];
    const conferences = response?.children ?? [];

    for (const conf of conferences) {
      const confName = conf.name ?? '';
      const divisions = conf.children ?? [];

      for (const div of divisions) {
        const divName = div.name ?? '';
        const teamEntries = div.standings?.entries ?? [];

        for (const entry of teamEntries) {
          const team = entry.team ?? {};
          const stats = entry.stats ?? [];

          const getStat = (name: string): any => {
            const stat = stats.find((s: any) => s.name === name);
            return stat?.value ?? stat?.displayValue ?? null;
          };

          const getStatDisplay = (name: string): string => {
            const stat = stats.find((s: any) => s.name === name);
            return stat?.displayValue ?? '';
          };

          entries.push({
            teamId: Number(team.id ?? 0),
            teamName: team.displayName ?? '',
            teamAbbr: team.abbreviation ?? '',
            teamLogo: team.logos?.[0]?.href ?? '',
            conference: confName,
            division: divName,
            wins: Number(getStat('wins') ?? 0),
            losses: Number(getStat('losses') ?? 0),
            ties: Number(getStat('ties') ?? 0),
            winPercentage: Number(getStat('winPercent') ?? 0),
            playoffSeed: Number(getStat('playoffSeed') ?? 99),
            gamesBehind: this.parseGamesBehind(getStatDisplay('gamesBehind')),
            streak: getStatDisplay('streak') || '-',
            pointDifferential: Number(getStat('pointDifferential') ?? 0),
          });
        }
      }
    }

    return entries;
  }

  private parseGamesBehind(display: string): number {
    if (!display || display === '-') return 0;
    const num = parseFloat(display);
    return Number.isNaN(num) ? 0 : num;
  }

  private buildTeamScenario(
    team: RawTeamEntry,
    conferenceRank: number,
    divisionRank: number,
  ): TeamScenario {
    const gamesPlayed = team.wins + team.losses + team.ties;
    const gamesRemaining = Math.max(0, TOTAL_REGULAR_GAMES - gamesPlayed);

    const status = this.determineStatus(team, conferenceRank, divisionRank, gamesRemaining);
    const playoffProbability = this.estimateProbability(team, conferenceRank, gamesRemaining, status);
    const insights = this.buildInsights(team, conferenceRank, divisionRank, gamesRemaining, status);

    return {
      teamId: team.teamId,
      teamName: team.teamName,
      teamAbbr: team.teamAbbr,
      teamLogo: team.teamLogo,
      conference: team.conference === 'American Football Conference' ? 'AFC' : 'NFC',
      division: team.division,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      winPercentage: team.winPercentage,
      playoffSeed: team.playoffSeed,
      divisionRank,
      conferenceRank,
      gamesBehindDivision: team.gamesBehind,
      status,
      statusLabel: this.statusLabel(status),
      streak: team.streak,
      pointDifferential: team.pointDifferential,
      gamesRemaining,
      playoffProbability,
      insights,
    };
  }

  private determineStatus(
    team: RawTeamEntry,
    conferenceRank: number,
    divisionRank: number,
    gamesRemaining: number,
  ): PlayoffStatus {
    const gamesPlayed = team.wins + team.losses + team.ties;

    // Al inicio de temporada, todos están "en la pelea"
    if (gamesPlayed < 4) {
      return 'in-hunt';
    }

    // Ganó división (líder con pocos juegos restantes)
    if (divisionRank === 1 && gamesRemaining <= 2 && team.gamesBehind === 0) {
      return 'clinched-division';
    }

    // En puesto de playoff (top 7 de conferencia)
    if (conferenceRank <= 7) {
      if (gamesRemaining <= 3) {
        return 'clinched-playoff';
      }
      return 'in-hunt';
    }

    // Cerca del corte (posición 8-10)
    if (conferenceRank <= 10) {
      return 'bubble';
    }

    // Eliminación matemática aproximada:
    // si los juegos restantes no alcanzan para superar el corte
    const winsNeededToReach = 9; // aproximado para clasificar
    const maxPossibleWins = team.wins + gamesRemaining;
    if (maxPossibleWins < winsNeededToReach && gamesRemaining <= 3) {
      return 'eliminated';
    }

    return 'longshot';
  }

  private estimateProbability(
    team: RawTeamEntry,
    conferenceRank: number,
    gamesRemaining: number,
    status: PlayoffStatus,
  ): number {
    if (status === 'clinched-division' || status === 'clinched-playoff') {
      return 99;
    }
    if (status === 'eliminated') {
      return 1;
    }

    const gamesPlayed = team.wins + team.losses + team.ties;
    if (gamesPlayed < 4) {
      // Temporada temprana: basar en win %
      return Math.round(40 + team.winPercentage * 40);
    }

    // Basar en posición de conferencia
    let base: number;
    if (conferenceRank <= 3) base = 90;
    else if (conferenceRank <= 5) base = 78;
    else if (conferenceRank === 6) base = 68;
    else if (conferenceRank === 7) base = 55;
    else if (conferenceRank === 8) base = 38;
    else if (conferenceRank === 9) base = 22;
    else if (conferenceRank === 10) base = 12;
    else base = 5;

    // Ajustar por racha
    if (team.streak.startsWith('W')) {
      const streakLen = parseInt(team.streak.slice(1), 10) || 0;
      base = Math.min(99, base + streakLen * 2);
    } else if (team.streak.startsWith('L')) {
      const streakLen = parseInt(team.streak.slice(1), 10) || 0;
      base = Math.max(1, base - streakLen * 3);
    }

    return Math.round(base);
  }

  private buildInsights(
    team: RawTeamEntry,
    conferenceRank: number,
    divisionRank: number,
    gamesRemaining: number,
    status: PlayoffStatus,
  ): ScenarioInsight[] {
    const insights: ScenarioInsight[] = [];

    // Racha
    if (team.streak.startsWith('W')) {
      const len = parseInt(team.streak.slice(1), 10) || 0;
      insights.push({
        icon: '🔥',
        text: `Racha de ${len} ${len === 1 ? 'victoria' : 'victorias'} consecutivas`,
        type: 'positive',
      });
    } else if (team.streak.startsWith('L')) {
      const len = parseInt(team.streak.slice(1), 10) || 0;
      insights.push({
        icon: '📉',
        text: `Racha de ${len} ${len === 1 ? 'derrota' : 'derrotas'} consecutivas`,
        type: 'negative',
      });
    }

    // Posición división
    if (divisionRank === 1) {
      insights.push({
        icon: '👑',
        text: `Líder de la ${team.division}`,
        type: 'positive',
      });
    } else {
      insights.push({
        icon: '📊',
        text: `#${divisionRank} en la ${team.division}` +
          (team.gamesBehind > 0 ? ` · ${team.gamesBehind} ${team.gamesBehind === 1 ? 'juego' : 'juegos'} atrás` : ''),
        type: 'neutral',
      });
    }

    // Posición conferencia
    const confName = team.conference === 'American Football Conference' ? 'AFC' : 'NFC';
    if (conferenceRank <= 7) {
      insights.push({
        icon: '🎯',
        text: `Puesto de playoffs (#${conferenceRank} ${confName})`,
        type: 'positive',
      });
    } else {
      const spotsAway = conferenceRank - 7;
      insights.push({
        icon: '⚠️',
        text: `Fuera de playoffs por ${spotsAway} ${spotsAway === 1 ? 'puesto' : 'puestos'} (#${conferenceRank} ${confName})`,
        type: 'negative',
      });
    }

    // Diferencial de puntos
    if (team.pointDifferential > 0) {
      insights.push({
        icon: '➕',
        text: `Diferencial de puntos: +${team.pointDifferential}`,
        type: 'positive',
      });
    } else if (team.pointDifferential < 0) {
      insights.push({
        icon: '➖',
        text: `Diferencial de puntos: ${team.pointDifferential}`,
        type: 'negative',
      });
    }

    // Juegos restantes
    insights.push({
      icon: '🗓️',
      text: `${gamesRemaining} ${gamesRemaining === 1 ? 'juego restante' : 'juegos restantes'} en temporada regular`,
      type: 'neutral',
    });

    return insights;
  }

  private statusLabel(status: PlayoffStatus): string {
    switch (status) {
      case 'clinched-division':
        return 'Campeón de División';
      case 'clinched-playoff':
        return 'Clasificado a Playoffs';
      case 'in-hunt':
        return 'En la Pelea';
      case 'bubble':
        return 'En la Burbuja';
      case 'longshot':
        return 'Posibilidades Remotas';
      case 'eliminated':
        return 'Eliminado';
    }
  }
}
