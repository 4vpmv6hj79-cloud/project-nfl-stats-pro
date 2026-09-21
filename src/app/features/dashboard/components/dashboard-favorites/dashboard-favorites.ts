import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { FavoritesService, FavoriteTeam } from '../../../../core/services/favorites.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NFLService } from '../../../../core/services/api/nfl.service';
import { NotificationService } from '../../../../core/services/api/notification.service';
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
  imports: [RouterLink, MatIconModule],
  templateUrl: './dashboard-favorites.html',
  styleUrl: './dashboard-favorites.scss',
})
export class DashboardFavoritesComponent implements OnInit {
  readonly favoritesService = inject(FavoritesService);
  readonly authService = inject(AuthService);
  private readonly nflService = inject(NFLService);
  private readonly notification = inject(NotificationService);

  readonly standings = signal<Standing[]>([]);
  readonly standingsLoading = signal(true);
  readonly standingsError = signal(false);
  readonly news = signal<NewsArticle[]>([]);

  readonly seasonStarted = computed<boolean>(() => {
    const standings = this.standings();

    if (standings.length === 0) return false;

    return standings.some(
      team => team.wins > 0 || team.losses > 0 || team.ties > 0
    );
  });

  readonly favoriteTeamsInfo = computed<FavoriteTeamInfo[]>(() => {
    const favorites = this.favoritesService.favorites();
    const allStandings = this.standings();
    const allNews = this.news();
    const seasonStarted = this.seasonStarted();

    if (favorites.length === 0) {
      return [];
    }

    return favorites.map(fav => {
      const standing = allStandings.find(
        team =>
          team.abbreviation?.toUpperCase() ===
          fav.abbreviation?.toUpperCase()
      );

      let conferenceRank = 0;
      let divisionRank = 0;
      let conference = '';
      let division = '';

      if (standing) {
        conference = standing.conference;
        division = standing.division;

        const confTeams = allStandings
          .filter(team => team.conference === standing.conference)
          .sort(
            (a, b) =>
              b.percentage - a.percentage ||
              b.wins - a.wins
          );

        conferenceRank =
          confTeams.findIndex(
            team => team.abbreviation === standing.abbreviation
          ) + 1;

        const divTeams = allStandings
          .filter(
            team =>
              team.conference === standing.conference &&
              team.division === standing.division
          )
          .sort(
            (a, b) =>
              b.percentage - a.percentage ||
              b.wins - a.wins
          );

        divisionRank =
          divTeams.findIndex(
            team => team.abbreviation === standing.abbreviation
          ) + 1;
      }

      const record = standing
        ? `${standing.wins}-${standing.losses}${
            standing.ties > 0 ? '-' + standing.ties : ''
          }`
        : '';

      const teamNews = allNews
        .filter(
          article =>
            article.teamAbbr?.toUpperCase() ===
            fav.abbreviation?.toUpperCase()
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
      next: standings => {
        this.standings.set(standings);
        this.standingsError.set(standings.length === 0);
        this.standingsLoading.set(false);
      },
      error: () => {
        this.standingsError.set(true);
        this.standingsLoading.set(false);
        this.notification.error(
          'No fue posible cargar la información de tus equipos.'
        );
      },
    });

    this.nflService.getNews(50).subscribe({
      next: news => this.news.set(news),
      error: () => {
        // Las noticias son secundarias.
      },
    });
  }

  openArticle(url: string): void {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}