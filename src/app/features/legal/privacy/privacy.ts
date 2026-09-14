import { Component } from '@angular/core';

/**
 * Página de Aviso de Privacidad.
 * Texto base; se recomienda revisión legal para uso comercial en México
 * (Ley Federal de Protección de Datos Personales en Posesión de los Particulares).
 */
@Component({
  selector: 'app-privacy',
  standalone: true,
  templateUrl: './privacy.html',
  styleUrl: './privacy.scss',
})
export class PrivacyComponent {
  readonly lastUpdated = 'Septiembre de 2026';
  readonly contactEmail = 'erikgonzalopalomares@gmail.com';
}
