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
import { ShareService } from '../../../core/services/share.service';
import { AiExplainService, ExplainLevel } from '../../../core/services/ai-explain.service';

const REFRESH_MS = 20_000; // Refrescar cada 20 segundos para juegos en vivo

// Bandera para activar/ocultar la explicación con IA.
// Cambiar a true cuando OPENAI_API_KEY esté configurada en Vercel.
const AI_ENABLED = false;

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
  readonly shareService = inject(ShareService);
  private readonly aiExplain = inject(AiExplainService);

  private sub!: Subscription;

  readonly game = signal<GameDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  // Explicación con IA
  readonly aiEnabled = AI_ENABLED;
  readonly aiLevel = signal<ExplainLevel>('beginner');
  readonly aiExplanation = signal<string>('');
  readonly aiLoading = signal(false);
  readonly aiUnavailable = signal(false);

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

  shareGame(): void {
    const g = this.game();
    if (!g) return;

    const scoreLine =
      g.statusState === 'pre'
        ? `${g.awayTeam.abbreviation} vs ${g.homeTeam.abbreviation}`
        : `${g.awayTeam.abbreviation} ${g.awayTeam.score} - ${g.homeTeam.score} ${g.homeTeam.abbreviation}`;

    this.shareService.share({
      title: 'Centro NFL',
      text: `🏈 ${scoreLine} · ${g.status}`,
    });
  }

  setAiLevel(level: ExplainLevel): void {
    this.aiLevel.set(level);
    // Si ya había una explicación, regenerar con el nuevo nivel
    if (this.aiExplanation()) {
      this.explainGame();
    }
  }

  explainGame(): void {
    const g = this.game();
    if (!g || this.aiLoading()) return;

    this.aiLoading.set(true);
    this.aiExplanation.set('');

    const context = this.buildGameContext(g);

    this.aiExplain.explain(context, this.aiLevel()).subscribe({
      next: result => {
        if (result.available) {
          this.aiExplanation.set(result.explanation);
        } else {
          this.aiUnavailable.set(true);
        }
        this.aiLoading.set(false);
      },
      error: () => {
        this.aiUnavailable.set(true);
        this.aiLoading.set(false);
      },
    });
  }

  /**
   * Construye un resumen textual del estado del partido para enviar a la IA.
   */
  private buildGameContext(g: GameDetail): string {
    const parts: string[] = [];

    parts.push(
      `${g.awayTeam.name} (${g.awayTeam.score}) vs ${g.homeTeam.name} (${g.homeTeam.score}). ` +
      `Estado: ${g.status}.`
    );

    if (g.statusState === 'in' && g.downDistanceText) {
      parts.push(`Situación actual: ${g.downDistanceText}.`);
      const posTeam = g.possession === 'home' ? g.homeTeam.name : g.possession === 'away' ? g.awayTeam.name : '';
      if (posTeam) {
        parts.push(`${posTeam} tiene el balón.`);
      }
    }

    // Últimos drives
    if (g.drives.length > 0) {
      const recent = g.drives.slice(0, 3)
        .map(d => `${d.teamAbbr}: ${d.shortResult} (${d.description})`)
        .join('; ');
      parts.push(`Últimos drives: ${recent}.`);
    }

    // Última anotación
    if (g.scoringPlays.length > 0) {
      const last = g.scoringPlays[g.scoringPlays.length - 1];
      parts.push(`Última anotación: ${last.text}.`);
    }

    return parts.join(' ');
  }
}
