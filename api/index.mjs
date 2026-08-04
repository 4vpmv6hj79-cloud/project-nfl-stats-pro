let handlerPromise;

export default async function handler(request, response) {
  handlerPromise ??= import(
    '../dist/nfl-stats-pro/server/server.mjs'
  ).then(module => module.reqHandler);

  const angularHandler = await handlerPromise;

  return angularHandler(request, response);
}