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

    const homeTeam = this.buildTeam(homeComp, 'home');
    const awayTeam = this.buildTeam(awayComp, 'away');

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
    };
  }

  private static buildTeam(comp: any, side: string): GameDetailTeam {
    const team = comp?.team ?? {};
    const record = comp?.record?.[0]?.summary ?? comp?.record ?? '0-0';

    return {
      id: comp?.id ?? team?.id ?? '',
      name: team?.displayName ?? team?.name ?? '',
      abbreviation: team?.abbreviation ?? '',
      logo: team?.logos?.[0]?.href ?? team?.logo ?? '',
      score: Number(comp?.score ?? 0),
      record: typeof record === 'string' ? record : '0-0',
      color: team?.color,
    };
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
