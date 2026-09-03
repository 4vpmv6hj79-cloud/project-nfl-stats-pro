import { Component, inject, effect } from '@angular/core';
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
  readonly themeService = inject(ThemeService);
  readonly authService = inject(AuthService);

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

  readonly menuItems = [
    { title: 'Inicio',       icon: 'dashboard',      route: '/dashboard'   },
    { title: 'Esta Semana',  icon: 'event',          route: '/semana'      },
    { title: 'Marcadores',   icon: 'sports_score',   route: '/scores'      },
    { title: 'Equipos',      icon: 'shield',         route: '/teams'       },
    { title: 'Líderes',      icon: 'leaderboard',    route: '/lideres'     },
    { title: 'Mi Equipo',    icon: 'insights',       route: '/mi-equipo'   },
    { title: 'Simulador',    icon: 'tune',           route: '/simulator'   },
    { title: 'Comparador',   icon: 'compare_arrows', route: '/comparator'  },
    { title: 'Playoffs',     icon: 'account_tree',   route: '/playoffs'    },
    { title: 'Conferencias', icon: 'hub',             route: '/conferences' },
    { title: 'Planes',       icon: 'star',           route: '/planes'      },
  ];

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/dashboard']);
  }
}
