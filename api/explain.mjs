/**
 * Función serverless que genera una explicación en español de lo que
 * está pasando en un partido de NFL, usando un modelo de lenguaje (LLM).
 *
 * Requiere la variable de entorno OPENAI_API_KEY configurada en Vercel.
 * Si no está configurada, devuelve 503 y el frontend oculta la feature.
 *
 * Body esperado (POST JSON):
 * {
 *   "context": "texto con el estado del partido, drives, jugadas, etc.",
 *   "level": "beginner" | "advanced"   // nivel del usuario
 * }
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

export default async function handler(request, response) {
  // Solo POST
  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.setHeader('Allow', 'POST');
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // Si no hay API key configurada, la feature no está disponible
  if (!apiKey) {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'AI no configurada' }));
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

  const gameContext = String(payload.context ?? '').slice(0, 3000);
  const level = payload.level === 'advanced' ? 'advanced' : 'beginner';

  if (!gameContext) {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: 'Falta contexto del partido' }));
    return;
  }

  const systemPrompt =
    level === 'beginner'
      ? 'Eres un comentarista de NFL que explica el futbol americano en español ' +
        'sencillo para principiantes. Explica en 2-3 frases qué está pasando en el ' +
        'partido y por qué es importante, evitando tecnicismos. Usa un tono cercano.'
      : 'Eres un analista experto de NFL. Explica en español, en 2-3 frases, el ' +
        'contexto táctico y estratégico del momento del partido, usando terminología ' +
        'apropiada para aficionados avanzados.';

  try {
    const aiResponse = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Estado del partido:\n${gameContext}\n\n¿Qué está pasando?` },
        ],
        max_tokens: 200,
        temperature: 0.6,
      }),
    });

    if (!aiResponse.ok) {
      response.statusCode = 502;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: 'Error del proveedor de IA' }));
      return;
    }

    const data = await aiResponse.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? '';

    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({ explanation: text }));
  } catch {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'No se pudo conectar con la IA' }));
  }
}
