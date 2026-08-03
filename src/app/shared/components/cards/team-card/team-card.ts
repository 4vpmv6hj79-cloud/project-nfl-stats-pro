import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

import { Team } from '../../../models/domain/team.model';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [
    MatCardModule,
    RouterLink
  ],
  templateUrl: './team-card.html',
  styleUrl: './team-card.scss'
})
export class TeamCardComponent {

  @Input({ required: true })
  team!: Team;

}
