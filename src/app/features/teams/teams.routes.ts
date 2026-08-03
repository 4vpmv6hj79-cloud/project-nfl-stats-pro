import { Routes } from '@angular/router';
import { TeamListComponent } from './pages/team-list/team-list';
import { TeamDetailComponent } from './pages/team-detail/team-detail';


export const TEAM_ROUTES: Routes = [

  {
    path: '',
    component: TeamListComponent
  },

  {
    path: ':id',
    component: TeamDetailComponent
  }

];