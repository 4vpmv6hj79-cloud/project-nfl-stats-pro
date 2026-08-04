import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';

import { NFLService } from './nfl.service';
import { Standing } from '../../../shared/models/domain/standing.model';
import {
  PlayoffTeam,
  PlayoffMatchup,
  PlayoffBracket,
  ConferenceBracket,
} from '../../../shared/models/domain/playoff.model';

@Injectable({ providedIn: 'root' })
export class PlayoffService {

  private nflService = inject(NFLService);

  getBracket() {
    return this.nflService.getStandings().pipe(
      map(standings => this.buildBracket(standings))
    );
  }

  // ── Construcción del bracket ────────────────────────────

  private buildBracket(standings: Standing[]): PlayoffBracket {
    const afc = this.buildConference(standings, 'AFC');
    const nfc = this.buildConference(standings, 'NFC');

    const superBowl: PlayoffMatchup = {
      id: 'superbowl',
      home: afc.championship.winner,
      away: nfc.championship.winner,
      winner: null,
      round: 'superbowl',
      conference: 'SuperBowl',
    };

    return { afc, nfc, superBowl };
  }

  private buildConference(
    standings: Standing[],
    conf: 'AFC' | 'NFC'
  ): ConferenceBracket {

    const teams = standings.filter(t => t.conference === conf);
    const seeds = this.seedTeams(teams);

    const wildCard = this.buildWildCard(seeds, conf);
    const divisional = this.buildDivisional(seeds, wildCard, conf);
    const championship = this.buildChampionship(divisional, conf);

    return { conference: conf, seeds, wildCard, divisional, championship };
  }

  // ── Seeding NFL: 4 campeones de división (seeds 1-4) + 3 wild cards ──

  private seedTeams(teams: Standing[]): PlayoffTeam[] {
    const divisions = [...new Set(teams.map(t => t.division))];

    // Un campeón por división (mejor récord)
    const divWinners: PlayoffTeam[] = divisions.map(div => {
      const divTeams = teams
        .filter(t => t.division === div)
        .sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);
      return this.toPlayoffTeam(divTeams[0], true, 0);
    }).sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);

    // Wild cards: los mejores que no ganaron división, excluyendo ya clasificados
    const divWinnerIds = new Set(divWinners.map(t => t.id));
    const wildCards: PlayoffTeam[] = teams
      .filter(t => !divWinnerIds.has(t.id))
      .sort((a, b) => b.percentage - a.percentage || b.wins - a.wins)
      .slice(0, 3)
      .map(t => this.toPlayoffTeam(t, false, 0));

    // Asignar seeds finales 1-7
    const all = [...divWinners, ...wildCards];
    return all.map((t, i) => ({ ...t, seed: i + 1 }));
  }

  private toPlayoffTeam(
    s: Standing,
    isDivisionWinner: boolean,
    seed: number
  ): PlayoffTeam {
    return {
      id:               s.id,
      name:             s.name,
      abbreviation:     s.abbreviation,
      logo:             s.logo,
      conference:       s.conference,
      division:         s.division,
      wins:             s.wins,
      losses:           s.losses,
      ties:             s.ties,
      percentage:       s.percentage,
      seed,
      isDivisionWinner,
      isProjected:      true,
    };
  }

  // ── Wild Card: seed 2 bye, 3v6, 4v5, 2 tiene bye implícito
  // Formato NFL: (2) bye, (3)v(6), (4)v(5), (1) bye — seeds 1 y 2 tienen bye

  private buildWildCard(
    seeds: PlayoffTeam[],
    conf: 'AFC' | 'NFC'
  ): PlayoffMatchup[] {
    const s = (n: number) => seeds.find(t => t.seed === n) ?? null;
    return [
      { id: `${conf}-wc-1`, home: s(2), away: s(7), winner: null, round: 'wildcard', conference: conf },
      { id: `${conf}-wc-2`, home: s(3), away: s(6), winner: null, round: 'wildcard', conference: conf },
      { id: `${conf}-wc-3`, home: s(4), away: s(5), winner: null, round: 'wildcard', conference: conf },
    ];
  }

  // ── Divisional: seed 1 vs peor wild card winner, seed 2 vs mejor wild card winner

  private buildDivisional(
    seeds: PlayoffTeam[],
    wildCard: PlayoffMatchup[],
    conf: 'AFC' | 'NFC'
  ): PlayoffMatchup[] {
    const s = (n: number) => seeds.find(t => t.seed === n) ?? null;
    return [
      {
        id: `${conf}-div-1`,
        home: s(1),
        away: wildCard[2].home,  // ganador de (4v5) — menor seed wc
        winner: null,
        round: 'divisional',
        conference: conf,
      },
      {
        id: `${conf}-div-2`,
        home: s(2),
        away: wildCard[0].home,  // ganador de (2v7) — mayor seed wc
        winner: null,
        round: 'divisional',
        conference: conf,
      },
    ];
  }

  private buildChampionship(
    divisional: PlayoffMatchup[],
    conf: 'AFC' | 'NFC'
  ): PlayoffMatchup {
    return {
      id: `${conf}-champ`,
      home: divisional[0].home,
      away: divisional[1].home,
      winner: null,
      round: 'championship',
      conference: conf,
    };
  }
}
