import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { NFLService } from '../../../../core/services/api/nfl.service';
import { NotificationService } from '../../../../core/services/api/notification.service';
import { NewsArticle } from '../../../../shared/models/domain/news-article.model';

interface NewsTeamOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-dashboard-news',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './dashboard-news.html',
  styleUrl: './dashboard-news.scss',
})
export class DashboardNewsComponent implements OnInit {

  private readonly nflService = inject(NFLService);
  private readonly notification = inject(NotificationService);

  readonly articles = signal<NewsArticle[]>([]);
  readonly loading = signal(true);

  readonly selectedTeamId = signal<string>('all');

  /**
   * Obtiene los equipos presentes en las noticias.
   * Map evita mostrar equipos repetidos en el selector.
   */
  readonly teamOptions = computed<NewsTeamOption[]>(() => {
    const teamsMap = new Map<string, string>();

    for (const article of this.articles()) {
      if (article.teamAbbr && article.teamName) {
        const teamId = article.teamAbbr.toUpperCase();

        teamsMap.set(teamId, article.teamName);
      }
    }

    return Array.from(
      teamsMap,
      ([id, name]): NewsTeamOption => ({
        id,
        name,
      })
    ).sort((firstTeam, secondTeam) =>
      firstTeam.name.localeCompare(secondTeam.name)
    );
  });

  /**
   * Filtra las noticias utilizando la abreviatura del equipo.
   */
  readonly filteredArticles = computed<NewsArticle[]>(() => {
    const selectedTeamId = this.selectedTeamId();
    const articles = this.articles();

    if (selectedTeamId === 'all') {
      return articles;
    }

    return articles.filter(article =>
      article.teamAbbr?.toUpperCase() === selectedTeamId
    );
  });

  ngOnInit(): void {
    this.nflService.getNews(20).subscribe({
      next: (articles: NewsArticle[]) => {
        this.articles.set(articles);
        this.loading.set(false);
      },

      error: () => {
        this.loading.set(false);
        this.notification.error(
          'No fue posible cargar las noticias.'
        );
      },
    });
  }

  selectTeam(teamId: string): void {
    this.selectedTeamId.set(teamId);
  }

  formatDate(iso: string): string {
    if (!iso) {
      return '';
    }

    return new Date(iso).toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  openArticle(url: string): void {
    if (url) {
      window.open(
        url,
        '_blank',
        'noopener,noreferrer'
      );
    }
  }
}
