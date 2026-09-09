// Add this to your Cloudflare Worker (next to your existing /api/log route).
// Needs a KV namespace bound as VISITS:
//
//   wrangler.toml
//   [[kv_namespaces]]
//   binding = "VISITS"
//   id = "<your-kv-namespace-id>"
//
// Create it with:  npx wrangler kv namespace create VISITS

export async function handleVisits(request, env) {
  const url = new URL(request.url);
  const page = (url.searchParams.get('page') || '/').slice(0, 100);
  const key = `visits:${page}`;

  // One count per visitor per day: a cookie stops refresh-spam from inflating the number.
  const cookie = request.headers.get('Cookie') || '';
  const seen = cookie.includes(`seen_${btoa(page).replace(/=+$/, '')}=1`);

  let count = Number(await env.VISITS.get(key)) || 0;
  if (!seen) {
    count += 1;
    await env.VISITS.put(key, String(count));
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (!seen) {
    headers['Set-Cookie'] = `seen_${btoa(page).replace(/=+$/, '')}=1; Path=/; Max-Age=86400; SameSite=Lax; Secure`;
  }
  return new Response(JSON.stringify({ count }), { headers });
}

// In your fetch handler:
//
//   if (url.pathname === '/api/visits') return handleVisits(request, env);
