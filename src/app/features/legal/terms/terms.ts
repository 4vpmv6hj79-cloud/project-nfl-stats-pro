import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Página de Términos y Condiciones.
 * Texto base; se recomienda revisión legal para uso comercial.
 */
@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terms.html',
  styleUrl: './terms.scss',
})
export class TermsComponent {
  readonly lastUpdated = 'Septiembre de 2026';
  readonly contactEmail = 'erikgonzalopalomares@gmail.com';
}
