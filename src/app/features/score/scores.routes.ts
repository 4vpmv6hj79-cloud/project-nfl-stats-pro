import { Routes } from '@angular/router';


export const SCORE_ROUTES: Routes = [

{
 path:'',
 loadComponent:()=> 
 import('./scores/scores')
 .then(m=>m.Scores)
}

];