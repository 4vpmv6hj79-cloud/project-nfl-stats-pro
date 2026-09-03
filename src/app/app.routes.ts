import { Routes } from '@angular/router';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { proGuard } from './core/guards/pro.guard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },

      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes')
            .then(m => m.DASHBOARD_ROUTES)
      },

      {
        path: 'teams',
        loadComponent: () =>
          import('./features/teams/pages/team-list/team-list')
            .then(m => m.TeamListComponent)
      },

      {
        path: 'teams/:id',
        loadComponent: () =>
          import('./features/teams/pages/team-detail/team-detail')
            .then(m => m.TeamDetailComponent)
      },

      {
        path: 'standings',
        loadChildren: () =>
          import('./features/standings/standings.routes')
            .then(m => m.STANDINGS_ROUTES)
      },

      {
        path: 'scores',
        loadChildren: () =>
          import('./features/score/scores.routes')
            .then(m => m.SCORE_ROUTES)
      },

      {
        path: 'conferences',
        loadComponent: () =>
          import('./features/conferences/pages/conference-list/conference-list')
            .then(m => m.ConferenceListComponent)
      },

      {
        path: 'auth',
        loadComponent: () =>
          import('./features/auth/auth')
            .then(m => m.AuthComponent)
      },

      {
        path: 'playoffs',
        canActivate: [proGuard],
        loadComponent: () =>
          import('./features/playoffs/playoff-bracket/playoff-bracket')
            .then(m => m.PlayoffBracketComponent)
      },

      {
        path: 'simulator',
        canActivate: [proGuard],
        loadComponent: () =>
          import('./features/simulator/simulator')
            .then(m => m.SimulatorComponent)
      },

      {
        path: 'comparator',
        canActivate: [proGuard],
        loadComponent: () =>
          import('./features/comparator/comparator')
            .then(m => m.ComparatorComponent)
      },

      {
        path: 'mi-equipo',
        canActivate: [proGuard],
        loadComponent: () =>
          import('./features/team-scenarios/team-scenarios')
            .then(m => m.TeamScenariosComponent)
      },

      {
        path: 'lideres',
        loadComponent: () =>
          import('./features/leaders/leaders')
            .then(m => m.LeadersComponent)
      },

      {
        path: 'semana',
        loadComponent: () =>
          import('./features/week/week')
            .then(m => m.WeekComponent)
      },

      {
        path: 'buscar',
        loadComponent: () =>
          import('./features/search/search')
            .then(m => m.SearchComponent)
      },

      {
        path: 'planes',
        loadComponent: () =>
          import('./features/plans/plans')
            .then(m => m.PlansComponent)
      },

      // Siempre debe ser la última ruta
      {
        path: '**',
        redirectTo: 'dashboard'
      }
    ]
  }
];
