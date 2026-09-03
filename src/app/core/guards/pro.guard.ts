import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

import { SubscriptionService } from '../services/subscription.service';
import { AuthService } from '../services/auth.service';

/**
 * Guard que protege rutas premium (features Pro).
 *
 * - En SSR deja pasar (la protección real ocurre en el navegador).
 * - Espera a que el estado de auth y suscripción esté resuelto.
 * - Si el usuario no ha iniciado sesión → lo manda a /auth.
 * - Si está autenticado pero no es Pro → lo manda a /planes con un
 *   parámetro que indica que la sección requiere suscripción.
 * - Si es Pro → lo deja entrar.
 */
export const proGuard: CanActivateFn = async (route) => {
  const platformId = inject(PLATFORM_ID);
  const subscription = inject(SubscriptionService);
  const auth = inject(AuthService);
  const router = inject(Router);

  // En el servidor no bloqueamos; el guard corre de nuevo en el cliente.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // Esperar a que se determine el estado de auth y de Pro.
  await subscription.whenReady();

  // Sin sesión → login (y volver aquí después)
  if (!auth.isAuthenticated) {
    return router.createUrlTree(['/auth'], {
      queryParams: { redirect: route.routeConfig?.path ?? '' },
    });
  }

  // Autenticado y Pro → acceso
  if (subscription.isPro()) {
    return true;
  }

  // Autenticado pero no Pro → a la página de planes
  return router.createUrlTree(['/planes'], {
    queryParams: { requiere: route.routeConfig?.path ?? 'pro' },
  });
};
