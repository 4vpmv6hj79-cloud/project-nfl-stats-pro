import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { TeamScenarioService } from '../../core/services/api/team-scenario.service';
import { FavoritesService } from '../../core/services/favorites.service';
import {
  NotificationPreferencesService,
  NotificationPreferences,
} from '../../core/services/notification-preferences.service';
import { GameWatcherService } from '../../core/services/game-watcher.service';
import { ShareService } from '../../core/services/share.service';
import {
  TeamScenario,
  ClinchAnalysis,
} from '../../shared/models/domain/team-scenario.model';

@Component({
  selector: 'app-team-scenarios',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  templateUrl: './team-scenarios.html',
  styleUrl: './team-scenarios.scss',
})
export class TeamScenariosComponent implements OnInit {
  private readonly scenarioService = inject(TeamScenarioService);
  private readonly favoritesService = inject(FavoritesService);
  readonly notifications = inject(NotificationPreferencesService);
  private readonly gameWatcher = inject(GameWatcherService);
  readonly shareService = inject(ShareService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly allScenarios = signal<TeamScenario[]>([]);
  readonly selectedTeamId = signal<number | null>(null);

  /** Análisis de clinch cargados por equipo (teamId -> analysis) */
  readonly clinchAnalyses = signal<Record<number, ClinchAnalysis>>({});
  /** Equipos con análisis en carga */
  readonly loadingClinch = signal<Record<number, boolean>>({});

  /** Lista de preferencias de notificación para la UI */
  readonly notificationOptions: { key: keyof NotificationPreferences; label: string; icon: string }[] = [
    { key: 'gameStart', label: 'Inicio del partido', icon: 'sports_football' },
    { key: 'touchdowns', label: 'Touchdowns', icon: 'sports_score' },
    { key: 'finalScore', label: 'Resultado final', icon: 'flag' },
    { key: 'redZone', label: 'Zona roja', icon: 'warning' },
  ];

  /** Equipos favoritos que tienen escenario */
  readonly favoriteScenarios = computed<TeamScenario[]>(() => {
    const favs = this.favoritesService.favorites();
    const favIds = new Set(favs.map(f => f.id));
    return this.allScenarios().filter(s => favIds.has(s.teamId));
  });

  /** Equipo seleccionado manualmente en el dropdown */
  readonly selectedScenario = computed<TeamScenario | null>(() => {
    const id = this.selectedTeamId();
    if (id === null) return null;
    return this.allScenarios().find(s => s.teamId === id) ?? null;
  });

  /** Lista de equipos ordenada alfabéticamente para el selector */
  readonly teamsForSelect = computed(() => {
    return [...this.allScenarios()].sort((a, b) =>
      a.teamName.localeCompare(b.teamName)
    );
  });

  /** Escenarios a mostrar: favoritos + seleccionado manual (sin duplicar) */
  readonly displayScenarios = computed<TeamScenario[]>(() => {
    const favorites = this.favoriteScenarios();
    const selected = this.selectedScenario();

    if (!selected) return favorites;

    const alreadyShown = favorites.some(s => s.teamId === selected.teamId);
    if (alreadyShown) return favorites;

    return [selected, ...favorites];
  });

  readonly hasFavorites = computed(() =>
    this.favoritesService.favorites().length > 0
  );

  /**
   * Verifica si la temporada ya comenzó.
   * Si ningún equipo ha jugado partidos (todos en 0-0-0),
   * significa que la temporada regular aún no arranca.
   */
  readonly seasonStarted = computed<boolean>(() => {
    const scenarios = this.allScenarios();
    if (scenarios.length === 0) return false;

    return scenarios.some(
      s => s.wins > 0 || s.losses > 0 || s.ties > 0
    );
  });

  ngOnInit(): void {
    this.scenarioService.getScenarios().subscribe({
      next: scenarios => {
        this.allScenarios.set(scenarios);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  onTeamSelect(teamId: number): void {
    this.selectedTeamId.set(teamId);
  }

  /** Carga el análisis de clinch de un equipo bajo demanda */
  loadClinchAnalysis(teamId: number): void {
    // Ya cargado o cargando
    if (this.clinchAnalyses()[teamId] || this.loadingClinch()[teamId]) {
      return;
    }

    this.loadingClinch.update(state => ({ ...state, [teamId]: true }));

    this.scenarioService.getClinchAnalysis(teamId, this.allScenarios()).subscribe({
      next: analysis => {
        this.clinchAnalyses.update(state => ({ ...state, [teamId]: analysis }));
        this.loadingClinch.update(state => ({ ...state, [teamId]: false }));
      },
      error: () => {
        this.loadingClinch.update(state => ({ ...state, [teamId]: false }));
      },
    });
  }

  getClinch(teamId: number): ClinchAnalysis | null {
    return this.clinchAnalyses()[teamId] ?? null;
  }

  isLoadingClinch(teamId: number): boolean {
    return this.loadingClinch()[teamId] ?? false;
  }

  scenarioTypeClass(type: string): string {
    switch (type) {
      case 'clinch': return 'scenario--clinch';
      case 'help': return 'scenario--help';
      case 'eliminate': return 'scenario--eliminate';
      default: return '';
    }
  }

  shareTeam(team: TeamScenario): void {
    const record = `${team.wins}-${team.losses}${team.ties > 0 ? '-' + team.ties : ''}`;
    this.shareService.share({
      title: 'Centro NFL',
      text: `🏈 ${team.teamName} (${record}) · ${team.statusLabel} · ${team.playoffProbability}% de probabilidad de playoffs`,
    });
  }

  async enableNotifications(): Promise<void> {
    const granted = await this.notifications.requestPermission();
    if (granted) {
      this.gameWatcher.start();
    }
  }

  togglePreference(key: keyof NotificationPreferences, value: boolean): void {
    this.notifications.updatePreference(key, value);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'clinched-division':
      case 'clinched-playoff':
        return 'status--clinched';
      case 'in-hunt':
        return 'status--hunt';
      case 'bubble':
        return 'status--bubble';
      case 'longshot':
        return 'status--longshot';
      case 'eliminated':
        return 'status--eliminated';
      default:
        return '';
    }
  }

  probabilityColor(probability: number): string {
    if (probability >= 75) return 'prob--high';
    if (probability >= 45) return 'prob--medium';
    if (probability >= 20) return 'prob--low';
    return 'prob--verylow';
  }
}
