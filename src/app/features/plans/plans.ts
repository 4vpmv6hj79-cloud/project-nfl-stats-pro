import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/api/notification.service';

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
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './plans.html',
  styleUrl: './plans.scss',
})
export class PlansComponent {
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NotificationService);

  readonly isAuthenticated = signal(this.authService.isAuthenticated);

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

  selectPlan(plan: Plan): void {
    if (plan.id === 'free') {
      return;
    }

    // Placeholder: aquí irá la integración de pago (Stripe) más adelante.
    // Cuando esté Stripe, aquí se redirigirá al checkout con el Price ID del plan.
    this.notification.success(
      '¡Gracias por tu interés! Los pagos estarán disponibles muy pronto.'
    );
  }
}
