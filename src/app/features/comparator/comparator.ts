import {
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { PlayerService } from '../../core/services/api/player.service';
import {
  PlayerSearchResult,
  PlayerProfile,
  PlayerStat,
} from '../../shared/models/domain/player-stats.model';

@Component({
  selector: 'app-comparator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './comparator.html',
  styleUrl: './comparator.scss',
})
export class ComparatorComponent {
  private readonly playerService = inject(PlayerService);

  // Search state
  readonly searchQueryA = signal('');
  readonly searchQueryB = signal('');
  readonly searchResultsA = signal<PlayerSearchResult[]>([]);
  readonly searchResultsB = signal<PlayerSearchResult[]>([]);
  readonly showResultsA = signal(false);
  readonly showResultsB = signal(false);

  // Selected players
  readonly playerA = signal<PlayerProfile | null>(null);
  readonly playerB = signal<PlayerProfile | null>(null);
  readonly loadingA = signal(false);
  readonly loadingB = signal(false);

  // Search subjects for debounce
  private searchSubjectA = new Subject<string>();
  private searchSubjectB = new Subject<string>();

  constructor() {
    this.searchSubjectA.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(query => this.playerService.searchPlayers(query)),
    ).subscribe(results => {
      this.searchResultsA.set(results);
      this.showResultsA.set(results.length > 0);
    });

    this.searchSubjectB.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(query => this.playerService.searchPlayers(query)),
    ).subscribe(results => {
      this.searchResultsB.set(results);
      this.showResultsB.set(results.length > 0);
    });
  }

  onSearchA(query: string): void {
    this.searchQueryA.set(query);
    if (query.length >= 2) {
      this.searchSubjectA.next(query);
    } else {
      this.searchResultsA.set([]);
      this.showResultsA.set(false);
    }
  }

  onSearchB(query: string): void {
    this.searchQueryB.set(query);
    if (query.length >= 2) {
      this.searchSubjectB.next(query);
    } else {
      this.searchResultsB.set([]);
      this.showResultsB.set(false);
    }
  }

  selectPlayerA(result: PlayerSearchResult): void {
    this.searchQueryA.set(result.displayName);
    this.showResultsA.set(false);
    this.loadingA.set(true);

    this.playerService.getPlayerStats(result.id).subscribe({
      next: profile => {
        this.playerA.set(profile);
        this.loadingA.set(false);
      },
      error: () => this.loadingA.set(false),
    });
  }

  selectPlayerB(result: PlayerSearchResult): void {
    this.searchQueryB.set(result.displayName);
    this.showResultsB.set(false);
    this.loadingB.set(true);

    this.playerService.getPlayerStats(result.id).subscribe({
      next: profile => {
        this.playerB.set(profile);
        this.loadingB.set(false);
      },
      error: () => this.loadingB.set(false),
    });
  }

  clearPlayerA(): void {
    this.playerA.set(null);
    this.searchQueryA.set('');
    this.searchResultsA.set([]);
  }

  clearPlayerB(): void {
    this.playerB.set(null);
    this.searchQueryB.set('');
    this.searchResultsB.set([]);
  }

  /** Obtiene las stats en común entre ambos jugadores para comparar */
  get commonStats(): { label: string; displayName: string; valueA: string; valueB: string }[] {
    const a = this.playerA();
    const b = this.playerB();
    if (!a || !b) return [];

    const statsMapB = new Map(b.stats.map(s => [s.name, s.value]));

    return a.stats
      .filter(s => statsMapB.has(s.name))
      .map(s => ({
        label: s.label,
        displayName: s.displayName,
        valueA: s.value,
        valueB: statsMapB.get(s.name) ?? '-',
      }));
  }

  /** Calcula quién tiene mejor valor numérico (mayor = mejor para la mayoría) */
  compareValues(valueA: string, valueB: string, statName: string): 'a' | 'b' | 'tie' {
    const numA = parseFloat(valueA.replace(/,/g, ''));
    const numB = parseFloat(valueB.replace(/,/g, ''));

    if (isNaN(numA) || isNaN(numB)) return 'tie';

    // Stats donde MENOR es mejor
    const lowerIsBetter = ['interceptions', 'sacks', 'fumblesLost'];
    const isLower = lowerIsBetter.some(s => statName.toLowerCase().includes(s));

    if (isLower) {
      return numA < numB ? 'a' : numA > numB ? 'b' : 'tie';
    }

    return numA > numB ? 'a' : numA < numB ? 'b' : 'tie';
  }

  /** Calcula el % para la barra visual de comparación */
  barWidth(valueA: string, valueB: string): { a: number; b: number } {
    const numA = parseFloat(valueA.replace(/,/g, '')) || 0;
    const numB = parseFloat(valueB.replace(/,/g, '')) || 0;
    const total = numA + numB;

    if (total === 0) return { a: 50, b: 50 };

    return {
      a: Math.round((numA / total) * 100),
      b: Math.round((numB / total) * 100),
    };
  }
}
