import {
  Component,
  effect,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { PoolService } from '../../core/services/pool.service';
import { ShareService } from '../../core/services/share.service';
import { NotificationService } from '../../core/services/api/notification.service';
import {
  PoolGamesService,
  PoolGame,
} from '../../core/services/api/pool-games.service';
import {
  Pool,
  PoolMember,
  UserPredictions,
} from '../../shared/models/domain/pool.model';

type View = 'list' | 'detail';
type Tab = 'picks' | 'compare' | 'ranking';

@Component({
  selector: 'app-pool',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './pool.html',
  styleUrl: './pool.scss',
})
export class PoolComponent {
  private readonly authService = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly poolGames = inject(PoolGamesService);
  private readonly shareService = inject(ShareService);
  private readonly notification = inject(NotificationService);

  readonly isAuthenticated = computed(() => this.authService.isAuthenticated);
  readonly authLoading = this.authService.loading;
  private readonly currentUid = computed(() => this.authService.user()?.uid ?? null);

  readonly view = signal<View>('list');
  readonly tab = signal<Tab>('picks');
  readonly loading = signal(false);
  readonly listError = signal(false);
  readonly detailError = signal(false);
  readonly loadingDetail = signal(false);
  readonly gamesError = signal(false);
  readonly compareError = signal(false);
  readonly rankingError = signal(false);
  readonly loadingRanking = signal(false);
  readonly working = signal(false);

  // Lista de grupos
  readonly myPools = signal<Pool[]>([]);
  readonly newPoolName = signal('');
  readonly joinCode = signal('');

  // Grupo activo
  readonly activePool = signal<Pool | null>(null);
  readonly members = signal<PoolMember[]>([]);
  readonly myPredictions = signal<UserPredictions | null>(null);

  // Comparación: predicciones de TODOS los miembros
  readonly allPredictions = signal<UserPredictions[]>([]);
  readonly loadingCompare = signal(false);

  // Predicciones (ronda seleccionada)
  readonly selectedRoundId = signal<number>(1);
  readonly weekGames = signal<PoolGame[]>([]);
  readonly loadingGames = signal(false);

  /** Caché en memoria de partidos por ronda (evita re-pedir al cambiar de tab). */
  private readonly roundCache = new Map<number, PoolGame[]>();
  private myPoolsRequestId = 0;
  private detailRequestId = 0;
  private roundRequestId = 0;

  /**
   * Rondas de la quiniela: 18 semanas de temporada regular + playoffs.
   * - id: identificador único de la ronda para guardar la predicción
   *       (regular = 1..18; playoffs usan 101..104 para no colisionar).
   * - apiWeek + seasonType: parámetros para consultar la API de ESPN.
   *   seasonType 2 = temporada regular, 3 = playoffs (incluye Super Bowl).
   */
  readonly rounds: {
    id: number;
    label: string;
    short: string;
    apiWeek: number;
    seasonType: number;
  }[] = [
    ...Array.from({ length: 18 }, (_, i) => ({
      id: i + 1,
      label: `Semana ${i + 1}`,
      short: `${i + 1}`,
      apiWeek: i + 1,
      seasonType: 2,
    })),
    { id: 101, label: 'Wild Card', short: 'WC', apiWeek: 1, seasonType: 3 },
    { id: 102, label: 'Divisional', short: 'DIV', apiWeek: 2, seasonType: 3 },
    { id: 103, label: 'Final de Conferencia', short: 'CONF', apiWeek: 3, seasonType: 3 },
    { id: 104, label: 'Super Bowl', short: 'SB', apiWeek: 5, seasonType: 3 },
  ];

  readonly activeRound = computed(() =>
    this.rounds.find((r) => r.id === this.selectedRoundId()) ?? this.rounds[0],
  );

  constructor() {
    effect(() => {
      if (this.authLoading()) return;
      const uid = this.currentUid();
      this.myPoolsRequestId++;
      this.myPools.set([]);
      this.backToList();
      if (uid) {
        void this.loadMyPools();
      } else {
        this.loading.set(false);
        this.listError.set(false);
      }
    });
  }

  // ── Lista de grupos ─────────────────────────────────────

  async loadMyPools(): Promise<void> {
    const uid = this.currentUid();
    if (!uid) return;
    const requestId = ++this.myPoolsRequestId;
    this.loading.set(true);
    this.listError.set(false);
    try {
      const pools = await this.poolService.getMyPools(uid);
      if (requestId === this.myPoolsRequestId && this.currentUid() === uid) {
        this.myPools.set(pools);
      }
    } catch {
      if (requestId === this.myPoolsRequestId && this.currentUid() === uid) {
        this.listError.set(true);
      }
    } finally {
      if (requestId === this.myPoolsRequestId && this.currentUid() === uid) {
        this.loading.set(false);
      }
    }
  }

  async createPool(): Promise<void> {
    const name = this.newPoolName().trim();
    if (!name || this.working()) return;

    this.working.set(true);
    try {
      const pool = await this.poolService.createPool(name);
      if (pool) {
        this.newPoolName.set('');
        this.notification.success(
          `¡Quiniela creada! Comparte el código ${pool.code} con tus amigos.`,
        );
        await this.loadMyPools();
        this.openPool(pool);
      } else {
        this.notification.error('No se pudo crear la quiniela. Intenta de nuevo.');
      }
    } catch (e: any) {
      // Mensaje claro según el tipo de error (permisos de Firestore, etc.)
      const msg = String(e?.code ?? e?.message ?? '');
      if (msg.includes('permission') || msg.includes('insufficient')) {
        this.notification.error(
          'Permisos de Firestore insuficientes. Revisa las reglas de la colección "pools".',
        );
      } else {
        this.notification.error('No se pudo crear la quiniela. Intenta de nuevo.');
      }
    } finally {
      this.working.set(false);
    }
  }

  async joinPool(): Promise<void> {
    const code = this.joinCode().trim().toUpperCase();
    if (!code || this.working()) return;

    this.working.set(true);
    const pool = await this.poolService.joinPoolByCode(code);
    this.working.set(false);

    if (pool) {
      this.joinCode.set('');
      this.notification.success(`¡Te uniste a "${pool.name}"!`);
      await this.loadMyPools();
      this.openPool(pool);
    } else {
      this.notification.error('No encontramos una quiniela con ese código.');
    }
  }

  // ── Grupo activo ────────────────────────────────────────

  async openPool(pool: Pool): Promise<void> {
    const requestId = ++this.detailRequestId;
    this.activePool.set(pool);
    this.view.set('detail');
    this.tab.set('picks');
    this.roundCache.clear();
    this.roundRequestId++;
    this.weekGames.set([]);
    this.members.set([]);
    this.myPredictions.set(null);
    this.loadingDetail.set(true);
    this.detailError.set(false);

    try {
      // Cargar predicciones, miembros y semana vigente a la vez.
      const [preds, members, currentWeek] = await Promise.all([
        this.poolService.getMyPredictions(pool.id),
        this.poolService.getMembers(pool.id),
        firstValueFrom(this.poolGames.getCurrentWeek()).catch(() => null),
      ]);
      if (requestId !== this.detailRequestId) return;
      this.myPredictions.set(preds);
      this.members.set(members);

      const roundId = currentWeek
        ? this.resolveRoundId(currentWeek.week, currentWeek.seasonType)
        : this.selectedRoundId();
      this.selectedRoundId.set(roundId);
      this.loadRound(roundId);
    } catch {
      if (requestId === this.detailRequestId) this.detailError.set(true);
    } finally {
      if (requestId === this.detailRequestId) this.loadingDetail.set(false);
    }
  }

  /** Traduce (week, seasonType) de ESPN al id de ronda de la quiniela. */
  private resolveRoundId(week: number, seasonType: number): number {
    if (seasonType === 3) {
      // Playoffs: apiWeek 1..5 → rondas 101..104 (5 = Super Bowl → 104)
      const match = this.rounds.find(
        (r) => r.seasonType === 3 && r.apiWeek === week,
      );
      return match?.id ?? 101;
    }
    // Temporada regular: la ronda id coincide con el número de semana (1..18)
    if (week >= 1 && week <= 18) return week;
    return 1;
  }

  backToList(): void {
    this.detailRequestId++;
    this.roundRequestId++;
    this.view.set('list');
    this.activePool.set(null);
    this.weekGames.set([]);
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'ranking') {
      this.refreshRanking();
    } else if (tab === 'compare') {
      this.loadComparison();
    }
  }

  /** Carga las predicciones de todos los miembros para comparar. */
  async loadComparison(): Promise<void> {
    const pool = this.activePool();
    if (!pool) return;

    this.loadingCompare.set(true);
    this.compareError.set(false);
    try {
      const [preds, members] = await Promise.all([
        this.poolService.getAllPredictions(pool.id),
        this.poolService.getMembers(pool.id),
      ]);
      this.allPredictions.set(preds);
      this.members.set(members);
      // Asegurar que los partidos de la ronda actual estén cargados
      if (this.weekGames().length === 0) {
        this.loadRound(this.selectedRoundId());
      }
    } catch {
      this.compareError.set(true);
    } finally {
      this.loadingCompare.set(false);
    }
  }

  /** Devuelve el pick de un miembro para un partido (o null). */
  memberPick(uid: string, gameId: string): 'home' | 'away' | null {
    const up = this.allPredictions().find((p) => p.uid === uid);
    return up?.picks?.[gameId]?.pick ?? null;
  }

  /**
   * Indica si el pick de un miembro puede revelarse en "Comparar".
   * Regla: los pronósticos de los DEMÁS solo se muestran una vez que el
   * partido ya comenzó, para que nadie copie picks antes del juego.
   * El propio usuario siempre ve sus pronósticos.
   */
  canRevealPick(uid: string, game: PoolGame): boolean {
    if (game.started) return true;
    return uid === this.authService.user()?.uid;
  }

  /** Abreviatura a mostrar según el pick del miembro en un partido. */
  memberPickLabel(uid: string, game: PoolGame): string {
    if (!this.canRevealPick(uid, game)) return '🔒';
    const pick = this.memberPick(uid, game.id);
    if (pick === 'home') return game.homeAbbr;
    if (pick === 'away') return game.awayAbbr;
    return '—';
  }

  /** ¿El pick de ese miembro fue correcto/incorrecto? (partido finalizado) */
  memberPickResult(uid: string, game: PoolGame): 'correct' | 'wrong' | null {
    if (!game.isFinal || game.winner === null) return null;
    const pick = this.memberPick(uid, game.id);
    if (!pick) return null;
    return pick === game.winner ? 'correct' : 'wrong';
  }

  // ── Predicciones ────────────────────────────────────────

  selectRound(roundId: number): void {
    this.selectedRoundId.set(roundId);
    this.loadRound(roundId);
  }

  private loadRound(roundId: number): void {
    const round = this.rounds.find((r) => r.id === roundId) ?? this.rounds[0];
    const requestId = ++this.roundRequestId;
    this.gamesError.set(false);
    this.weekGames.set([]);

    // Si ya la tenemos en caché, mostrarla al instante (sin spinner ni red).
    const cached = this.roundCache.get(roundId);
    if (cached) {
      this.weekGames.set(cached);
      this.loadingGames.set(false);
      return;
    }

    this.loadingGames.set(true);
    this.poolGames.getWeekGames(round.apiWeek, round.seasonType).subscribe({
      next: (games) => {
        this.roundCache.set(roundId, games);
        // Solo aplicar el resultado de la última solicitud activa.
        if (requestId === this.roundRequestId && this.selectedRoundId() === roundId) {
          this.weekGames.set(games);
          this.loadingGames.set(false);
        }
      },
      error: () => {
        if (requestId === this.roundRequestId) {
          this.loadingGames.set(false);
          this.gamesError.set(true);
        }
      },
    });
  }

  /** Devuelve la predicción guardada del usuario para un partido. */
  pickFor(gameId: string): 'home' | 'away' | null {
    return this.myPredictions()?.picks?.[gameId]?.pick ?? null;
  }

  /** Guarda una predicción. No se puede cambiar si el partido ya empezó. */
  async pick(game: PoolGame, choice: 'home' | 'away'): Promise<void> {
    const pool = this.activePool();
    if (!pool || game.started) return;

    // Guardamos el id de la RONDA (no el apiWeek), para distinguir
    // temporada regular de playoffs y no mezclar resultados al calcular puntos.
    const roundId = this.selectedRoundId();

    // Actualizar UI de inmediato (optimista)
    const current = this.myPredictions();
    const picks = { ...(current?.picks ?? {}) };
    picks[game.id] = { gameId: game.id, pick: choice, week: roundId };
    this.myPredictions.set({
      uid: current?.uid ?? '',
      displayName: current?.displayName ?? '',
      picks,
      updatedAt: Date.now(),
    });

    await this.poolService.savePick(pool.id, game.id, choice, roundId);
  }

  /** ¿El pronóstico fue correcto? (solo para partidos finalizados) */
  pickResult(game: PoolGame): 'correct' | 'wrong' | null {
    if (!game.isFinal || game.winner === null) return null;
    const pick = this.pickFor(game.id);
    if (!pick) return null;
    return pick === game.winner ? 'correct' : 'wrong';
  }

  // ── Ranking / puntaje ───────────────────────────────────

  /**
   * Recalcula el puntaje de cada miembro comparando sus predicciones
   * con los resultados reales, y refresca la tabla de posiciones.
   *
   * Para no recorrer las 18 semanas en cada carga, calculamos sobre los
   * partidos ya cargados de las semanas que los miembros hayan predicho.
   */
  async refreshRanking(): Promise<void> {
    const pool = this.activePool();
    if (!pool) return;

    this.loadingRanking.set(true);
    this.rankingError.set(false);
    try {
      const [members, allPreds] = await Promise.all([
        this.poolService.getMembers(pool.id),
        this.poolService.getAllPredictions(pool.id),
      ]);

      // Reunir rondas que alguien predijo (1..18 regular, 101..104 playoffs).
      const roundIds = new Set<number>();
      for (const up of allPreds) {
        for (const gameId of Object.keys(up.picks ?? {})) {
          roundIds.add(up.picks[gameId].week);
        }
      }

      // Cargar los resultados reales de esas rondas en paralelo.
      const resultsByGame = new Map<string, 'home' | 'away' | null>();
      const rounds = this.rounds.filter((r) => roundIds.has(r.id));
      // Limitar a cuatro solicitudes simultáneas para evitar saturar la red móvil.
      for (let i = 0; i < rounds.length; i += 4) {
        const batch = await Promise.all(rounds.slice(i, i + 4).map(async (round) => {
          const cached = this.roundCache.get(round.id);
          if (cached) return cached;
          const games = await firstValueFrom(
            this.poolGames.getWeekGames(round.apiWeek, round.seasonType),
          );
          this.roundCache.set(round.id, games);
          return games;
        }));
        for (const games of batch) {
          for (const game of games) {
            if (game.isFinal) resultsByGame.set(game.id, game.winner);
          }
        }
      }

      // Calcular puntaje de cada miembro.
      const updates: Promise<void>[] = [];
      for (const member of members) {
        const up = allPreds.find((p) => p.uid === member.uid);
        let correct = 0;
        let total = 0;
        if (up) {
          for (const gameId of Object.keys(up.picks ?? {})) {
            const realWinner = resultsByGame.get(gameId);
            if (realWinner === undefined) continue; // partido no finalizado
            if (realWinner === null) continue; // empate
            total++;
            if (up.picks[gameId].pick === realWinner) correct++;
          }
        }
        if (
          member.points !== correct ||
          member.correctPicks !== correct ||
          member.totalPicks !== total
        ) {
          updates.push(this.poolService.updateMemberScore(
            pool.id,
            member.uid,
            correct,
            correct,
            total,
          ));
        }
        member.points = correct;
        member.correctPicks = correct;
        member.totalPicks = total;
      }
      members.sort(
        (a, b) => b.points - a.points || b.correctPicks - a.correctPicks,
      );
      if (this.activePool()?.id === pool.id) this.members.set([...members]);
      // La tabla puede mostrarse antes de que terminen las escrituras remotas.
      void Promise.allSettled(updates);
    } catch {
      if (this.activePool()?.id === pool.id) this.rankingError.set(true);
    } finally {
      this.loadingRanking.set(false);
    }
  }

  // ── Compartir ───────────────────────────────────────────

  sharePool(): void {
    const pool = this.activePool();
    if (!pool) return;

    this.shareService.share({
      title: 'Únete a mi quiniela NFL',
      text:
        `🏈 Únete a mi quiniela "${pool.name}" en Centro NFL. ` +
        `Usa el código ${pool.code} para entrar.`,
      url: 'https://project-nfl-stats-pro.vercel.app/quiniela',
    });
  }

  copyCode(): void {
    const pool = this.activePool();
    if (!pool) return;
    navigator.clipboard?.writeText(pool.code).then(
      () => this.notification.success('Código copiado. ¡Compártelo!'),
      () => this.notification.info(`Código: ${pool.code}`),
    );
  }
}
