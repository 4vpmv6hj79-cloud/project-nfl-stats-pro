import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/api/notification.service';
import { StripeService } from '../../core/services/stripe.service';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: 'free' | 'pro-monthly' | 'pro-season';
  name: string;
  price: string;
  priceNote: string;
  highlight: boolean;
  features: PlanFeature[];
  ctaLabel: string;
  badge?: string;
}

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './plans.html',
  styleUrl: './plans.scss',
})
export class PlansComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NotificationService);
  private readonly stripe = inject(StripeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isAuthenticated = signal(this.authService.isAuthenticated);

  /** true mientras se está creando la sesión de pago (evita doble clic) */
  readonly processing = signal(false);

  readonly plans: Plan[] = [
    {
      id: 'free',
      name: 'Gratis',
      price: '$0',
      priceNote: 'Para siempre',
      highlight: false,
      ctaLabel: 'Tu plan actual',
      features: [
        { text: 'Marcadores en vivo', included: true },
        { text: 'Esta Semana / calendario', included: true },
        { text: 'Standings y conferencias', included: true },
        { text: 'Noticias de la NFL', included: true },
        { text: 'Equipos (roster, calendario)', included: true },
        { text: '1 equipo favorito', included: true },
        { text: 'Con publicidad', included: true },
        { text: 'Escenarios de playoffs', included: false },
        { text: 'Simulador de Playoffs', included: false },
        { text: 'Comparador de jugadores', included: false },
        { text: 'Notificaciones de tu equipo', included: false },
      ],
    },
    {
      id: 'pro-monthly',
      name: 'Pro Mensual',
      price: '$59.99',
      priceNote: 'por mes',
      highlight: false,
      ctaLabel: 'Suscribirme',
      features: [
        { text: 'Todo lo del plan Gratis', included: true },
        { text: 'Sin publicidad', included: true },
        { text: 'Equipos favoritos ilimitados con sincronización', included: true },
        { text: '"¿Qué necesita mi equipo?" (escenarios de playoffs)', included: true },
        { text: 'Simulador de Playoffs completo', included: true },
        { text: 'Comparador de jugadores', included: true },
        { text: 'Notificaciones de tus equipos (TD, inicio, final)', included: true },
        { text: 'Countdown de próximos juegos', included: true },
      ],
    },
    {
      id: 'pro-season',
      name: 'Pro Temporada',
      price: '$299',
      priceNote: 'por toda la temporada',
      highlight: true,
      badge: 'Mejor valor',
      ctaLabel: 'Obtener Pro',
      features: [
        { text: 'Todo lo del plan Pro Mensual', included: true },
        { text: 'Acceso hasta el Super Bowl', included: true },
        { text: 'Ahorra vs pagar mes con mes', included: true },
        { text: 'Sin publicidad', included: true },
        { text: 'Escenarios de playoffs', included: true },
        { text: 'Simulador de Playoffs completo', included: true },
        { text: 'Comparador de jugadores', included: true },
        { text: 'Notificaciones y countdown', included: true },
      ],
    },
  ];

  ngOnInit(): void {
    // Manejar el retorno desde Stripe Checkout
    const pago = this.route.snapshot.queryParamMap.get('pago');
    if (pago === 'exito') {
      this.notification.success(
        '¡Pago completado! Tu acceso Pro se activará en breve.'
      );
      this.clearPagoQueryParam();
    } else if (pago === 'cancelado') {
      this.notification.info('Cancelaste el pago. Puedes intentarlo cuando quieras.');
      this.clearPagoQueryParam();
    }
  }

  async selectPlan(plan: Plan): Promise<void> {
    if (plan.id === 'free' || this.processing()) {
      return;
    }

    // Requiere sesión iniciada para poder asociar el pago al usuario
    if (!this.authService.isAuthenticated) {
      this.notification.info('Inicia sesión para suscribirte.');
      this.router.navigate(['/auth'], {
        queryParams: { redirect: '/planes' },
      });
      return;
    }

    this.processing.set(true);
    const result = await this.stripe.startCheckout(plan.id);
    this.processing.set(false);

    // Si ok es true, el navegador ya está redirigiendo a Stripe.
    if (!result.ok) {
      if (result.reason === 'unavailable') {
        this.notification.info(
          'Los pagos estarán disponibles muy pronto. Estamos terminando de configurarlos.'
        );
      } else {
        this.notification.error('No se pudo iniciar el pago. Intenta de nuevo.');
      }
    }
  }

  private clearPagoQueryParam(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { pago: null, session_id: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
