// Cloudflare Worker for otfxo
// - Serves your static files (index.html / script.js / style.css) via the ASSETS binding
// - POST /api/log  -> adds IP + location, forwards to Discord webhook (secret)

const MAX_BODY = 4096;
const ALLOWED_TYPES = new Set(['visit', 'devtools']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/log') {
      // Debug: open /api/log?test=1 in a browser to send a test message
      // and see exactly what Discord replies.
      if (request.method === 'GET' && url.searchParams.get('test') === '1') {
        if (!env.DISCORD_WEBHOOK) return new Response('DISCORD_WEBHOOK secret is missing', { status: 500 });
        const res = await fetch(env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'otfxo logger', content: '✅ test from worker — logger is connected' })
        });
        const text = await res.text();
        return new Response(`Discord replied: ${res.status} ${res.statusText}\n${text}`, {
          status: 200, headers: { 'Content-Type': 'text/plain' }
        });
      }

      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      // only accept beacons from your own site
      const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';
      if (origin && !origin.startsWith(url.origin)) {
        return new Response('Forbidden', { status: 403 });
      }
      ctx.waitUntil(handleLog(request, env));
      return new Response(null, { status: 204 });
    }

    // Log page visits server-side: fires when the HTML page itself is requested.
    // No browser JS needed, so it can't be broken by caching or script errors.
    const isPage = request.method === 'GET' &&
      (url.pathname === '/' || url.pathname === '/index.html') &&
      (request.headers.get('Accept') || '').includes('text/html');
    if (isPage) {
      ctx.waitUntil(sendVisit(request, env));
    }

    return env.ASSETS.fetch(request);
  }
};

async function sendVisit(request, env) {
  if (!env.DISCORD_WEBHOOK) return;
  const ua = request.headers.get('User-Agent') || '';
  const data = {
    type: 'visit',
    page: new URL(request.url).pathname,
    referrer: request.headers.get('Referer') || null,
    language: (request.headers.get('Accept-Language') || '').split(',')[0] || null,
    timezone: request.cf?.timezone || null,
    touch: /Mobi|Android|iPhone|iPad/i.test(ua),
    ua
  };
  await sendEmbed(request, env, data);
}

async function handleLog(request, env) {
  if (!env.DISCORD_WEBHOOK) return;

  let data = {};
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return;
    data = JSON.parse(text);
  } catch {
    return;
  }
  if (!ALLOWED_TYPES.has(data.type)) return;

  await sendEmbed(request, env, data);
}

async function sendEmbed(request, env, data) {
  const cf = request.cf || {};
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const location = [cf.city, cf.region, cf.country].filter(Boolean).join(', ') || 'unknown';
  const { browser, os } = parseUA(data.ua || '');

  const isDevtools = data.type === 'devtools';
  const embed = {
    title: isDevtools ? '🛠️ devtools attempt' : '👁️ new visit',
    color: isDevtools ? 0xff3333 : 0x39ff14,
    timestamp: new Date().toISOString(),
    fields: [
      { name: 'IP', value: `\`${ip}\``, inline: true },
      { name: 'Location', value: location, inline: true },
      { name: 'ISP', value: cf.asOrganization || 'unknown', inline: true },
      { name: 'Browser', value: browser, inline: true },
      { name: 'OS', value: os, inline: true },
      { name: 'Device', value: data.touch ? 'touch / mobile' : 'desktop', inline: true },
      ...(data.screen ? [{ name: 'Screen', value: `${data.screen} (viewport ${data.viewport || '?'})`, inline: true }] : []),
      { name: 'Language / TZ', value: `${data.language || '?'} / ${data.timezone || '?'}`, inline: true },
      { name: 'Page', value: data.page || '/', inline: true },
      ...(data.referrer ? [{ name: 'Referrer', value: String(data.referrer).slice(0, 1000), inline: false }] : []),
      ...(isDevtools ? [{ name: 'How', value: data.how || 'unknown', inline: false }] : []),
    ],
    footer: { text: (data.ua || 'no user agent').slice(0, 200) }
  };

  const res = await fetch(env.DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'otfxo logger', embeds: [embed] })
  });
  if (!res.ok) {
    console.error('Discord webhook failed', res.status, await res.text());
  }
}

function parseUA(ua) {
  let browser = 'Unknown';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('SamsungBrowser/')) browser = 'Samsung Internet';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('CriOS/') || ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'Unknown';
  if (ua.includes('Android')) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return { browser, os };
}
