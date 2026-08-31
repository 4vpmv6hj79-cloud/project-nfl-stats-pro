import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import {
  TeamScenario,
  PlayoffStatus,
  ScenarioInsight,
  ClinchAnalysis,
  ClinchScenario,
  DirectRival,
  UpcomingGame,
} from '../../../shared/models/domain/team-scenario.model';

// Total de partidos en temporada regular NFL
const TOTAL_REGULAR_GAMES = 17;
// Victorias que históricamente aseguran playoffs / división
const WINS_TO_CLINCH_PLAYOFF = 10;
const WINS_TO_CLINCH_DIVISION = 11;

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

  /**
   * Genera el análisis de clasificación (clinch) para un equipo específico.
   * Combina el resumen matemático, escenarios concretos y rivales directos.
   * Recibe la lista de escenarios ya cargada para calcular rivales.
   */
  getClinchAnalysis(
    teamId: number,
    allScenarios: TeamScenario[],
  ): Observable<ClinchAnalysis> {
    const params = new HttpParams().set('seasontype', 2);

    return this.http
      .get<any>(
        `/api/apis/site/v2/sports/football/nfl/teams/${teamId}/schedule`,
        { params },
      )
      .pipe(
        map(response => this.buildClinchAnalysis(teamId, response, allScenarios)),
      );
  }

  private buildClinchAnalysis(
    teamId: number,
    scheduleResponse: any,
    allScenarios: TeamScenario[],
  ): ClinchAnalysis {
    const team = allScenarios.find(s => s.teamId === teamId);

    const upcomingGames = this.parseUpcomingGames(teamId, scheduleResponse, allScenarios);
    const gamesRemaining = upcomingGames.length;

    if (!team) {
      return {
        mathSummary: 'No hay suficiente información disponible.',
        winsNeeded: 0,
        winsNeededForDivision: 0,
        scenarios: [],
        directRivals: [],
        upcomingGames,
        disclaimer: 'Escenarios estimados. Los desempates oficiales de la NFL pueden variar.',
      };
    }

    // ── Resumen matemático ──────────────────────────────────
    const winsNeeded = Math.max(0, WINS_TO_CLINCH_PLAYOFF - team.wins);
    const winsNeededForDivision = Math.max(0, WINS_TO_CLINCH_DIVISION - team.wins);
    const mathSummary = this.buildMathSummary(team, winsNeeded, gamesRemaining);

    // ── Rivales directos ────────────────────────────────────
    const directRivals = this.findDirectRivals(team, allScenarios);

    // ── Escenarios concretos ────────────────────────────────
    const scenarios = this.buildConcreteScenarios(
      team,
      winsNeeded,
      winsNeededForDivision,
      gamesRemaining,
      directRivals,
    );

    return {
      mathSummary,
      winsNeeded,
      winsNeededForDivision,
      scenarios,
      directRivals,
      upcomingGames,
      disclaimer:
        'Escenarios estimados con base en récord y posición actual. ' +
        'Los desempates oficiales de la NFL (head-to-head, récord divisional, etc.) pueden alterar el resultado real.',
    };
  }

  private parseUpcomingGames(
    teamId: number,
    scheduleResponse: any,
    allScenarios: TeamScenario[],
  ): UpcomingGame[] {
    const events = scheduleResponse?.events ?? [];
    const games: UpcomingGame[] = [];

    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const state = comp.status?.type?.state ?? 'pre';
      if (state === 'post') continue; // Solo partidos por jugar

      const competitors = comp.competitors ?? [];
      const self = competitors.find((c: any) => String(c.team?.id) === String(teamId));
      const opponent = competitors.find((c: any) => String(c.team?.id) !== String(teamId));

      if (!opponent) continue;

      const oppAbbr = opponent.team?.abbreviation ?? '';
      const oppScenario = allScenarios.find(s => s.teamAbbr === oppAbbr);
      const oppRecord = oppScenario
        ? `${oppScenario.wins}-${oppScenario.losses}${oppScenario.ties > 0 ? '-' + oppScenario.ties : ''}`
        : '';

      games.push({
        week: event.week?.number ?? 0,
        opponentAbbr: oppAbbr,
        opponentName: opponent.team?.displayName ?? '',
        opponentLogo: opponent.team?.logos?.[0]?.href ?? '',
        isHome: self?.homeAway === 'home',
        opponentRecord: oppRecord,
      });
    }

    return games;
  }

  private buildMathSummary(
    team: TeamScenario,
    winsNeeded: number,
    gamesRemaining: number,
  ): string {
    if (team.status === 'clinched-division') {
      return `${team.teamName} ya aseguró su división. 🏆`;
    }
    if (team.status === 'clinched-playoff') {
      return `${team.teamName} ya está clasificado a playoffs. ✅`;
    }
    if (team.status === 'eliminated') {
      return `${team.teamName} está eliminado matemáticamente de los playoffs.`;
    }

    if (winsNeeded === 0) {
      return `${team.teamName} está en muy buena posición; con mantener el ritmo debería clasificar.`;
    }

    if (winsNeeded > gamesRemaining) {
      return `${team.teamName} necesita ganar más juegos de los que le quedan y depender de otros resultados. La situación es complicada.`;
    }

    const of = gamesRemaining;
    return `${team.teamName} necesita ganar aproximadamente ${winsNeeded} de sus últimos ${of} ${of === 1 ? 'partido' : 'partidos'} para tener buenas posibilidades de playoffs.`;
  }

  private findDirectRivals(
    team: TeamScenario,
    allScenarios: TeamScenario[],
  ): DirectRival[] {
    // Rivales por el puesto de wildcard/corte: equipos de la misma
    // conferencia con posición cercana (rank 5-10 aprox)
    const confTeams = allScenarios
      .filter(s => s.conference === team.conference && s.teamId !== team.teamId)
      .sort((a, b) => a.conferenceRank - b.conferenceRank);

    // Tomar equipos cercanos en la tabla (2 arriba, 2 abajo)
    const teamIndex = confTeams.findIndex(s => s.conferenceRank > team.conferenceRank);
    const rivals = confTeams
      .filter(s => Math.abs(s.conferenceRank - team.conferenceRank) <= 2)
      .slice(0, 4);

    return rivals.map(r => ({
      teamAbbr: r.teamAbbr,
      teamName: r.teamName,
      teamLogo: r.teamLogo,
      record: `${r.wins}-${r.losses}${r.ties > 0 ? '-' + r.ties : ''}`,
      gamesBehindOrAhead: this.gamesDiff(team, r),
    }));
  }

  private gamesDiff(team: TeamScenario, rival: TeamScenario): number {
    // Diferencia de "juegos" basada en victorias y derrotas
    const teamNet = team.wins - team.losses;
    const rivalNet = rival.wins - rival.losses;
    return (rivalNet - teamNet) / 2;
  }

  private buildConcreteScenarios(
    team: TeamScenario,
    winsNeeded: number,
    winsNeededForDivision: number,
    gamesRemaining: number,
    directRivals: DirectRival[],
  ): ClinchScenario[] {
    const scenarios: ClinchScenario[] = [];

    if (team.status === 'clinched-division' || team.status === 'clinched-playoff') {
      scenarios.push({
        icon: '🏆',
        conditions: ['Ya clasificado'],
        outcome: 'Ahora pelea por mejorar su siembra (seed) para tener ventaja de local.',
        type: 'clinch',
      });
      return scenarios;
    }

    if (team.status === 'eliminated') {
      scenarios.push({
        icon: '❌',
        conditions: ['Sin posibilidades matemáticas'],
        outcome: 'El equipo no puede alcanzar los playoffs esta temporada.',
        type: 'eliminate',
      });
      return scenarios;
    }

    // Escenario de división (si está cerca del liderato)
    if (team.divisionRank === 1) {
      scenarios.push({
        icon: '👑',
        conditions: [
          `Ganar sus próximos partidos clave`,
          `Mantener ventaja sobre su división`,
        ],
        outcome: `${team.teamName} aseguraría el título de la ${team.division} y un puesto directo a playoffs.`,
        type: 'clinch',
      });
    } else if (team.divisionRank === 2 && team.gamesBehindDivision <= 2) {
      const leader = directRivals.find(r => r.gamesBehindOrAhead < 0);
      scenarios.push({
        icon: '🎯',
        conditions: [
          `${team.teamName} gana sus partidos restantes`,
          leader
            ? `${leader.teamName} pierde para ceder el liderato`
            : `El líder de división tropieza`,
        ],
        outcome: `${team.teamName} podría arrebatar el título de la ${team.division}.`,
        type: 'clinch',
      });
    }

    // Escenario de wildcard
    if (team.conferenceRank <= 7 && winsNeeded > 0) {
      scenarios.push({
        icon: '🎟️',
        conditions: [
          `Ganar ${winsNeeded} de sus últimos ${gamesRemaining} ${gamesRemaining === 1 ? 'partido' : 'partidos'}`,
          `Los rivales directos por el comodín no ganen todos sus juegos`,
        ],
        outcome: `${team.teamName} aseguraría un puesto de comodín (wildcard) en la ${team.conference}.`,
        type: 'clinch',
      });
    } else if (team.conferenceRank > 7 && team.conferenceRank <= 10) {
      const spotsNeeded = team.conferenceRank - 7;
      const rivalsAhead = directRivals
        .filter(r => r.gamesBehindOrAhead < 0)
        .slice(0, 2)
        .map(r => r.teamName);

      scenarios.push({
        icon: '⚡',
        conditions: [
          `${team.teamName} gana la mayoría de sus partidos restantes`,
          rivalsAhead.length > 0
            ? `${rivalsAhead.join(' y ')} pierdan partidos clave`
            : `Los equipos por encima tropiecen`,
        ],
        outcome: `${team.teamName} podría escalar ${spotsNeeded} ${spotsNeeded === 1 ? 'puesto' : 'puestos'} y entrar a la zona de playoffs.`,
        type: 'help',
      });
    } else if (team.conferenceRank > 10) {
      scenarios.push({
        icon: '🔮',
        conditions: [
          `${team.teamName} gana todos sus partidos restantes`,
          `Múltiples equipos por encima colapsen`,
        ],
        outcome: `Las posibilidades son remotas, pero matemáticamente aún es posible.`,
        type: 'help',
      });
    }

    return scenarios;
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
