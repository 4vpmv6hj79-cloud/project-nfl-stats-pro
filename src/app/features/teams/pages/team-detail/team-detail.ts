import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

import { NFLService } from '../../../../core/services/api/nfl.service';
import { NotificationService } from '../../../../core/services/api/notification.service';
import { FavoritesService } from '../../../../core/services/favorites.service';
import { ShareService } from '../../../../core/services/share.service';
import { LoadingSpinnerComponent } from '../../../../shared/feedback/loading-spinner/loading-spinner';
import { TeamRosterComponent } from '../../components/team-roster/team-roster';
import { TeamScheduleComponent } from '../../components/team-schedule/team-schedule';

import { TeamDetail } from '../../../../shared/models/domain/team-detail.model';
import { Player } from '../../../../shared/models/domain/player.model';
import { ScheduleGame } from '../../../../shared/models/domain/schedule-game.model';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    LoadingSpinnerComponent,
    TeamRosterComponent,
    TeamScheduleComponent,
  ],
  templateUrl: './team-detail.html',
  styleUrl: './team-detail.scss',
})
export class TeamDetailComponent implements OnInit {

  private route        = inject(ActivatedRoute);
  private nflService   = inject(NFLService);
  private notification = inject(NotificationService);
  readonly favoritesService = inject(FavoritesService);
  readonly shareService = inject(ShareService);

  private teamId = 0;

  team     = signal<TeamDetail | undefined>(undefined);
  players  = signal<Player[]>([]);
  schedule = signal<ScheduleGame[]>([]);
  loading  = signal(true);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.teamId = id;

    forkJoin({
      detail:   this.nflService.getTeamDetail(id),
      roster:   this.nflService.getRoster(id),
      schedule: this.nflService.getSchedule(id),
    }).subscribe({
      next: ({ detail, roster, schedule }) => {
        this.team.set(detail);
        this.players.set(roster);
        this.schedule.set(schedule);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('No fue posible cargar la información del equipo.');
      },
    });
  }

  get isFavorite(): boolean {
    return this.favoritesService.isFavorite(this.teamId);
  }

  toggleFavorite(): void {
    const t = this.team();
    if (!t) return;

    this.favoritesService.toggle({
      id: this.teamId,
      name: t.name,
      abbreviation: t.abbreviation,
      logo: t.logo,
    });
  }

  shareTeam(): void {
    const t = this.team();
    if (!t) return;

    this.shareService.share({
      title: 'Centro NFL',
      text: `🏈 ${t.name} · ${t.record} · ${t.conference} ${t.division}`,
    });
  }

}
