import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { SimulatorService } from '../../core/services/api/simulator.service';
import { Standing } from '../../shared/models/domain/standing.model';
import {
  SimulatorGame,
  SimulatorStanding,
  SimulatorWeek,
} from '../../shared/models/domain/simulator.model';

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './simulator.html',
  styleUrl: './simulator.scss',
})
export class SimulatorComponent implements OnInit {
  private readonly simulatorService = inject(SimulatorService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly baseStandings = signal<Standing[]>([]);
  readonly weeks = signal<SimulatorWeek[]>([]);
  readonly selectedWeek = signal<number>(1);
  readonly conferenceFilter = signal<'AFC' | 'NFC' | 'all'>('all');

  /** Todos los juegos con sus resultados simulados */
  readonly allGames = computed<SimulatorGame[]>(() => {
    return this.weeks().flatMap(w => w.games);
  });

  /** Juegos de la semana seleccionada */
  readonly currentWeekGames = computed<SimulatorGame[]>(() => {
    const week = this.weeks().find(w => w.number === this.selectedWeek());
    return week?.games ?? [];
  });

  /** Standings recalculados con simulaciones */
  readonly simulatedStandings = computed<SimulatorStanding[]>(() => {
    return this.simulatorService.recalculateStandings(
      this.baseStandings(),
      this.allGames(),
    );
  });

  /** Standings filtrados por conferencia */
  readonly filteredStandings = computed<SimulatorStanding[]>(() => {
    const conf = this.conferenceFilter();
    const standings = this.simulatedStandings();

    if (conf === 'all') {
      return standings.sort((a, b) => {
        if (a.conference !== b.conference) return a.conference.localeCompare(b.conference);
        return a.seed - b.seed;
      });
    }

    return standings
      .filter(s => s.conference === conf)
      .sort((a, b) => a.seed - b.seed);
  });

  /** Semanas disponibles */
  readonly availableWeeks = computed<number[]>(() => {
    return this.weeks().map(w => w.number);
  });

  /** Conteo de juegos simulados */
  readonly simulatedCount = computed<number>(() => {
    return this.allGames().filter(g => !g.isPlayed && g.result !== null).length;
  });

  ngOnInit(): void {
    // Cargar semanas 1-18 (temporada regular NFL)
    const weeksToLoad = Array.from({ length: 18 }, (_, i) => i + 1);

    this.simulatorService.getSimulatorData(weeksToLoad).subscribe({
      next: ({ standings, weeks }) => {
        this.baseStandings.set(standings);
        this.weeks.set(weeks);

        // Seleccionar la primera semana con juegos no jugados
        const firstUnplayed = weeks.find(w =>
          w.games.some(g => !g.isPlayed)
        );
        if (firstUnplayed) {
          this.selectedWeek.set(firstUnplayed.number);
        }

        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  selectWeek(week: number): void {
    this.selectedWeek.set(week);
  }

  toggleResult(game: SimulatorGame): void {
    if (game.isPlayed) return;

    // Ciclo: null -> home -> away -> null
    const newResult: 'home' | 'away' | null =
      game.result === null ? 'home'
      : game.result === 'home' ? 'away'
      : null;

    // Actualizar el juego en la semana correspondiente
    this.weeks.update(weeks =>
      weeks.map(w => ({
        ...w,
        games: w.games.map(g =>
          g.id === game.id ? { ...g, result: newResult } : g
        ),
      }))
    );
  }

  setResult(game: SimulatorGame, result: 'home' | 'away' | null): void {
    if (game.isPlayed) return;

    this.weeks.update(weeks =>
      weeks.map(w => ({
        ...w,
        games: w.games.map(g =>
          g.id === game.id ? { ...g, result } : g
        ),
      }))
    );
  }

  resetAll(): void {
    this.weeks.update(weeks =>
      weeks.map(w => ({
        ...w,
        games: w.games.map(g =>
          g.isPlayed ? g : { ...g, result: null }
        ),
      }))
    );
  }

  resetWeek(): void {
    const weekNum = this.selectedWeek();
    this.weeks.update(weeks =>
      weeks.map(w => {
        if (w.number !== weekNum) return w;
        return {
          ...w,
          games: w.games.map(g =>
            g.isPlayed ? g : { ...g, result: null }
          ),
        };
      })
    );
  }

  onConferenceChange(conf: 'AFC' | 'NFC' | 'all'): void {
    this.conferenceFilter.set(conf);
  }

  seedChangeIcon(change: number): string {
    if (change > 0) return 'arrow_upward';
    if (change < 0) return 'arrow_downward';
    return '';
  }

  seedChangeClass(change: number): string {
    if (change > 0) return 'seed-up';
    if (change < 0) return 'seed-down';
    return '';
  }
}
