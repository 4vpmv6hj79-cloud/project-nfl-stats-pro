import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { NFLService } from '../../../../core/services/api/nfl.service';
import { NotificationService } from '../../../../core/services/api/notification.service';
import { Standing } from '../../../../shared/models/domain/standing.model';
import { LoadingSpinnerComponent } from '../../../../shared/feedback/loading-spinner/loading-spinner';

interface DivisionGroup {
  division: string;
  teams: Standing[];
}

interface ConferenceGroup {
  conference: string;
  divisions: DivisionGroup[];
}

@Component({
  selector: 'app-standings-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './standing-list.html',
  styleUrl: './standing-list.scss',
})
export class StandingsListComponent implements OnInit {

  private nflService   = inject(NFLService);
  private notification = inject(NotificationService);

  standings          = signal<Standing[]>([]);
  selectedConference = signal<string>('ALL');
  loading            = signal(true);

  grouped = computed<ConferenceGroup[]>(() => {
    const all    = this.standings();
    const filter = this.selectedConference();
    const conferences = filter === 'ALL' ? ['AFC', 'NFC'] : [filter];

    return conferences.map(conf => {
      const confTeams    = all.filter(t => t.conference === conf);
      const divisionNames = [...new Set(confTeams.map(t => t.division))].sort();

      const divisions: DivisionGroup[] = divisionNames.map(div => ({
        division: div,
        teams: confTeams
          .filter(t => t.division === div)
          .sort((a, b) => b.wins - a.wins || a.losses - b.losses),
      }));

      return { conference: conf, divisions };
    });
  });

  ngOnInit(): void {
    this.nflService.getStandings().subscribe({
      next: (standings: Standing[]) => {
        this.standings.set(standings);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('No fue posible cargar los standings.');
      },
    });
  }

  onConferenceChange(value: string): void {
    this.selectedConference.set(value);
  }

  formatRecord(team: Standing): string {
    return team.ties > 0
      ? `${team.wins}-${team.losses}-${team.ties}`
      : `${team.wins}-${team.losses}`;
  }

  formatPct(value: number): string {
    return value.toFixed(3).replace(/^0/, '');
  }

}
