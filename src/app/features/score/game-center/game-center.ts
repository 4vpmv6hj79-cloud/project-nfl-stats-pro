import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, interval, startWith, switchMap } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { GameDetailService } from '../../../core/services/api/game-detail.service';
import { GameDetail, GameDrive } from '../../../shared/models/domain/game-detail.model';

const REFRESH_MS = 20_000; // Refrescar cada 20 segundos para juegos en vivo

@Component({
  selector: 'app-game-center',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './game-center.html',
  styleUrl: './game-center.scss',
})
export class GameCenterComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly gameDetailService = inject(GameDetailService);
  private readonly platformId = inject(PLATFORM_ID);

  private sub!: Subscription;

  readonly game = signal<GameDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  ngOnInit(): void {
    const eventId = this.route.snapshot.paramMap.get('id') ?? '';

    if (!eventId) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }

    // Auto-refresh para juegos en vivo
    if (isPlatformBrowser(this.platformId)) {
      this.sub = interval(REFRESH_MS).pipe(
        startWith(0),
        switchMap(() => this.gameDetailService.getGameDetail(eventId)),
      ).subscribe({
        next: (detail) => {
          this.game.set(detail);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
    } else {
      // SSR: single fetch
      this.gameDetailService.getGameDetail(eventId).subscribe({
        next: (detail) => {
          this.game.set(detail);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get homeWinPct(): number {
    return Math.round((this.game()?.currentHomeWinPct ?? 0.5) * 100);
  }

  get awayWinPct(): number {
    return 100 - this.homeWinPct;
  }

  driveIcon(drive: GameDrive): string {
    const result = drive.result?.toUpperCase() ?? '';
    if (result.includes('TD') || result.includes('TOUCHDOWN')) return '🏈';
    if (result.includes('FG') || result.includes('FIELD GOAL')) return '🥅';
    if (result.includes('INT') || result.includes('INTERCEPTION')) return '❌';
    if (result.includes('FUMBLE')) return '💥';
    if (result.includes('PUNT')) return '👟';
    if (result.includes('DOWNS')) return '⬇️';
    if (result.includes('END OF')) return '⏱️';
    return '🔄';
  }

  driveResultClass(drive: GameDrive): string {
    const result = drive.result?.toUpperCase() ?? '';
    if (result.includes('TD') || result.includes('TOUCHDOWN')) return 'drive--td';
    if (result.includes('FG') || result.includes('FIELD GOAL')) return 'drive--fg';
    if (result.includes('INT') || result.includes('INTERCEPTION')) return 'drive--turnover';
    if (result.includes('FUMBLE')) return 'drive--turnover';
    return 'drive--neutral';
  }
}
