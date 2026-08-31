import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { FavoritesService, FavoriteTeam } from '../../../../core/services/favorites.service';
import { NFLService } from '../../../../core/services/api/nfl.service';
import { Standing } from '../../../../shared/models/domain/standing.model';
import { NewsArticle } from '../../../../shared/models/domain/news-article.model';

export interface FavoriteTeamInfo {
  team: FavoriteTeam;
  record: string;
  conferenceRank: number;
  conference: string;
  divisionRank: number;
  division: string;
  news: NewsArticle[];
  seasonStarted: boolean;
}

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
export class DashboardFavoritesComponent implements OnInit {
  readonly favoritesService = inject(FavoritesService);
  private readonly nflService = inject(NFLService);

  readonly standings = signal<Standing[]>([]);
  readonly news = signal<NewsArticle[]>([]);

  /**
   * Verifica si la temporada ya comenzó.
   * Si ningún equipo tiene partidos jugados (todos en 0-0-0),
   * la temporada regular aún no arranca.
   */
  readonly seasonStarted = computed<boolean>(() => {
    const standings = this.standings();
    if (standings.length === 0) return false;
    return standings.some(s => s.wins > 0 || s.losses > 0 || s.ties > 0);
  });

  /** Información enriquecida de cada equipo favorito */
  readonly favoriteTeamsInfo = computed<FavoriteTeamInfo[]>(() => {
    const favorites = this.favoritesService.favorites();
    const allStandings = this.standings();
    const allNews = this.news();
    const seasonStarted = this.seasonStarted();

    if (favorites.length === 0) {
      return [];
    }

    return favorites.map(fav => {
      // Buscar standing del equipo
      const standing = allStandings.find(
        s => s.abbreviation?.toUpperCase() === fav.abbreviation?.toUpperCase()
      );

      // Calcular ranking en conferencia
      let conferenceRank = 0;
      let divisionRank = 0;
      let conference = '';
      let division = '';

      if (standing) {
        conference = standing.conference;
        division = standing.division;

        const confTeams = allStandings
          .filter(s => s.conference === standing.conference)
          .sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);
        conferenceRank = confTeams.findIndex(
          s => s.abbreviation === standing.abbreviation
        ) + 1;

        const divTeams = allStandings
          .filter(s => s.conference === standing.conference && s.division === standing.division)
          .sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);
        divisionRank = divTeams.findIndex(
          s => s.abbreviation === standing.abbreviation
        ) + 1;
      }

      const record = standing
        ? `${standing.wins}-${standing.losses}${standing.ties > 0 ? '-' + standing.ties : ''}`
        : '';

      // Filtrar noticias del equipo (últimas 2)
      const teamNews = allNews
        .filter(n =>
          n.teamAbbr?.toUpperCase() === fav.abbreviation?.toUpperCase()
        )
        .slice(0, 2);

      return {
        team: fav,
        record,
        conferenceRank,
        conference,
        divisionRank,
        division,
        news: teamNews,
        seasonStarted,
      };
    });
  });

  ngOnInit(): void {
    this.nflService.getStandings().subscribe({
      next: (standings) => this.standings.set(standings),
    });

    this.nflService.getNews(50).subscribe({
      next: (news) => this.news.set(news),
    });
  }

  openArticle(url: string): void {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
