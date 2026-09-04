/**
 * Rjadom — reference sync server.
 *
 * Deliberately dependency-free Node: nothing to audit, nothing to update, and it
 * runs on any VPS with a Node runtime. It also serves the built app from ../dist
 * when that exists, so the whole thing lives behind a single hostname. That is
 * the point: one name to keep resolvable and reachable, no third-party CDN, no
 * analytics host, no font host, no auth provider — nothing that can be blocked
 * or can decide on its own to stop serving one of the two countries.
 *
 * Storage is a JSON file. Two people writing one answer a day will not outgrow
 * it; swap in Postgres the day that stops being true.
 *
 *   PAIR_SECRET=<long random string> node server/index.js
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
// Loopback by default: in the recommended setup a TLS terminator sits in front,
// and the Node process has no business being reachable from the open internet.
// Set HOST=0.0.0.0 when running in a container that publishes the port itself.
const HOST = process.env.HOST ?? '127.0.0.1';
const SECRET = process.env.PAIR_SECRET ?? '';
const DATA_DIR = process.env.DATA_DIR ?? join(HERE, 'data');
const DATA_FILE = join(DATA_DIR, 'answers.json');
const STATIC_DIR = process.env.STATIC_DIR ?? join(HERE, '..', 'dist');
// Same-origin deployment needs no CORS at all; set this only if the app is
// served from a different host than the API.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '';
// The only origin the page is allowed to call out to. Change it in step with
// VITE_WEATHER_BASE_URL if you point the app at your own Open-Meteo instance.
const WEATHER_ORIGIN = process.env.WEATHER_ORIGIN ?? 'https://api.open-meteo.com';

if (!SECRET || SECRET.length < 16) {
  console.error('PAIR_SECRET must be set and at least 16 characters. Refusing to start.');
  process.exit(1);
}

const MEMBERS = new Set(['a', 'b']);
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TEXT_CHARS = 4000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------------------------------------------------------------- storage */

let store = { days: {} };
let writeChain = Promise.resolve();

async function loadStore() {
  try {
    store = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    store.days ??= {};
  } catch {
    store = { days: {} };
  }
}

/** Serialised, atomic writes: a crash mid-save must not truncate the file. */
function persist() {
  writeChain = writeChain.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const temporary = `${DATA_FILE}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(store, null, 2), 'utf8');
    await rename(temporary, DATA_FILE);
  });
  return writeChain;
}

/* ------------------------------------------------------------------- auth */

function constantTimeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    // Still compare, so the reply time does not leak the length.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

// The passphrase is the only credential, so make guessing expensive.
const attempts = new Map();
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function throttled(ip) {
  const record = attempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.since > ATTEMPT_WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function noteFailure(ip) {
  const record = attempts.get(ip);
  if (!record || Date.now() - record.since > ATTEMPT_WINDOW_MS) {
    attempts.set(ip, { count: 1, since: Date.now() });
  } else {
    record.count++;
  }
}

function authenticate(req) {
  const member = String(req.headers['x-pair-member'] ?? '');
  const secret = String(req.headers['x-pair-secret'] ?? '');
  if (!MEMBERS.has(member)) return null;
  if (!constantTimeEquals(secret, SECRET)) return null;
  return member;
}

/* ------------------------------------------------------------------ shape */

const otherMember = (member) => (member === 'a' ? 'b' : 'a');

/**
 * The lock-in rule, enforced here rather than in the client.
 *
 * Until you have written, their text does not leave this process — the response
 * carries only the fact that they answered and when. A client-side blur would
 * put the words on the other phone and merely hide them; this does not.
 */
function dayResponse(date, member) {
  const day = store.days[date] ?? {};
  const mine = day[member] ?? null;
  const theirs = day[otherMember(member)] ?? null;

  const partner = {
    answered: Boolean(theirs),
    answeredAt: theirs ? theirs.createdAt : null,
  };
  if (mine && theirs) {
    partner.text = theirs.text;
    partner.updatedAt = theirs.updatedAt;
  }

  return {
    date,
    you: mine ? { text: mine.text, updatedAt: mine.updatedAt } : null,
    partner,
  };
}

/* ------------------------------------------------------------------- http */

function send(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    ...corsHeaders(),
    ...extraHeaders,
  });
  res.end(payload);
}

function corsHeaders() {
  if (!ALLOWED_ORIGIN) return {};
  return {
    'access-control-allow-origin': ALLOWED_ORIGIN,
    'access-control-allow-headers': 'content-type, x-pair-member, x-pair-secret',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * What the page is allowed to do, stated as narrowly as the app actually needs.
 *
 * Everything is served from this origin, so the only outbound connection the
 * page may make is the weather endpoint. `style-src` needs 'unsafe-inline'
 * because the sky is drawn with computed inline styles; nothing else is relaxed.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${WEATHER_ORIGIN}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
  'permissions-policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

/** Static hosting for the built app, so the deployment is a single origin. */
async function serveStatic(req, res, pathname) {
  const relative = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
  let file = join(STATIC_DIR, relative);
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    // Unknown path: hand back the shell and let the app route it.
    file = join(STATIC_DIR, 'index.html');
  }
  try {
    await stat(file);
  } catch {
    send(res, 404, { error: 'not found' });
    return;
  }
  const ext = extname(file);
  // The service worker and the shell must never be pinned by an intermediary;
  // hashed assets can be cached forever.
  const immutable = /\/assets\//.test(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...SECURITY_HEADERS,
  });
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const ip = req.socket.remoteAddress ?? 'unknown';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (!url.pathname.startsWith('/api/')) {
    await serveStatic(req, res, url.pathname);
    return;
  }

  if (throttled(ip)) {
    send(res, 429, { error: 'too many attempts' }, { 'retry-after': '600' });
    return;
  }

  const member = authenticate(req);
  if (!member) {
    noteFailure(ip);
    send(res, 401, { error: 'unauthorized' });
    return;
  }

  // A cheap endpoint whose only job is to tell the unlock screen that the
  // passphrase is right.
  if (url.pathname === '/api/session' && req.method === 'GET') {
    send(res, 200, { ok: true, member });
    return;
  }

  const match = /^\/api\/days\/([^/]+)(\/answer)?$/.exec(url.pathname);
  if (!match) {
    send(res, 404, { error: 'not found' });
    return;
  }

  const date = decodeURIComponent(match[1]);
  if (!DATE_RE.test(date)) {
    send(res, 400, { error: 'bad date' });
    return;
  }

  if (!match[2] && req.method === 'GET') {
    send(res, 200, dayResponse(date, member));
    return;
  }

  if (match[2] && req.method === 'PUT') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      send(res, 400, { error: 'bad body' });
      return;
    }
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > MAX_TEXT_CHARS) {
      send(res, 400, { error: 'bad text' });
      return;
    }
    const updatedAt = Number.isFinite(body?.updatedAt) ? Number(body.updatedAt) : Date.now();

    const day = (store.days[date] ??= {});
    const existing = day[member];
    // Last write wins, but never let a slow retry overwrite a newer edit.
    if (!existing || existing.updatedAt <= updatedAt) {
      day[member] = {
        text,
        questionId: typeof body?.questionId === 'string' ? body.questionId : '',
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt,
      };
      await persist();
    }
    send(res, 200, dayResponse(date, member));
    return;
  }

  send(res, 405, { error: 'method not allowed' });
});

await loadStore();
server.listen(PORT, HOST, () => console.log(`rjadom server on ${HOST}:${PORT}`));
