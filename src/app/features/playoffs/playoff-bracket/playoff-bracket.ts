import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { PlayoffService } from '../../../core/services/api/playoff.service';
import { NotificationService } from '../../../core/services/api/notification.service';
import { LoadingSpinnerComponent } from '../../../shared/feedback/loading-spinner/loading-spinner';
import {
  PlayoffBracket,
  PlayoffMatchup,
  PlayoffTeam,
  ConferenceBracket,
} from '../../../shared/models/domain/playoff.model';

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

  private playoffService = inject(PlayoffService);
  private notification   = inject(NotificationService);

  bracket  = signal<PlayoffBracket | null>(null);
  loading  = signal(true);
  view     = signal<'bracket' | 'seeds'>('bracket');

  ngOnInit(): void {
    this.playoffService.getBracket().subscribe({
      next: b => {
        this.bracket.set(b);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('No fue posible cargar los playoffs.');
      },
    });
  }

  onViewChange(v: 'bracket' | 'seeds'): void {
    this.view.set(v);
  }

  record(t: PlayoffTeam): string {
    return t.ties > 0
      ? `${t.wins}-${t.losses}-${t.ties}`
      : `${t.wins}-${t.losses}`;
  }

  seeds(conf: ConferenceBracket): PlayoffTeam[] {
    return conf.seeds;
  }
}
