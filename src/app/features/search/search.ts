import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { NFLService } from '../../core/services/api/nfl.service';
import { PlayerService } from '../../core/services/api/player.service';
import { Team } from '../../shared/models/domain/team.model';
import { PlayerSearchResult } from '../../shared/models/domain/player-stats.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
  ],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchComponent implements OnInit {
  private readonly nflService = inject(NFLService);
  private readonly playerService = inject(PlayerService);
  private readonly router = inject(Router);

  readonly query = signal('');
  private allTeams = signal<Team[]>([]);
  readonly playerResults = signal<PlayerSearchResult[]>([]);
  readonly searchingPlayers = signal(false);
  readonly hasSearched = signal(false);

  private playerSubject = new Subject<string>();

  /** Equipos que coinciden con la búsqueda (filtrado local) */
  readonly teamResults = computed<Team[]>(() => {
    const q = this.query().toLowerCase().trim();
    if (q.length < 2) return [];

    return this.allTeams()
      .filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.abbreviation.toLowerCase().includes(q)
      )
      .slice(0, 6);
  });

  readonly hasResults = computed(() =>
    this.teamResults().length > 0 || this.playerResults().length > 0
  );

  constructor() {
    this.playerSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(q => {
        this.searchingPlayers.set(true);
        return this.playerService.searchPlayers(q);
      }),
    ).subscribe({
      next: results => {
        this.playerResults.set(results);
        this.searchingPlayers.set(false);
      },
      error: () => this.searchingPlayers.set(false),
    });
  }

  ngOnInit(): void {
    this.nflService.getTeams().subscribe({
      next: teams => this.allTeams.set(teams),
    });
  }

  onSearch(value: string): void {
    this.query.set(value);

    if (value.trim().length >= 2) {
      this.hasSearched.set(true);
      this.playerSubject.next(value.trim());
    } else {
      this.playerResults.set([]);
      this.hasSearched.set(false);
    }
  }

  clear(): void {
    this.query.set('');
    this.playerResults.set([]);
    this.hasSearched.set(false);
  }

  openTeam(team: Team): void {
    this.router.navigate(['/teams', team.id]);
  }

  openPlayer(player: PlayerSearchResult): void {
    // El comparador puede recibir el jugador vía query param
    this.router.navigate(['/comparator'], {
      queryParams: { player: player.id },
    });
  }
}
