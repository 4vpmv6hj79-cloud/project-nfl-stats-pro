import { Component, inject, effect, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';

import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ShareService } from '../../services/share.service';
import { NotificationService } from '../../services/api/notification.service';
import { OnboardingComponent } from '../../../shared/components/onboarding/onboarding';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
    OnboardingComponent,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {

  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly shareService = inject(ShareService);
  readonly themeService = inject(ThemeService);
  readonly authService = inject(AuthService);
  readonly subscription = inject(SubscriptionService);

  readonly isMobile$ = this.breakpointObserver
    .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
    .pipe(map((state: BreakpointState) => state.matches));

  constructor() {
    // Avisar y redirigir si la sesión se cerró por inicio en otro dispositivo
    effect(() => {
      if (this.authService.sessionClosedRemotely()) {
        this.notification.error(
          'Tu sesión se cerró porque iniciaste sesión en otro dispositivo.'
        );
        this.authService.sessionClosedRemotely.set(false);
        this.router.navigate(['/dashboard']);
      }
    });
  }

  readonly year = new Date().getFullYear();

  /**
   * Menú principal agrupado. Los items con `route` son enlaces directos;
   * los que tienen `children` son menús desplegables. Así el menú de
   * escritorio muestra pocos elementos y no requiere desplazamiento.
   */
  readonly menuGroups: {
    title: string;
    icon: string;
    route?: string;
    pro?: boolean;
    children?: { title: string; icon: string; route: string; pro?: boolean }[];
  }[] = [
    { title: 'Inicio', icon: 'dashboard', route: '/dashboard' },
    {
      title: 'Partidos',
      icon: 'sports_football',
      children: [
        { title: 'Esta Semana', icon: 'event', route: '/semana' },
        { title: 'Marcadores', icon: 'sports_score', route: '/scores' },
      ],
    },
    {
      title: 'Liga',
      icon: 'shield',
      children: [
        { title: 'Equipos', icon: 'shield', route: '/teams' },
        { title: 'Líderes', icon: 'leaderboard', route: '/lideres' },
        { title: 'Conferencias', icon: 'hub', route: '/conferences' },
      ],
    },
    {
      title: 'Herramientas',
      icon: 'tune',
      children: [
        { title: 'Mi Equipo', icon: 'insights', route: '/mi-equipo', pro: true },
        { title: 'Simulador', icon: 'tune', route: '/simulator', pro: true },
        { title: 'Comparador', icon: 'compare_arrows', route: '/comparator', pro: true },
        { title: 'Playoffs', icon: 'account_tree', route: '/playoffs', pro: true },
      ],
    },
    { title: 'Quiniela', icon: 'emoji_events', route: '/quiniela' },
    { title: 'Planes', icon: 'star', route: '/planes' },
  ];

  /** Lista plana de todos los items con ruta, para el menú móvil. */
  readonly menuItems = [
    { title: 'Inicio',       icon: 'dashboard',      route: '/dashboard',   pro: false },
    { title: 'Esta Semana',  icon: 'event',          route: '/semana',      pro: false },
    { title: 'Marcadores',   icon: 'sports_score',   route: '/scores',      pro: false },
    { title: 'Equipos',      icon: 'shield',         route: '/teams',       pro: false },
    { title: 'Líderes',      icon: 'leaderboard',    route: '/lideres',     pro: false },
    { title: 'Mi Equipo',    icon: 'insights',       route: '/mi-equipo',   pro: true  },
    { title: 'Simulador',    icon: 'tune',           route: '/simulator',   pro: true  },
    { title: 'Comparador',   icon: 'compare_arrows', route: '/comparator',  pro: true  },
    { title: 'Playoffs',     icon: 'account_tree',   route: '/playoffs',    pro: true  },
    { title: 'Conferencias', icon: 'hub',            route: '/conferences', pro: false },
    { title: 'Quiniela',     icon: 'emoji_events',   route: '/quiniela',    pro: false },
    { title: 'Planes',       icon: 'star',           route: '/planes',      pro: false },
  ];

  /**
   * Muestra el banner de verificación solo si el usuario inició sesión
   * con correo/contraseña y aún no verificó su correo. Los usuarios de
   * Google ya vienen verificados, así que no lo ven.
   */
  readonly showVerifyBanner = computed(() => {
    const user = this.authService.user();
    if (!user) return false;
    if (user.providerId === 'google.com') return false;
    return user.emailVerified === false;
  });

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/dashboard']);
  }

  /** Reenvía el correo de verificación */
  async resendVerification(): Promise<void> {
    const ok = await this.authService.resendVerification();
    if (ok) {
      this.notification.success('Correo de verificación reenviado. Revisa tu bandeja.');
    } else {
      this.notification.error('No se pudo reenviar. Intenta más tarde.');
    }
  }

  /** Revisa si el usuario ya verificó su correo */
  async checkVerification(): Promise<void> {
    const verified = await this.authService.refreshVerificationStatus();
    if (verified) {
      this.notification.success('¡Correo verificado! Gracias.');
    } else {
      this.notification.info('Aún no detectamos la verificación. Revisa tu correo y el enlace.');
    }
  }

  /** Comparte la app (abre el menú nativo o copia el enlace) */
  share(): void {
    this.shareService.share({
      title: 'Centro NFL',
      text: '🏈 Sigue la NFL en español: marcadores en vivo, standings, simulador de playoffs y más.',
      url: 'https://project-nfl-stats-pro.vercel.app/',
    });
  }
}
