import {
  GameDetail,
  GameDetailTeam,
  GameDrive,
  ScoringPlay,
  GameLeader,
  MomentumPoint,
} from '../../models/domain/game-detail.model';

export class GameDetailAdapter {

  static adapt(response: any): GameDetail {
    const header = response?.header?.competitions?.[0];
    const competition = header ?? {};

    const homeComp = competition.competitors?.find((c: any) => c.homeAway === 'home');
    const awayComp = competition.competitors?.find((c: any) => c.homeAway === 'away');

    // Estadísticas de equipo del boxscore (incluye castigos)
    const boxscoreTeams = response?.boxscore?.teams ?? [];

    const homeTeam = this.buildTeam(homeComp, 'home', boxscoreTeams);
    const awayTeam = this.buildTeam(awayComp, 'away', boxscoreTeams);

    const status = competition.status?.type?.shortDetail ?? '';
    const statusState = this.resolveState(competition.status?.type?.state);

    // Drives
    const rawDrives = response?.drives?.previous ?? [];
    const drives = rawDrives
      .map((d: any) => this.buildDrive(d))
      .reverse(); // Más reciente primero

    // Scoring Plays
    const rawScoringPlays = response?.scoringPlays ?? [];
    const scoringPlays = rawScoringPlays.map((sp: any) => this.buildScoringPlay(sp));

    // Win Probability (momentum)
    const rawWP = response?.winprobability ?? [];
    const momentum: MomentumPoint[] = rawWP.map((wp: any) => ({
      homeWinPercentage: wp.homeWinPercentage ?? 0.5,
      playId: wp.playId,
    }));

    const currentHomeWinPct = momentum.length > 0
      ? momentum[momentum.length - 1].homeWinPercentage
      : 0.5;

    // Leaders
    const rawLeaders = response?.leaders ?? [];
    const homeLeaders = this.buildLeaders(rawLeaders, homeComp?.id);
    const awayLeaders = this.buildLeaders(rawLeaders, awayComp?.id);

    // Situación en vivo
    const situation = response?.situation ?? competition?.situation;
    const possession = this.resolvePossession(situation, homeComp?.id, awayComp?.id);

    // Última jugada y detección de castigo (bandera amarilla)
    const lastPlay = situation?.lastPlay;
    const lastPlayText = lastPlay?.text ?? undefined;
    const penalty = this.detectPenalty(lastPlay);

    // Venue
    const venue = response?.gameInfo?.venue?.fullName ?? '';

    return {
      id: competition.id ?? response?.header?.id ?? '',
      status,
      statusState,
      quarter: competition.status?.period,
      clock: competition.status?.type?.detail,
      venue,
      homeTeam,
      awayTeam,
      momentum,
      currentHomeWinPct,
      drives,
      scoringPlays,
      homeLeaders,
      awayLeaders,
      possession,
      downDistanceText: situation?.downDistanceText?.replace(' at ', ' en ') ?? undefined,
      isRedZone: situation?.isRedZone ?? undefined,
      lastPlayText,
      hasPenalty: penalty.has,
      penaltyText: penalty.text,
      penaltyYardsLast: penalty.yards,
    };
  }

  /**
   * Traducciones de los castigos más comunes de la NFL al español.
   * La clave es el término en inglés (en minúsculas) y el valor su
   * equivalente en español.
   */
  private static readonly PENALTY_TRANSLATIONS: [RegExp, string][] = [
    [/false start/i, 'Salida en falso'],
    [/offside/i, 'Fuera de lugar (offside)'],
    [/neutral zone infraction/i, 'Infracción en zona neutral'],
    [/encroachment/i, 'Invasión (encroachment)'],
    [/delay of game/i, 'Demora de juego'],
    [/offensive holding/i, 'Sujeción ofensiva'],
    [/defensive holding/i, 'Sujeción defensiva'],
    [/holding/i, 'Sujeción (holding)'],
    [/defensive pass interference/i, 'Interferencia de pase defensiva'],
    [/offensive pass interference/i, 'Interferencia de pase ofensiva'],
    [/pass interference/i, 'Interferencia de pase'],
    [/illegal (block|use of hands)/i, 'Bloqueo ilegal'],
    [/illegal (formation|shift|motion)/i, 'Formación/movimiento ilegal'],
    [/illegal contact/i, 'Contacto ilegal'],
    [/face ?mask/i, 'Máscara (face mask)'],
    [/roughing the passer/i, 'Rudeza contra el pasador'],
    [/roughing the kicker/i, 'Rudeza contra el pateador'],
    [/unnecessary roughness/i, 'Rudeza innecesaria'],
    [/unsportsmanlike conduct/i, 'Conducta antideportiva'],
    [/personal foul/i, 'Falta personal'],
    [/intentional grounding/i, 'Lanzamiento intencional al vacío'],
    [/too many men|12 men/i, 'Demasiados jugadores en el campo'],
    [/illegal formation/i, 'Formación ilegal'],
    [/taunting/i, 'Provocación (taunting)'],
    [/horse ?collar/i, 'Tackle por el cuello (horse collar)'],
    [/tripping/i, 'Zancadilla'],
    [/clipping/i, 'Bloqueo por la espalda'],
    [/chop block/i, 'Bloqueo bajo (chop block)'],
    [/ineligible (receiver|downfield)/i, 'Receptor no elegible'],
  ];

  /** Traduce el nombre del castigo detectado dentro del texto al español. */
  private static translatePenalty(text: string): string {
    for (const [pattern, es] of GameDetailAdapter.PENALTY_TRANSLATIONS) {
      if (pattern.test(text)) {
        return es;
      }
    }
    return 'Castigo';
  }

  /**
   * Detecta si la última jugada fue un castigo (bandera amarilla) y extrae
   * su descripción (traducida) y las yardas. ESPN marca el tipo de jugada o
   * incluye la palabra "PENALTY"/"Penalty" en el texto de la jugada.
   */
  private static detectPenalty(lastPlay: any): {
    has: boolean;
    text?: string;
    yards?: number;
  } {
    if (!lastPlay) return { has: false };

    const typeText = String(lastPlay.type?.text ?? '').toLowerCase();
    const playText = String(lastPlay.text ?? '');
    const isPenalty =
      typeText.includes('penalty') || /penalty/i.test(playText);

    if (!isPenalty) return { has: false };

    // Intentar extraer las yardas del texto, ej. "...penalty 10 yards..."
    const match = playText.match(/(\d+)\s*yard/i);
    const yards = match ? Number(match[1]) : undefined;

    // Traducir el nombre del castigo al español
    const text = GameDetailAdapter.translatePenalty(playText);

    return { has: true, text, yards };
  }

  private static buildTeam(comp: any, side: string, boxscoreTeams: any[] = []): GameDetailTeam {
    const team = comp?.team ?? {};
    const record = comp?.record?.[0]?.summary ?? comp?.record ?? '0-0';

    const teamId = comp?.id ?? team?.id ?? '';
    const penalties = this.extractPenalties(boxscoreTeams, teamId);

    return {
      id: teamId,
      name: team?.displayName ?? team?.name ?? '',
      abbreviation: team?.abbreviation ?? '',
      logo: team?.logos?.[0]?.href ?? team?.logo ?? '',
      score: Number(comp?.score ?? 0),
      record: typeof record === 'string' ? record : '0-0',
      color: team?.color,
      penalties: penalties?.count,
      penaltyYards: penalties?.yards,
    };
  }

  /**
   * Extrae castigos y yardas de castigo del boxscore para un equipo.
   * ESPN los reporta como una estadística "totalPenaltiesYards" con
   * displayValue en formato "5-45" (castigos-yardas).
   */
  private static extractPenalties(
    boxscoreTeams: any[],
    teamId: string,
  ): { count: number; yards: number } | undefined {
    const teamStats = boxscoreTeams.find(
      (t: any) => String(t.team?.id) === String(teamId),
    );
    if (!teamStats?.statistics) return undefined;

    const penaltyStat = teamStats.statistics.find(
      (s: any) =>
        s.name === 'totalPenaltiesYards' ||
        s.name === 'totalPenalties' ||
        /penalt/i.test(s.name ?? ''),
    );
    if (!penaltyStat) return undefined;

    // displayValue típico: "5-45" (castigos-yardas)
    const value = String(penaltyStat.displayValue ?? '');
    const match = value.match(/(\d+)\s*-\s*(\d+)/);
    if (match) {
      return { count: Number(match[1]), yards: Number(match[2]) };
    }

    return undefined;
  }

  private static buildDrive(d: any): GameDrive {
    const team = d.team ?? {};
    return {
      id: d.id ?? '',
      teamAbbr: team.abbreviation ?? '',
      teamName: team.displayName ?? '',
      result: d.result ?? d.displayResult ?? '',
      shortResult: d.shortDisplayResult ?? d.result ?? '',
      description: d.description ?? '',
      yards: d.yards ?? 0,
      plays: d.offensivePlays ?? 0,
      isScore: d.isScore ?? false,
    };
  }

  private static buildScoringPlay(sp: any): ScoringPlay {
    const team = sp.team ?? {};
    return {
      id: sp.id ?? '',
      text: sp.text ?? '',
      type: typeof sp.type === 'object' ? sp.type?.text ?? '' : sp.type ?? '',
      teamName: team.displayName ?? '',
      teamAbbr: team.abbreviation ?? '',
      homeScore: sp.homeScore ?? 0,
      awayScore: sp.awayScore ?? 0,
      quarter: typeof sp.period === 'object' ? sp.period?.number ?? 0 : sp.period ?? 0,
      clock: typeof sp.clock === 'object' ? sp.clock?.displayValue ?? '' : sp.clock ?? '',
    };
  }

  private static buildLeaders(rawLeaders: any[], teamId: string): GameLeader[] {
    const teamLeaderGroup = rawLeaders.find(
      (lg: any) => String(lg.team?.id) === String(teamId)
    );

    if (!teamLeaderGroup || !teamLeaderGroup.leaders) {
      return [];
    }

    const results: GameLeader[] = [];

    for (const category of teamLeaderGroup.leaders) {
      const topLeader = category.leaders?.[0];
      if (!topLeader) continue;

      results.push({
        category: category.displayName ?? category.name ?? '',
        athleteName: topLeader.athlete?.displayName ?? '',
        athletePhoto: topLeader.athlete?.headshot ?? topLeader.athlete?.links?.[0]?.href,
        displayValue: topLeader.displayValue ?? '',
        teamAbbr: teamLeaderGroup.team?.abbreviation ?? '',
      });
    }

    return results;
  }

  private static resolvePossession(
    situation: any,
    homeId: string,
    awayId: string,
  ): 'home' | 'away' | undefined {
    const possId = situation?.possession;
    if (!possId) return undefined;

    if (String(possId) === String(homeId)) return 'home';
    if (String(possId) === String(awayId)) return 'away';
    return undefined;
  }

  private static resolveState(state: string | undefined): 'pre' | 'in' | 'post' | 'unknown' {
    if (state === 'pre' || state === 'in' || state === 'post') return state;
    return 'unknown';
  }
}
