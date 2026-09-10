import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

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
type Tab = 'picks' | 'ranking';

@Component({
  selector: 'app-pool',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './pool.html',
  styleUrl: './pool.scss',
})
export class PoolComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly poolGames = inject(PoolGamesService);
  private readonly shareService = inject(ShareService);
  private readonly notification = inject(NotificationService);

  readonly isAuthenticated = computed(() => this.authService.isAuthenticated);

  readonly view = signal<View>('list');
  readonly tab = signal<Tab>('picks');
  readonly loading = signal(true);
  readonly working = signal(false);

  // Lista de grupos
  readonly myPools = signal<Pool[]>([]);
  readonly newPoolName = signal('');
  readonly joinCode = signal('');

  // Grupo activo
  readonly activePool = signal<Pool | null>(null);
  readonly members = signal<PoolMember[]>([]);
  readonly myPredictions = signal<UserPredictions | null>(null);

  // Predicciones (semana)
  readonly selectedWeek = signal<number>(1);
  readonly weekGames = signal<PoolGame[]>([]);
  readonly loadingGames = signal(false);

  readonly weeks = Array.from({ length: 18 }, (_, i) => i + 1);

  ngOnInit(): void {
    if (this.isAuthenticated()) {
      this.loadMyPools();
    } else {
      this.loading.set(false);
    }
  }

  // ── Lista de grupos ─────────────────────────────────────

  async loadMyPools(): Promise<void> {
    this.loading.set(true);
    const pools = await this.poolService.getMyPools();
    this.myPools.set(pools);
    this.loading.set(false);
  }

  async createPool(): Promise<void> {
    const name = this.newPoolName().trim();
    if (!name || this.working()) return;

    this.working.set(true);
    const pool = await this.poolService.createPool(name);
    this.working.set(false);

    if (pool) {
      this.newPoolName.set('');
      this.notification.success(`¡Quiniela "${pool.name}" creada!`);
      await this.loadMyPools();
      this.openPool(pool);
    } else {
      this.notification.error('No se pudo crear la quiniela. Intenta de nuevo.');
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
    this.activePool.set(pool);
    this.view.set('detail');
    this.tab.set('picks');

    // Cargar predicciones del usuario y miembros
    const [preds, members] = await Promise.all([
      this.poolService.getMyPredictions(pool.id),
      this.poolService.getMembers(pool.id),
    ]);
    this.myPredictions.set(preds);
    this.members.set(members);

    // Cargar la semana actual (por defecto la 1; el usuario puede cambiar)
    this.loadWeek(this.selectedWeek());
  }

  backToList(): void {
    this.view.set('list');
    this.activePool.set(null);
    this.weekGames.set([]);
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'ranking') {
      this.refreshRanking();
    }
  }

  // ── Predicciones ────────────────────────────────────────

  selectWeek(week: number): void {
    this.selectedWeek.set(week);
    this.loadWeek(week);
  }

  private loadWeek(week: number): void {
    this.loadingGames.set(true);
    this.poolGames.getWeekGames(week).subscribe({
      next: (games) => {
        this.weekGames.set(games);
        this.loadingGames.set(false);
      },
      error: () => {
        this.loadingGames.set(false);
        this.notification.error('No se pudieron cargar los partidos de la semana.');
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

    // Actualizar UI de inmediato (optimista)
    const current = this.myPredictions();
    const picks = { ...(current?.picks ?? {}) };
    picks[game.id] = { gameId: game.id, pick: choice, week: game.week };
    this.myPredictions.set({
      uid: current?.uid ?? '',
      displayName: current?.displayName ?? '',
      picks,
      updatedAt: Date.now(),
    });

    await this.poolService.savePick(pool.id, game.id, choice, game.week);
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

    this.loading.set(true);

    const [members, allPreds] = await Promise.all([
      this.poolService.getMembers(pool.id),
      this.poolService.getAllPredictions(pool.id),
    ]);

    // Reunir todas las semanas que alguien predijo
    const weeksSet = new Set<number>();
    for (const up of allPreds) {
      for (const gameId of Object.keys(up.picks ?? {})) {
        weeksSet.add(up.picks[gameId].week);
      }
    }

    // Cargar los resultados reales de esas semanas
    const resultsByGame = new Map<string, 'home' | 'away' | null>();
    for (const week of weeksSet) {
      const games = await this.fetchWeek(week);
      for (const g of games) {
        if (g.isFinal) resultsByGame.set(g.id, g.winner);
      }
    }

    // Calcular puntaje de cada miembro
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
      // Persistir solo si cambió
      if (
        member.points !== correct ||
        member.correctPicks !== correct ||
        member.totalPicks !== total
      ) {
        await this.poolService.updateMemberScore(
          pool.id,
          member.uid,
          correct,
          correct,
          total,
        );
      }
      member.points = correct;
      member.correctPicks = correct;
      member.totalPicks = total;
    }

    members.sort(
      (a, b) => b.points - a.points || b.correctPicks - a.correctPicks,
    );
    this.members.set([...members]);
    this.loading.set(false);
  }

  private fetchWeek(week: number): Promise<PoolGame[]> {
    return new Promise((resolve) => {
      this.poolGames.getWeekGames(week).subscribe({
        next: (games) => resolve(games),
        error: () => resolve([]),
      });
    });
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
