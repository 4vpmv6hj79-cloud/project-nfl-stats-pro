import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../../../core/services/auth.service';
import { SubscriptionService } from '../../../../core/services/subscription.service';

type CtaVariant = 'guest' | 'upgrade' | 'none';

/**
 * Tarjeta de conversión del dashboard (banner, sin bloquear contenido).
 *
 * - Invitado (sin sesión): invita a registrarse gratis.
 * - Registrado sin Pro: invita a hacerse Pro.
 * - Pro: no muestra nada.
 */
@Component({
  selector: 'app-dashboard-cta',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './dashboard-cta.html',
  styleUrl: './dashboard-cta.scss',
})
export class DashboardCtaComponent {
  private readonly authService = inject(AuthService);
  private readonly subscription = inject(SubscriptionService);

  readonly variant = computed<CtaVariant>(() => {
    if (!this.authService.isAuthenticated) {
      return 'guest';
    }
    if (!this.subscription.isPro()) {
      return 'upgrade';
    }
    return 'none';
  });
}
