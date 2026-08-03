import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

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
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {

  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly isMobile$ = this.breakpointObserver
    .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
    .pipe(map((state: BreakpointState) => state.matches));

  readonly year = new Date().getFullYear();

  readonly menuItems = [
    { title: 'Inicio',    icon: 'dashboard',    route: '/dashboard'   },
    { title: 'Equipos',      icon: 'shield',       route: '/teams'       },
    { title: 'Marcadores',   icon: 'sports_score', route: '/scores'      },
    { title: 'Conferencias', icon: 'hub',          route: '/conferences' },
  ];

}
