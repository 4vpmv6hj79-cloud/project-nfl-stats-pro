import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { FavoritesService } from '../../../../core/services/favorites.service';

@Component({
  selector: 'app-dashboard-favorites',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './dashboard-favorites.html',
  styleUrl: './dashboard-favorites.scss',
})
export class DashboardFavoritesComponent {
  readonly favoritesService = inject(FavoritesService);
}
