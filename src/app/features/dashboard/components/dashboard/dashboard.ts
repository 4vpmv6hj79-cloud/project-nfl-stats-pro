import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NFLService } from '../../../../core/services/api/nfl.service';
import { Team } from '../../../../shared/models/domain/team.model';
import { DashboardStats } from '../../../../shared/models/domain/dashboard-stats.model';


import { DashboardHeader } from '../dashboard-header/dashboard-header';
import { DashboardScoreboardComponent } from '../dashboard-scoreboard/dashboard-scoreboard';
import { DashboardNewsComponent } from '../dashboard-news/dashboard-news';
import { DashboardFavoritesComponent } from '../dashboard-favorites/dashboard-favorites';
import { DashboardCountdownComponent } from '../dashboard-countdown/dashboard-countdown';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DashboardHeader,
    DashboardScoreboardComponent,
    DashboardFavoritesComponent,
    DashboardCountdownComponent,
    DashboardNewsComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {

  private nflService = inject(NFLService);

  teams = signal<Team[]>([]);

  stats = computed<DashboardStats>(() => {

    const teams = this.teams();

    return {
      totalTeams: teams.length,
      afcTeams:   teams.filter(t => t.conference === 'AFC').length,
      nfcTeams:   teams.filter(t => t.conference === 'NFC').length,
      divisions:  new Set(teams.map(t => `${t.conference}-${t.division}`)).size,
    };

  });

  ngOnInit(): void {
    this.nflService.getTeams().subscribe({
      next: teams => this.teams.set(teams),
      error: () => console.error('Error loading teams'),
    });
  }

}
