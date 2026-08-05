import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { PlayoffService } from '../../../core/services/api/playoff.service';
import { NotificationService } from '../../../core/services/api/notification.service';
import { LoadingSpinnerComponent } from '../../../shared/feedback/loading-spinner/loading-spinner';

import {
  ConferenceBracket,
  PlayoffBracket,
  PlayoffTeam,
} from '../../../shared/models/domain/playoff.model';

type MobilePlayoffRound =
  | 'wild-card'
  | 'divisional'
  | 'championship'
  | 'super-bowl';

@Component({
  selector: 'app-playoff-bracket',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonToggleModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './playoff-bracket.html',
  styleUrl: './playoff-bracket.scss',
})
export class PlayoffBracketComponent implements OnInit {

  private readonly playoffService =
    inject(PlayoffService);

  private readonly notification =
    inject(NotificationService);

  readonly bracket =
    signal<PlayoffBracket | null>(null);

  readonly loading = signal(true);

  readonly view =
    signal<'bracket' | 'seeds'>('bracket');

  readonly mobileRound =
    signal<MobilePlayoffRound>('wild-card');

  ngOnInit(): void {
    this.playoffService.getBracket().subscribe({
      next: bracket => {
        this.bracket.set(bracket);
        this.loading.set(false);
      },

      error: () => {
        this.loading.set(false);

        this.notification.error(
          'No fue posible cargar los playoffs.'
        );
      },
    });
  }

  onViewChange(view: 'bracket' | 'seeds'): void {
    this.view.set(view);
  }

  onMobileRoundChange(
    round: MobilePlayoffRound
  ): void {
    this.mobileRound.set(round);
  }

  record(team: PlayoffTeam): string {
    return team.ties > 0
      ? `${team.wins}-${team.losses}-${team.ties}`
      : `${team.wins}-${team.losses}`;
  }

  seeds(
    conference: ConferenceBracket
  ): PlayoffTeam[] {
    return conference.seeds;
  }
}
