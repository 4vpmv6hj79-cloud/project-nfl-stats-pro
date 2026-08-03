import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NFLService } from '../../../../core/services/api/nfl.service';
import { NotificationService } from '../../../../core/services/api/notification.service';
import { NewsArticle } from '../../../../shared/models/domain/news-article.model';

@Component({
  selector: 'app-dashboard-news',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './dashboard-news.html',
  styleUrl: './dashboard-news.scss',
})
export class DashboardNewsComponent implements OnInit {

  private nflService   = inject(NFLService);
  private notification = inject(NotificationService);

  articles = signal<NewsArticle[]>([]);
  loading  = signal(true);

  ngOnInit(): void {

    this.nflService.getNews(20).subscribe({

      next: (articles: NewsArticle[]) => {
        this.articles.set(articles);
        this.loading.set(false);
      },

      error: () => {
        this.loading.set(false);
        this.notification.error('No fue posible cargar las noticias.');
      },

    });

  }

  formatDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-MX', {
      weekday: 'short',
      day:     'numeric',
      month:   'short',
      year:    'numeric',
    });
  }

  openArticle(url: string): void {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

}
