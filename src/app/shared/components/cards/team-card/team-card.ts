import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { Team } from '../../../models/domain/team.model';
import { FavoritesService, FavoriteTeam } from '../../../../core/services/favorites.service';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    RouterLink,
  ],
  templateUrl: './team-card.html',
  styleUrl: './team-card.scss',
})
export class TeamCardComponent {

  @Input({ required: true })
  team!: Team;

  readonly favoritesService = inject(FavoritesService);

  get isFavorite(): boolean {
    return this.favoritesService.isFavorite(this.team.id);
  }

  toggleFavorite(event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    const fav: FavoriteTeam = {
      id: this.team.id,
      name: this.team.name,
      abbreviation: this.team.abbreviation,
      logo: this.team.logo,
    };

    this.favoritesService.toggle(fav);
  }
}
