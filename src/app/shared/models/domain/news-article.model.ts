export interface NewsArticle {

  id: number;
  headline: string;
  description: string;
  published: string;      // ISO string
  image: string;          // URL de la foto principal
  link: string;           // URL a ESPN para leer la nota completa
  teamName: string;       // equipo relacionado (puede ser vacío)
  teamAbbr: string;

}
export interface NewsCategory {
  type?: string;
  uid?: string;
  teamId?: string;
  description?: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  description: string;
  image?: string;
  link?: string;
  categories?: NewsCategory[];
}
