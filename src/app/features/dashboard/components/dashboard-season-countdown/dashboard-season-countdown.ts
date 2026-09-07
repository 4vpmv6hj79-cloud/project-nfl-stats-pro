import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

/**
 * Fecha y hora del kickoff de la temporada regular (hora del centro de México).
 * El primer partido (Thursday Night) arranca por la noche.
 * Ajusta esta constante si la fecha oficial cambia.
 */
const SEASON_KICKOFF = new Date('2026-09-09T19:20:00-06:00');

interface TimeParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Contador regresivo hasta el inicio de la temporada regular de la NFL.
 * Se muestra solo mientras falte tiempo; una vez iniciada la temporada,
 * el componente se oculta solo para no ocupar espacio.
 */
@Component({
  selector: 'app-dashboard-season-countdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-season-countdown.html',
  styleUrl: './dashboard-season-countdown.scss',
})
export class DashboardSeasonCountdownComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  private timer: ReturnType<typeof setInterval> | null = null;

  /** Momento actual, se actualiza cada segundo */
  readonly now = signal(new Date());

  /** true si el kickoff ya pasó (la temporada ya comenzó) */
  readonly started = computed(() => this.now().getTime() >= SEASON_KICKOFF.getTime());

  /** Tiempo restante desglosado en días/horas/minutos/segundos */
  readonly remaining = computed<TimeParts>(() => {
    const diff = Math.max(0, SEASON_KICKOFF.getTime() - this.now().getTime());
    const totalSeconds = Math.floor(diff / 1000);

    return {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.timer = setInterval(() => this.now.set(new Date()), 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /** Formatea un número a dos dígitos (ej. 7 → "07") */
  pad(n: number): string {
    return String(n).padStart(2, '0');
  }
}
