import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';

import { NFLService } from './nfl.service';
import { Standing } from '../../../shared/models/domain/standing.model';
import {
  SimulatorGame,
  SimulatorStanding,
  SimulatorWeek,
} from '../../../shared/models/domain/simulator.model';

@Injectable({ providedIn: 'root' })
export class SimulatorService {
  private readonly http = inject(HttpClient);
  private readonly nflService = inject(NFLService);

  private readonly scoreboardEndpoint =
    '/api/apis/site/v2/sports/football/nfl/scoreboard';

  /**
   * Obtiene los datos iniciales del simulador:
   * standings actuales + juegos de la semana seleccionada.
   */
  getSimulatorData(weeks: number[]): Observable<{
    standings: Standing[];
    weeks: SimulatorWeek[];
  }> {
    const standingsObs = this.nflService.getStandings();

    const weekObservables = weeks.map(week =>
      this.getWeekGames(week).pipe(
        map(games => ({ number: week, label: `Semana ${week}`, games }))
      )
    );

    return forkJoin({
      standings: standingsObs,
      weeks: forkJoin(weekObservables),
    });
  }

  /**
   * Obtiene todos los juegos de una semana específica de temporada regular.
   */
  private getWeekGames(week: number): Observable<SimulatorGame[]> {
    const params = new HttpParams()
      .set('week', week)
      .set('seasontype', 2)
      .set('limit', 50);

    return this.http
      .get<any>(this.scoreboardEndpoint, { params })
      .pipe(map(response => this.adaptGames(response, week)));
  }

  private adaptGames(response: any, week: number): SimulatorGame[] {
    const events = response?.events ?? [];

    return events.map((event: any) => {
      const competition = event.competitions?.[0];
      const home = competition?.competitors?.find(
        (c: any) => c.homeAway === 'home'
      );
      const away = competition?.competitors?.find(
        (c: any) => c.homeAway === 'away'
      );

      const state = competition?.status?.type?.state ?? 'pre';
      const isPlayed = state === 'post';

      let result: 'home' | 'away' | null = null;
      if (isPlayed) {
        const homeScore = Number(home?.score ?? 0);
        const awayScore = Number(away?.score ?? 0);
        result = homeScore >= awayScore ? 'home' : 'away';
      }

      return {
        id: event.id ?? '',
        week,
        homeTeamAbbr: home?.team?.abbreviation ?? '',
        homeTeamName: home?.team?.displayName ?? '',
        homeTeamLogo: home?.team?.logos?.[0]?.href ?? home?.team?.logo ?? '',
        homeTeamId: home?.team?.id ?? '',
        awayTeamAbbr: away?.team?.abbreviation ?? '',
        awayTeamName: away?.team?.displayName ?? '',
        awayTeamLogo: away?.team?.logos?.[0]?.href ?? away?.team?.logo ?? '',
        awayTeamId: away?.team?.id ?? '',
        result,
        isPlayed,
      };
    });
  }

  /**
   * Recalcula los standings basándose en los resultados hipotéticos.
   * Toma los standings actuales como base y aplica los cambios.
   */
  recalculateStandings(
    baseStandings: Standing[],
    simulatedGames: SimulatorGame[],
  ): SimulatorStanding[] {
    // Crear copia mutable de standings
    const standingsMap = new Map<string, SimulatorStanding>();

    for (const s of baseStandings) {
      standingsMap.set(s.abbreviation, {
        id: s.id,
        name: s.name,
        abbreviation: s.abbreviation,
        logo: s.logo,
        conference: s.conference,
        division: s.division,
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        percentage: s.percentage,
        seedChange: 0,
        seed: 0,
        isDivisionWinner: false,
        inPlayoffs: false,
      });
    }

    // Aplicar resultados simulados (solo juegos no jugados que el usuario eligió)
    for (const game of simulatedGames) {
      if (game.isPlayed || game.result === null) {
        continue;
      }

      const homeTeam = standingsMap.get(game.homeTeamAbbr);
      const awayTeam = standingsMap.get(game.awayTeamAbbr);

      if (!homeTeam || !awayTeam) {
        continue;
      }

      if (game.result === 'home') {
        homeTeam.wins++;
        awayTeam.losses++;
      } else {
        awayTeam.wins++;
        homeTeam.losses++;
      }
    }

    // Recalcular porcentajes
    for (const team of standingsMap.values()) {
      const totalGames = team.wins + team.losses + team.ties;
      team.percentage = totalGames > 0
        ? (team.wins + team.ties * 0.5) / totalGames
        : 0;
    }

    // Calcular seeds por conferencia
    const allTeams = Array.from(standingsMap.values());

    for (const conf of ['AFC', 'NFC']) {
      const confTeams = allTeams.filter(t => t.conference === conf);
      const divisions = [...new Set(confTeams.map(t => t.division))];

      // Campeones de división
      const divWinners: SimulatorStanding[] = [];
      for (const div of divisions) {
        const divTeams = confTeams
          .filter(t => t.division === div)
          .sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);
        if (divTeams.length > 0) {
          divTeams[0].isDivisionWinner = true;
          divWinners.push(divTeams[0]);
        }
      }

      // Ordenar campeones de división por record
      divWinners.sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);

      // Wild cards: mejores no-campeones
      const divWinnerAbbrs = new Set(divWinners.map(t => t.abbreviation));
      const wildCards = confTeams
        .filter(t => !divWinnerAbbrs.has(t.abbreviation))
        .sort((a, b) => b.percentage - a.percentage || b.wins - a.wins)
        .slice(0, 3);

      // Asignar seeds
      const seeded = [...divWinners, ...wildCards];
      for (let i = 0; i < seeded.length; i++) {
        seeded[i].seed = i + 1;
        seeded[i].inPlayoffs = true;
      }

      // Equipos fuera de playoffs
      const playoffAbbrs = new Set(seeded.map(t => t.abbreviation));
      const outTeams = confTeams
        .filter(t => !playoffAbbrs.has(t.abbreviation))
        .sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);
      for (let i = 0; i < outTeams.length; i++) {
        outTeams[i].seed = seeded.length + i + 1;
        outTeams[i].inPlayoffs = false;
      }
    }

    // Calcular seedChange comparando con standings originales
    const originalSeeds = this.calculateOriginalSeeds(baseStandings);
    for (const team of allTeams) {
      const originalSeed = originalSeeds.get(team.abbreviation) ?? team.seed;
      team.seedChange = originalSeed - team.seed; // positivo = subió
    }

    return allTeams;
  }

  private calculateOriginalSeeds(standings: Standing[]): Map<string, number> {
    const seedMap = new Map<string, number>();

    for (const conf of ['AFC', 'NFC']) {
      const confTeams = standings.filter(t => t.conference === conf);
      const divisions = [...new Set(confTeams.map(t => t.division))];

      const divWinners: Standing[] = [];
      for (const div of divisions) {
        const divTeams = confTeams
          .filter(t => t.division === div)
          .sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);
        if (divTeams.length > 0) {
          divWinners.push(divTeams[0]);
        }
      }
      divWinners.sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);

      const divWinnerAbbrs = new Set(divWinners.map(t => t.abbreviation));
      const wildCards = confTeams
        .filter(t => !divWinnerAbbrs.has(t.abbreviation))
        .sort((a, b) => b.percentage - a.percentage || b.wins - a.wins)
        .slice(0, 3);

      const seeded = [...divWinners, ...wildCards];
      for (let i = 0; i < seeded.length; i++) {
        seedMap.set(seeded[i].abbreviation, i + 1);
      }

      const outTeams = confTeams
        .filter(t => !divWinnerAbbrs.has(t.abbreviation) && !wildCards.includes(t))
        .sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);
      for (let i = 0; i < outTeams.length; i++) {
        seedMap.set(outTeams[i].abbreviation, seeded.length + i + 1);
      }
    }

    return seedMap;
  }
}
