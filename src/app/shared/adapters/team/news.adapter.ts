import { NewsArticle } from '../../models/domain/news-article.model';

export class NewsAdapter {

  static adapt(response: any): NewsArticle[] {

    const articles: any[] = response.articles ?? [];

    return articles.map(article => {

      // Imagen principal — preferir tipo 'header', sino cualquier imagen
      const image: string =
        article.images?.find((img: any) => img.type === 'header')?.url
        ?? article.images?.[0]?.url
        ?? '';

      // URL a ESPN para leer la nota completa
      const link: string =
        article.links?.web?.href
        ?? article.links?.mobile?.href
        ?? '';

      // Equipo relacionado (primer category de tipo 'team')
      const teamCat = article.categories?.find(
        (c: any) => c.type === 'team' && c.team
      );

      return {
        id:          Number(article.id),
        headline:    article.headline    ?? '',
        description: article.description ?? '',
        published:   article.published   ?? '',
        image,
        link,
        teamName:    teamCat?.team?.description      ?? '',
        teamAbbr:    teamCat?.team?.abbreviation     ?? '',
      };

    });

  }

}
