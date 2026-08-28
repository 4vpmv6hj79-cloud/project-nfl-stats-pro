const ALLOWED_ORIGINS = {
  'site': 'https://site.api.espn.com',
  'site-web': 'https://site.web.api.espn.com',
  'core': 'https://sports.core.api.espn.com',
};

export default async function handler(
  request,
  response,
) {
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.setHeader('Allow', 'GET');
    response.end(
      JSON.stringify({
        error: 'Method not allowed',
      }),
    );

    return;
  }

  const requestUrl = new URL(
    request.url ?? '/',
    'http://localhost',
  );

  const requestedPath =
    requestUrl.searchParams.get('path') ?? '';

  // Seleccionar el origin basado en parámetro 'origin' (default: site)
  const originKey =
    requestUrl.searchParams.get('origin') ?? 'site';

  const espnOrigin =
    ALLOWED_ORIGINS[originKey] ?? ALLOWED_ORIGINS['site'];

  const normalizedPath =
    requestedPath.replace(/^\/+/, '');

  if (
    !normalizedPath ||
    normalizedPath.includes('..') ||
    normalizedPath.includes('\\')
  ) {
    response.statusCode = 400;
    response.setHeader(
      'Content-Type',
      'application/json',
    );
    response.end(
      JSON.stringify({
        error: 'Invalid ESPN path',
      }),
    );

    return;
  }

  const upstreamUrl = new URL(
    `/${normalizedPath}`,
    espnOrigin,
  );

  for (
    const [key, value] of
    requestUrl.searchParams.entries()
  ) {
    if (key !== 'path' && key !== 'origin') {
      upstreamUrl.searchParams.append(
        key,
        value,
      );
    }
  }

  try {
    const upstreamResponse = await fetch(
      upstreamUrl,
      {
        headers: {
          Accept:
            'application/json, text/plain, */*',
          'Accept-Language':
            'es-MX,es;q=0.9,en;q=0.8',
          Referer: 'https://www.espn.com/',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
        },
      },
    );

    const body =
      await upstreamResponse.text();

    response.statusCode =
      upstreamResponse.status;

    response.setHeader(
      'Content-Type',
      upstreamResponse.headers.get(
        'content-type',
      ) ?? 'application/json',
    );

    response.setHeader(
      'Cache-Control',
      'no-store',
    );

    response.end(body);
  } catch {
    response.statusCode = 502;
    response.setHeader(
      'Content-Type',
      'application/json',
    );

    response.end(
      JSON.stringify({
        error:
          'Unable to connect to ESPN',
      }),
    );
  }
}
