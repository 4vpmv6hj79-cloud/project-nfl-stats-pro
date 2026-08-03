import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { NFLService } from '../../../../core/services/api/nfl.service';
import { NotificationService } from '../../../../core/services/api/notification.service';
import { Team } from '../../../../shared/models/domain/team.model';
import { TeamCardComponent } from '../../../../shared/components/cards/team-card/team-card';
import { SearchBarComponent } from '../../../../shared/components/filters/search-bar/search-bar';
import { ConferenceFilterComponent } from '../../../../shared/components/filters/conference-filter/conference-filter';
import { LoadingSpinnerComponent } from '../../../../shared/feedback/loading-spinner/loading-spinner';

@Component({
  selector: 'app-team-list',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    TeamCardComponent,
    SearchBarComponent,
    ConferenceFilterComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './team-list.html',
  styleUrl: './team-list.scss',
})
export class TeamListComponent implements OnInit {

  private nflService   = inject(NFLService);
  private notification = inject(NotificationService);

  teams      = signal<Team[]>([]);
  searchText = signal('');
  conference = signal('ALL');
  loading    = signal(true);

  filteredTeams = computed(() => {
    const text = this.searchText().toLowerCase();
    return this.teams().filter(team => {
      const matchesSearch =
        team.name.toLowerCase().includes(text) ||
        team.city.toLowerCase().includes(text);
      const matchesConference =
        this.conference() === 'ALL' || team.conference === this.conference();
      return matchesSearch && matchesConference;
    });
  });

  ngOnInit(): void {
    this.nflService.getTeams().subscribe({
      next: (teams: Team[]) => {
        this.teams.set(teams);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('No fue posible cargar los equipos.');
      },
    });
  }

  onSearch(value: string): void {
    this.searchText.set(value);
  }

  onConferenceChange(conference: string): void {
    this.conference.set(conference);
  }

}
