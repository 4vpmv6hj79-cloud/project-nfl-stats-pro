import { Injectable, inject } from '@angular/core';

import { AuthService } from './auth.service';

export type PaidPlan = 'pro-monthly' | 'pro-season';

/**
 * Servicio que inicia el flujo de pago con Stripe Checkout.
 *
 * Llama a la función serverless `/api/stripe-checkout`, que crea la
 * sesión de pago del lado del servidor (donde vive la clave secreta) y
 * devuelve la URL de Checkout. Aquí solo redirigimos el navegador a esa URL.
 */
@Injectable({ providedIn: 'root' })
export class StripeService {
  private readonly authService = inject(AuthService);

  /**
   * Inicia el checkout para el plan indicado.
   *
   * @returns un objeto con el resultado. Si `ok` es false, `reason`
   *   indica el motivo para que la UI muestre el mensaje adecuado.
   */
  async startCheckout(
    plan: PaidPlan,
  ): Promise<{ ok: boolean; reason?: 'unavailable' | 'error' }> {
    const user = this.authService.user();

    try {
      const res = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          uid: user?.uid ?? undefined,
          email: user?.email ?? undefined,
        }),
      });

      // Pagos aún no configurados en el servidor
      if (res.status === 503) {
        return { ok: false, reason: 'unavailable' };
      }

      if (!res.ok) {
        return { ok: false, reason: 'error' };
      }

      const data = await res.json();
      if (!data?.url) {
        return { ok: false, reason: 'error' };
      }

      // Redirigir al Checkout hospedado por Stripe
      window.location.href = data.url;
      return { ok: true };
    } catch {
      return { ok: false, reason: 'error' };
    }
  }
}
