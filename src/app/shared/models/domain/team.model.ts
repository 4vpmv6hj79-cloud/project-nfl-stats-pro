export interface Team {

  id: number;
  name: string;
  city: string;
  abbreviation: string;
  logo: string;

  conference: string;
  division: string;

  standing?: string;

  stadium?: string;
  venue?: string;

  color?: string;
  alternateColor?: string;

}