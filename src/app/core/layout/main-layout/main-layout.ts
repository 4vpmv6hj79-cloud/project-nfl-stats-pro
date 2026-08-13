import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDrawer } from '@angular/material/sidenav';

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
export class MainLayout implements OnInit, OnDestroy {

  private readonly breakpointObserver = inject(BreakpointObserver);
  private breakpointSub!: Subscription;

  readonly isMobile = signal(false);

  readonly year = new Date().getFullYear();

  readonly menuItems = [
    { title: 'Inicio',       icon: 'dashboard',      route: '/dashboard'   },
    { title: 'Equipos',      icon: 'shield',         route: '/teams'       },
    { title: 'Marcadores',   icon: 'sports_score',   route: '/scores'      },
    { title: 'Playoffs',     icon: 'account_tree',   route: '/playoffs'    },
    { title: 'Conferencias', icon: 'hub',             route: '/conferences' },
  ];

  ngOnInit(): void {
    this.breakpointSub = this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .subscribe((state: BreakpointState) => {
        this.isMobile.set(state.matches);
      });
  }

  ngOnDestroy(): void {
    this.breakpointSub?.unsubscribe();
  }

  closeSidenavIfMobile(drawer: MatDrawer): void {
    if (this.isMobile()) {
      drawer.close();
    }
  }
}
