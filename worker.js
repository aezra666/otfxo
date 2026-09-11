// Cloudflare Worker for otfxo
// - Serves your static files (index.html / script.js / style.css) via the ASSETS binding
// - POST /api/log     -> adds IP + location, forwards to Discord webhook (secret)
// - GET  /api/visits  -> per-page visitor counter stored in KV (binding: VISITS)

const MAX_BODY = 4096;
const ALLOWED_TYPES = new Set(['visit']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.hostname === 'www.otfxo.com') {
      return Response.redirect(`https://otfxo.com${url.pathname}${url.search}`, 301);
    }

    const cleanPageAssets = {
      '/aezra': '/aezra.html',
      '/jay': '/jay.html'
    };
    const assetPath = cleanPageAssets[url.pathname] || url.pathname;

    if (url.pathname === '/api/my-ip' && request.method === 'GET') {
      const ip = request.headers.get('cf-connecting-ip') || 'unavailable';
      return new Response(JSON.stringify({ ip }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    if (url.pathname === '/api/visits' && request.method === 'GET') {
      return handleVisits(request, env);
    }

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

      // Simple GET beacon for visitor events.
      if (request.method === 'GET' && url.searchParams.get('e')) {
        const p = url.searchParams;
        const data = {
          type: p.get('e'),
          how: p.get('how') || 'unknown',
          page: p.get('page') || '/',
          referrer: p.get('ref') || null,
          language: p.get('lang') || null,
          timezone: p.get('tz') || null,
          screen: p.get('screen') || null,
          viewport: p.get('vp') || null,
          touch: p.get('touch') === '1',
          ua: request.headers.get('User-Agent') || ''
        };
        if (ALLOWED_TYPES.has(data.type)) {
          ctx.waitUntil(sendEmbed(request, env, data));
        }
        return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
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
      (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/aezra.html' || url.pathname === '/jay.html' || cleanPageAssets[url.pathname]) &&
      (request.headers.get('Accept') || '').includes('text/html');
    if (isPage) {
      ctx.waitUntil(sendVisit(request, env));
    }

    // Protect source files from view-source / direct opening, WITHOUT breaking
    // normal page loads. A real page loading these sends Sec-Fetch-Dest of
    // "script" or "style"; view-source and address-bar hits send "document"
    // (or navigate mode). Only block those, and only when we actually know it's
    // a navigation — never block when the header is missing (some browsers omit it).
    if (url.pathname === '/script.js' || url.pathname === '/style.css' || url.pathname === '/eye.js') {
      const dest = request.headers.get('Sec-Fetch-Dest');
      const mode = request.headers.get('Sec-Fetch-Mode');
      const isDirectView = dest === 'document' || mode === 'navigate';
      if (isDirectView) {
        return new Response('403', { status: 403, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    // Serve the HTML minified: collapse whitespace and strip comments so
    // Page Source shows one unreadable line instead of clean markup.
    if (isPage) {
      const assetRequest = assetPath === url.pathname
        ? request
        : new Request(new URL(assetPath, url), request);
      const assetRes = await env.ASSETS.fetch(assetRequest);
      let html = await assetRes.text();
      html = html
        .replace(/<!--[\s\S]*?-->/g, '')        // drop HTML comments
        .replace(/\n\s*/g, '')                    // remove line breaks + indentation
        .replace(/>\s+</g, '><')                  // squeeze space between tags
        .trim();
      return new Response(html, {
        status: assetRes.status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};

// ---- visitor counter -------------------------------------------------------
async function handleVisits(request, env) {
  const url = new URL(request.url);
  const page = (url.searchParams.get('page') || '/').slice(0, 100);
  const key = `visits:${page}`;

  if (!env.VISITS) {
    return new Response(JSON.stringify({ error: 'VISITS KV binding missing' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }

  // One count per visitor per day: a cookie stops refresh-spam from inflating the number.
  const cookieName = `seen_${page.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const cookie = request.headers.get('Cookie') || '';
  const seen = cookie.includes(`${cookieName}=1`);

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
    headers['Set-Cookie'] = `${cookieName}=1; Path=/; Max-Age=86400; SameSite=Lax; Secure`;
  }
  return new Response(JSON.stringify({ count }), { headers });
}

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

  const embed = {
    title: '👁️ new visit',
    color: 0x39ff14,
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
