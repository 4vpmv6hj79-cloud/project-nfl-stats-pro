import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { Player } from '../../../../shared/models/domain/player.model';

@Component({
  selector: 'app-team-roster',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonToggleModule,
  ],
  templateUrl: './team-roster.html',
  styleUrl: './team-roster.scss',
})
export class TeamRosterComponent {

  @Input({ required: true }) set players(value: Player[]) {
    this._players.set(value);
  }

  private _players = signal<Player[]>([]);

  positionFilter = signal<string>('ALL');

  // Lista única de posiciones para el filtro
  positions = computed(() =>
    ['ALL', ...new Set(this._players().map(p => p.positionAbbr).filter(Boolean))]
  );

  filtered = computed(() => {
    const pos = this.positionFilter();
    return pos === 'ALL'
      ? this._players()
      : this._players().filter(p => p.positionAbbr === pos);
  });

  injured = computed(() =>
    this._players().filter(p => p.injuryStatus && p.injuryStatus !== 'Active')
  );

  onPositionChange(pos: string): void {
    this.positionFilter.set(pos);
  }

  injuryClass(status: Player['injuryStatus']): string {
    const map: Record<string, string> = {
      'Out':          'badge--out',
      'IR':           'badge--ir',
      'Doubtful':     'badge--doubtful',
      'Questionable': 'badge--questionable',
      'PUP':          'badge--pup',
      'Suspended':    'badge--suspended',
    };
    return map[status] ?? '';
  }

}
