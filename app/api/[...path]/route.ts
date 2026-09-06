import { env } from 'cloudflare:workers';
import { handleApi } from '@/lib/service';
export const dynamic = 'force-dynamic';
const allowedOrigins = ['https://milemario.github.io'];
async function handler(request: Request) {
  const origin = request.headers.get('Origin');
  const ownOrigin = new URL(request.url).origin;
  const permitted = !origin || origin === ownOrigin || allowedOrigins.includes(origin);
  const admin = new URL(request.url).pathname.startsWith('/api/admin');
  const crossOriginAdmin = admin && origin && origin !== ownOrigin;
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
  if (permitted && origin && !admin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (!permitted || crossOriginAdmin) return Response.json({ error: 'This request is not allowed.' }, { status: 403, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  let response;
  if (!env.DB) response = Response.json({ error: 'Progress storage is not available yet. Please try again shortly.' }, { status: 503 });
  else response = await handleApi(request, env.DB, { ADMIN_EMAIL: env.ADMIN_EMAIL });
  response.headers.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}
export { handler as GET, handler as POST, handler as OPTIONS };
