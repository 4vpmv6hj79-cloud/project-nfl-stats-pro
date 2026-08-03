import { Routes } from '@angular/router';
import { MainLayout } from './core/layout/main-layout/main-layout';

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
      }

    ]
  }

];
