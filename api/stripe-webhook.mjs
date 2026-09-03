/**
 * Webhook de Stripe: recibe eventos de pago y actualiza el estado Pro
 * del usuario en Firestore.
 *
 * Cuando un pago se completa (checkout.session.completed) o una
 * suscripción cambia de estado, marcamos/desmarcamos al usuario como Pro
 * en el documento users/{uid} de Firestore.
 *
 * Requiere las variables de entorno (configuradas en Vercel):
 *   - STRIPE_SECRET_KEY        → clave secreta de Stripe
 *   - STRIPE_WEBHOOK_SECRET    → secreto de firma del webhook (whsec_...)
 *   - FIREBASE_SERVICE_ACCOUNT → JSON de la cuenta de servicio de Firebase
 *                                (como string en una sola línea)
 *
 * IMPORTANTE: Stripe verifica la firma usando el CUERPO CRUDO (raw) de la
 * petición. Por eso desactivamos el body parser y leemos los bytes tal cual.
 */

import Stripe from 'stripe';

// Desactivar el parseo automático del body: necesitamos el raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

// ── Firebase Admin (inicialización perezosa y cacheada) ──────────────
let firestorePromise = null;

async function getFirestore() {
  if (firestorePromise) return firestorePromise;

  firestorePromise = (async () => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT no configurada');
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT no es un JSON válido');
    }

    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore: getAdminFirestore } = await import('firebase-admin/firestore');

    // Evitar reinicializar en invocaciones "calientes" de la función
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert(serviceAccount) });

    return getAdminFirestore(app);
  })();

  return firestorePromise;
}

/** Lee el cuerpo crudo de la petición como Buffer */
async function readRawBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/** Marca (o desmarca) al usuario como Pro en Firestore */
async function setUserPro(uid, isPro, extra = {}) {
  if (!uid) return;
  const db = await getFirestore();
  await db.collection('users').doc(uid).set(
    {
      pro: isPro,
      proUpdatedAt: Date.now(),
      ...extra,
    },
    { merge: true },
  );
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.setHeader('Allow', 'POST');
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    response.statusCode = 503;
    response.end(JSON.stringify({ error: 'Webhook no configurado' }));
    return;
  }

  const stripe = new Stripe(secretKey);

  // Verificar la firma con el raw body
  let event;
  try {
    const rawBody = await readRawBody(request);
    const signature = request.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: 'Firma inválida' }));
    return;
  }

  try {
    switch (event.type) {
      // Pago único o inicio de suscripción completado en Checkout
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.client_reference_id || session.metadata?.uid;
        const plan = session.metadata?.plan;
        await setUserPro(uid, true, {
          plan: plan ?? null,
          stripeCustomerId: session.customer ?? null,
          stripeSubscriptionId: session.subscription ?? null,
        });
        break;
      }

      // La suscripción se canceló o expiró → quitar Pro
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const uid = subscription.metadata?.uid;
        // Si no guardamos uid en la suscripción, buscar por customer
        if (uid) {
          await setUserPro(uid, false);
        } else {
          await revokeProByCustomer(subscription.customer);
        }
        break;
      }

      // Cambios de estado de la suscripción (impago, reactivación, etc.)
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const active =
          subscription.status === 'active' || subscription.status === 'trialing';
        const uid = subscription.metadata?.uid;
        if (uid) {
          await setUserPro(uid, active);
        } else {
          await setProByCustomer(subscription.customer, active);
        }
        break;
      }

      default:
        // Otros eventos no nos interesan; respondemos 200 igual.
        break;
    }

    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ received: true }));
  } catch (err) {
    // Devolver 500 hace que Stripe reintente el evento más tarde.
    response.statusCode = 500;
    response.end(JSON.stringify({ error: 'Error procesando el evento' }));
  }
}

/** Busca al usuario por su stripeCustomerId y actualiza su estado Pro */
async function setProByCustomer(customerId, isPro) {
  if (!customerId) return;
  const db = await getFirestore();
  const snap = await db
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  if (!snap.empty) {
    await snap.docs[0].ref.set(
      { pro: isPro, proUpdatedAt: Date.now() },
      { merge: true },
    );
  }
}

async function revokeProByCustomer(customerId) {
  await setProByCustomer(customerId, false);
}
