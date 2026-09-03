/**
 * Función serverless que crea una sesión de Stripe Checkout y devuelve
 * la URL a la que el frontend debe redirigir al usuario para pagar.
 *
 * Requiere las variables de entorno (configuradas en Vercel):
 *   - STRIPE_SECRET_KEY    → clave secreta de Stripe (sk_test_... o sk_live_...)
 *   - STRIPE_PRICE_MONTHLY → Price ID (price_...) o Product ID (prod_...) del plan mensual
 *   - STRIPE_PRICE_SEASON  → Price ID (price_...) o Product ID (prod_...) del plan temporada
 *
 * Nota: si pasas un Product ID (prod_...), la función resuelve
 * automáticamente el precio activo por defecto de ese producto.
 *
 * Si STRIPE_SECRET_KEY no está configurada, devuelve 503 y el frontend
 * muestra un mensaje de "pagos no disponibles".
 *
 * Body esperado (POST JSON):
 * {
 *   "plan": "pro-monthly" | "pro-season",
 *   "uid": "firebase-uid-del-usuario",   // opcional
 *   "email": "correo@usuario.com"        // opcional, prellenar checkout
 * }
 */

import Stripe from 'stripe';

/**
 * Resuelve un identificador configurado a un Price ID válido (price_...).
 *
 * - Si ya es un price_..., lo devuelve tal cual.
 * - Si es un prod_..., busca el precio activo por defecto del producto,
 *   o el primer precio activo si no hay uno marcado por defecto.
 *
 * Devuelve null si no se puede resolver.
 */
async function resolvePriceId(stripe, configured) {
  if (!configured) return null;

  if (configured.startsWith('price_')) {
    return configured;
  }

  if (configured.startsWith('prod_')) {
    // Intentar con el precio por defecto del producto
    const product = await stripe.products.retrieve(configured);
    if (product?.default_price) {
      return typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price.id;
    }

    // Si no hay precio por defecto, tomar el primer precio activo
    const prices = await stripe.prices.list({
      product: configured,
      active: true,
      limit: 1,
    });
    if (prices?.data?.length) {
      return prices.data[0].id;
    }
  }

  return null;
}

export default async function handler(request, response) {
  // Solo POST
  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.setHeader('Allow', 'POST');
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  // Si no hay clave configurada, los pagos no están disponibles todavía
  if (!secretKey) {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'Pagos no configurados' }));
    return;
  }

  // Leer el body
  let body = '';
  try {
    for await (const chunk of request) {
      body += chunk;
    }
  } catch {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: 'Cuerpo inválido' }));
    return;
  }

  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: 'JSON inválido' }));
    return;
  }

  const plan = payload.plan;
  const uid = payload.uid ? String(payload.uid) : undefined;
  const email = payload.email ? String(payload.email) : undefined;

  // Identificador configurado (puede ser price_... o prod_...) y el modo
  const configuredMonthly = process.env.STRIPE_PRICE_MONTHLY;
  const configuredSeason = process.env.STRIPE_PRICE_SEASON;

  let configuredId;
  let mode;
  if (plan === 'pro-monthly') {
    configuredId = configuredMonthly;
    mode = 'subscription';
  } else if (plan === 'pro-season') {
    configuredId = configuredSeason;
    // Pago único para la temporada. Si tu precio es recurrente anual,
    // cambia esto a 'subscription'.
    mode = 'payment';
  } else {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: 'Plan inválido' }));
    return;
  }

  if (!configuredId) {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'Plan no configurado' }));
    return;
  }

  // Construir las URLs de retorno a partir del host de la petición
  const proto = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const origin = `${proto}://${host}`;

  try {
    const stripe = new Stripe(secretKey);

    // Resolver el Price ID (acepta price_... directo o prod_... a resolver)
    const priceId = await resolvePriceId(stripe, configuredId);
    if (!priceId) {
      response.statusCode = 503;
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({ error: 'No se encontró un precio activo para este plan' }),
      );
      return;
    }

    // Ajustar el modo según el tipo real del precio: si es recurrente,
    // Checkout exige mode 'subscription'; si es de pago único, 'payment'.
    try {
      const price = await stripe.prices.retrieve(priceId);
      mode = price?.type === 'recurring' ? 'subscription' : 'payment';
    } catch {
      // Si no se pudo leer el precio, se conserva el modo inferido por plan.
    }

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/planes?pago=exito&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/planes?pago=cancelado`,
      locale: 'es',
      ...(email ? { customer_email: email } : {}),
      // Guardamos el uid para poder marcar al usuario como Pro desde el webhook
      ...(uid ? { client_reference_id: uid, metadata: { uid, plan } } : { metadata: { plan } }),
    });

    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({ url: session.url }));
  } catch (err) {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'No se pudo crear la sesión de pago' }));
  }
}
