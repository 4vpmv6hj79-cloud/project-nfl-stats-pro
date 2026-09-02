import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { LeagueLeadersService } from '../../core/services/api/league-leaders.service';
import { LeaderCategory } from '../../shared/models/domain/league-leaders.model';

@Component({
  selector: 'app-leaders',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
  ],
  templateUrl: './leaders.html',
  styleUrl: './leaders.scss',
})
export class LeadersComponent implements OnInit {
  private readonly leadersService = inject(LeagueLeadersService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly categories = signal<LeaderCategory[]>([]);
  readonly season = signal<number>(this.resolveSeason());

  ngOnInit(): void {
    this.load(this.season());
  }

  private load(season: number): void {
    this.loading.set(true);
    this.error.set(false);

    this.leadersService.getLeaders(season).subscribe({
      next: cats => {
        // Si la temporada actual no tiene datos, intentar la anterior
        const hasData = cats.some(c => c.leaders.length > 0);
        if (!hasData && season === this.resolveSeason()) {
          this.season.set(season - 1);
          this.load(season - 1);
          return;
        }

        this.categories.set(cats);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  /**
   * La temporada NFL empieza en septiembre. Si estamos antes de
   * septiembre, la temporada "actual" es la del año anterior.
   */
  private resolveSeason(): number {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0 = enero
    return month >= 8 ? year : year - 1;
  }
}
