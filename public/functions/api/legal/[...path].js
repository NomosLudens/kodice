// Cloudflare Pages Function — proxy reverso para a Mini.
// Endpoint same-origin: /api/legal/* → https://mini.taildb6c11.ts.net/api/legal/*
// Somente GETs são proxyados (read-only corpus jurídico).
// Não expõe Station (kaline-box), Héstia, Pi-hole, SSH, Tailscale.

const MINI_BASE = 'https://mini.taildb6c11.ts.net/api/legal';
const ALLOWED_PATHS = /^\/[a-zA-Z0-9_\-\/]+$/;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/^\/api\/legal/, '');
  if (!ALLOWED_PATHS.test(path)) {
    return new Response('Bad path', { status: 400 });
  }
  const target = MINI_BASE + path + url.search;
  try {
    const upstream = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'follow',
    });
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'Access-Control-Allow-Origin': url.origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Accept',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'legal-api-proxy-fail', detail: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions(context) {
  const url = new URL(context.request.url);
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': url.origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept',
    },
  });
}