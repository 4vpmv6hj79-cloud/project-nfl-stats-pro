interface Env {
  ASSETS: Fetcher;
}

const ESPN_ORIGINS: Record<string, string> = {
  site: 'https://site.api.espn.com',
  'site-web': 'https://site.web.api.espn.com',
  core: 'https://sports.core.api.espn.com',
};

// Puente temporal para conservar las funciones actuales de IA y Stripe.
const VERCEL_BACKEND =
  'https://project-nfl-stats-pro.vercel.app';

const VERCEL_ENDPOINTS = new Set([
  '/api/explain',
  '/api/stripe-checkout',
  '/api/stripe-webhook',
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Mantener temporalmente IA y Stripe en Vercel.
    if (VERCEL_ENDPOINTS.has(url.pathname)) {
      return forwardToVercel(request, url);
    }

    // Proxy de ESPN ejecutado directamente desde Cloudflare.
    if (url.pathname.startsWith('/api/')) {
      return proxyEspn(request, url);
    }

    // Angular y sus archivos estáticos.
    return env.ASSETS.fetch(request);
  },
};

async function forwardToVercel(
  request: Request,
  incomingUrl: URL,
): Promise<Response> {
  const target = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    VERCEL_BACKEND,
  );

  const headers = new Headers(request.headers);

  // Las funciones de Stripe usarán la URL pública de Cloudflare
  // para construir las páginas de éxito y cancelación.
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', 'https');

  return fetch(
    new Request(target, {
      method: request.method,
      headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
      redirect: 'manual',
    }),
  );
}

async function proxyEspn(
  request: Request,
  incomingUrl: URL,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse(
      { error: 'Method not allowed' },
      405,
      { Allow: 'GET' },
    );
  }

  const originKey =
    incomingUrl.searchParams.get('origin') ?? 'site';

  const espnOrigin =
    ESPN_ORIGINS[originKey] ?? ESPN_ORIGINS['site'];

  const requestedPath = incomingUrl.pathname.replace(
    /^\/api/,
    '',
  );

  if (
    !requestedPath ||
    requestedPath.includes('..') ||
    requestedPath.includes('\\')
  ) {
    return jsonResponse(
      { error: 'Invalid ESPN path' },
      400,
    );
  }

  const upstreamUrl = new URL(
    requestedPath,
    espnOrigin,
  );

  incomingUrl.searchParams.forEach((value, key) => {
    if (key !== 'origin') {
      upstreamUrl.searchParams.append(key, value);
    }
  });

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
        Referer: 'https://www.espn.com/',
      },
    });

    const headers = new Headers(upstreamResponse.headers);

    if (upstreamResponse.ok) {
      headers.set(
        'Cache-Control',
        'public, max-age=30, s-maxage=30, stale-while-revalidate=300',
      );
    } else {
      headers.set('Cache-Control', 'no-store');
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch {
    return jsonResponse(
      { error: 'Unable to connect to ESPN' },
      502,
    );
  }
}

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}