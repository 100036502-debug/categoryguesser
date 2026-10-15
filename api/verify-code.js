import crypto from 'crypto';

const ACCESS_CODE = process.env.ACCESS_CODE;
const SESSION_SECRET = process.env.SESSION_SECRET;

function makeToken(code) {
  return crypto.createHmac('sha256', SESSION_SECRET || 'fallback').update(code).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!ACCESS_CODE || !SESSION_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const expectedToken = makeToken(ACCESS_CODE);

  if (req.method === 'GET') {
    const cookies = parseCookies(req.headers.cookie || '');
    return res.status(200).json({ unlocked: cookies['kr_session'] === expectedToken });
  }

  if (req.method === 'POST') {
    const submitted = typeof req.body?.code === 'string' ? req.body.code : '';
    const a = Buffer.from(submitted);
    const b = Buffer.from(ACCESS_CODE);
    const match = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!match) return res.status(401).json({ unlocked: false });

    const isHttps = (req.headers['x-forwarded-proto'] || '').includes('https');
    const cookie = [
      `kr_session=${expectedToken}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      isHttps ? 'Secure' : '',
      'Max-Age=2592000',
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ unlocked: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function parseCookies(header) {
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}
