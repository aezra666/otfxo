// Cloudflare Worker for otfxo
// - Serves your static files (index.html / script.js / style.css) via the ASSETS binding
// - POST /api/log  -> adds IP + location, forwards to Discord webhook (secret)

const MAX_BODY = 4096;
const ALLOWED_TYPES = new Set(['visit', 'devtools']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/log') {
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

    return env.ASSETS.fetch(request);
  }
};

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
      { name: 'Screen', value: `${data.screen || '?'} (viewport ${data.viewport || '?'})`, inline: true },
      { name: 'Language / TZ', value: `${data.language || '?'} / ${data.timezone || '?'}`, inline: true },
      { name: 'Page', value: data.page || '/', inline: true },
      ...(data.referrer ? [{ name: 'Referrer', value: data.referrer, inline: false }] : []),
      ...(isDevtools ? [{ name: 'How', value: data.how || 'unknown', inline: false }] : []),
    ],
    footer: { text: (data.ua || '').slice(0, 200) }
  };

  await fetch(env.DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'otfxo logger', embeds: [embed] })
  });
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
