export interface Player {

  id: number;
  fullName: string;
  jersey: string;
  position: string;
  positionAbbr: string;
  age: number;
  height: string;
  weight: string;
  college: string;
  headshot: string;
  injuryStatus: 'Active' | 'Questionable' | 'Doubtful' | 'Out' | 'IR' | 'PUP' | 'Suspended' | '';
  injuryDescription: string;

}
