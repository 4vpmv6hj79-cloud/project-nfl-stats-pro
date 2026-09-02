import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { OnboardingService } from '../../../core/services/onboarding.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { NFLService } from '../../../core/services/api/nfl.service';
import { Team } from '../../models/domain/team.model';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class OnboardingComponent implements OnInit {
  readonly onboarding = inject(OnboardingService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly nflService = inject(NFLService);

  readonly step = signal<1 | 2>(1);
  readonly teams = signal<Team[]>([]);
  readonly search = signal('');
  readonly selectedIds = signal<Set<number>>(new Set());

  readonly filteredTeams = computed<Team[]>(() => {
    const query = this.search().toLowerCase().trim();
    const teams = [...this.teams()].sort((a, b) => a.name.localeCompare(b.name));

    if (!query) return teams;

    return teams.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.city.toLowerCase().includes(query) ||
      t.abbreviation.toLowerCase().includes(query)
    );
  });

  readonly selectedCount = computed(() => this.selectedIds().size);

  ngOnInit(): void {
    this.onboarding.checkOnboarding();

    if (this.onboarding.showOnboarding()) {
      this.nflService.getTeams().subscribe({
        next: teams => this.teams.set(teams),
      });
    }
  }

  goToTeamSelection(): void {
    this.step.set(2);
  }

  toggleTeam(team: Team): void {
    this.selectedIds.update(ids => {
      const next = new Set(ids);
      if (next.has(team.id)) {
        next.delete(team.id);
      } else {
        next.add(team.id);
      }
      return next;
    });
  }

  isSelected(teamId: number): boolean {
    return this.selectedIds().has(teamId);
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  finish(): void {
    // Guardar los equipos seleccionados como favoritos
    const selected = this.teams().filter(t => this.selectedIds().has(t.id));
    for (const team of selected) {
      this.favoritesService.toggle({
        id: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        logo: team.logo,
      });
    }

    this.onboarding.complete();
  }

  skip(): void {
    this.onboarding.complete();
  }
}
