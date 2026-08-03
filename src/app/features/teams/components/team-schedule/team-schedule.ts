import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { ScheduleGame } from '../../../../shared/models/domain/schedule-game.model';

type HomeAwayFilter = 'ALL' | 'home' | 'away';

@Component({
  selector: 'app-team-schedule',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonToggleModule,
  ],
  templateUrl: './team-schedule.html',
  styleUrl: './team-schedule.scss',
})
export class TeamScheduleComponent {

  @Input({ required: true }) set games(value: ScheduleGame[]) {
    this._games.set(value);
  }

  private _games = signal<ScheduleGame[]>([]);

  filter = signal<HomeAwayFilter>('ALL');

  filtered = computed(() => {
    const f = this.filter();
    const all = this._games();
    return f === 'ALL' ? all : all.filter(g => g.homeAway === f);
  });

  // Resumen rápido W-L-T
  record = computed(() => {
    const played = this._games().filter(g => g.result !== null);
    const w = played.filter(g => g.result === 'W').length;
    const l = played.filter(g => g.result === 'L').length;
    const t = played.filter(g => g.result === 'T').length;
    return { w, l, t, played: played.length, total: this._games().length };
  });

  onFilterChange(value: HomeAwayFilter): void {
    this.filter.set(value);
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', {
      weekday: 'short',
      month:   'short',
      day:     'numeric',
    });
  }

  resultClass(result: ScheduleGame['result']): string {
    if (result === 'W') return 'result--win';
    if (result === 'L') return 'result--loss';
    if (result === 'T') return 'result--tie';
    return '';
  }

}
