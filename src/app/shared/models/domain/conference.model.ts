export interface Conference {

  id:string;

  name:string;

  divisions:{
    id:string;
    name:string;
    teams:string[];
  }[];

}