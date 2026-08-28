import { Routes } from '@angular/router';

export const SCORE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./scores/scores')
        .then(m => m.Scores),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./game-center/game-center')
        .then(m => m.GameCenterComponent),
  },
];
