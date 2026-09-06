// HTML-only Node smoke test: Cloudflare provides this module in production.
// Database behaviour is tested separately against the real migration and SQL.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export const env = {};', shortCircuit: true };
  return nextResolve(specifier, context);
}
