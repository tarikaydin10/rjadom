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
/**
 * One passphrase per side, which is what makes a side a fact rather than a claim.
 *
 * With a single shared secret the member had to be taken from a header, so
 * anyone holding it could say "I am the other one" and read that person's answer
 * without ever writing their own — defeating the whole lock-in. Derived from
 * which secret matched, that is not possible.
 *
 * PAIR_SECRET still works as a fallback for both sides so an existing
 * deployment keeps running; in that mode the header is honoured again, because
 * the secrets cannot tell the two apart. The startup warning says so.
 */
const SECRETS = {
  a: process.env.PAIR_SECRET_A ?? process.env.PAIR_SECRET ?? '',
  b: process.env.PAIR_SECRET_B ?? process.env.PAIR_SECRET ?? '',
};
const SIDES_DISTINCT = SECRETS.a !== '' && SECRETS.b !== '' && SECRETS.a !== SECRETS.b;
const DATA_DIR = process.env.DATA_DIR ?? join(HERE, 'data');
const DATA_FILE = join(DATA_DIR, 'answers.json');
const STATIC_DIR = process.env.STATIC_DIR ?? join(HERE, '..', 'dist');
// Same-origin deployment needs no CORS at all; set this only if the app is
// served from a different host than the API.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '';
// The only origin the page is allowed to call out to. Change it in step with
// VITE_WEATHER_BASE_URL if you point the app at your own Open-Meteo instance.
const WEATHER_ORIGIN = process.env.WEATHER_ORIGIN ?? 'https://api.open-meteo.com';

if (!SECRETS.a || !SECRETS.b) {
  console.error('Set PAIR_SECRET_A and PAIR_SECRET_B (or PAIR_SECRET for both). Refusing to start.');
  process.exit(1);
}

if (!SIDES_DISTINCT) {
  console.warn(
    'Both sides share one passphrase, so which side a request comes from is taken from a header ' +
      'rather than proven. Anyone holding it can read the other side without answering first. ' +
      'Set PAIR_SECRET_A (Hamburg) and PAIR_SECRET_B (Kaliningrad) to separate values.',
  );
}

// A warning, not a refusal. How much passphrase is enough is the owners' call —
// they know who might come looking — and a server that will not start is a worse
// outcome than a short passphrase they chose on purpose. Said once, at startup,
// so the trade-off is on the record rather than forgotten.
for (const [side, value] of Object.entries(SECRETS)) {
  if (value.length >= 16) continue;
  console.warn(
    `The passphrase for side ${side} is ${value.length} characters. Short passphrases are guessable: ` +
      'the address of this app is not secret, and rate limiting buys time rather than safety. ' +
      'Sixteen or more, ideally several words, if you want the lock to carry the weight.',
  );
}

const MEMBERS = new Set(['a', 'b']);
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TEXT_CHARS = 4000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------------------------------------------------------------- storage */

let store = { days: {}, settings: null };
let writeChain = Promise.resolve();

async function loadStore() {
  try {
    store = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    store.days ??= {};
    store.settings ??= null;
  } catch {
    store = { days: {}, settings: null };
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

/**
 * A second brake, counted globally rather than per address.
 *
 * The per-IP limit assumes the attacker has one address, which is a poor
 * assumption. This one costs nothing to the two people who use this: unlocking
 * happens twice in the life of a deployment, once per phone, so a run of
 * failures is never legitimate traffic. Each failure makes the *next* wrong
 * answer slower for everybody, and an attacker can rotate addresses but cannot
 * rotate the clock.
 *
 * A delay rather than a lockout, deliberately: a hard lock would let a stranger
 * shut the two of you out of your own page by guessing badly on purpose.
 *
 * This buys time against a guessable passphrase. It does not make one safe —
 * only a passphrase that is not in a word list does that.
 */
let globalFailures = 0;
let globalWindowStart = Date.now();
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
// Generous, because a short passphrase is allowed and this is what stands
// between one and a word list. It costs the two real users nothing: they unlock
// once per device, and the first couple of failures still answer instantly.
const MAX_DELAY_MS = 60000;

function failureDelayMs() {
  if (Date.now() - globalWindowStart > GLOBAL_WINDOW_MS) {
    globalFailures = 0;
    globalWindowStart = Date.now();
  }
  // First couple of failures answer instantly — that is a typo, not an attack.
  return Math.min(Math.max(0, globalFailures - 2) * 1500, MAX_DELAY_MS);
}

const sleep = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

function noteFailure(ip) {
  globalFailures++;
  const record = attempts.get(ip);
  if (!record || Date.now() - record.since > ATTEMPT_WINDOW_MS) {
    attempts.set(ip, { count: 1, since: Date.now() });
  } else {
    record.count++;
  }
}

/**
 * Header values are ISO-8859-1, so a passphrase with any character outside that
 * range cannot travel raw — the browser refuses to send it at all. The client
 * encodes the UTF-8 bytes and marks them with a `b64:` prefix; anything without
 * the prefix is taken literally, so a client from before this change still works.
 */
function decodeSecret(raw) {
  if (!raw.startsWith('b64:')) return raw;
  try {
    return Buffer.from(raw.slice(4), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function authenticate(req) {
  const secret = decodeSecret(String(req.headers['x-pair-secret'] ?? ''));
  // Both are always compared, so the reply time does not say which one matched.
  const matchesA = constantTimeEquals(secret, SECRETS.a);
  const matchesB = constantTimeEquals(secret, SECRETS.b);
  if (!matchesA && !matchesB) return null;

  if (SIDES_DISTINCT) return matchesA ? 'a' : 'b';

  // Shared passphrase: the secret cannot tell the sides apart, so fall back to
  // what the client says it is. Warned about at startup.
  const claimed = String(req.headers['x-pair-member'] ?? 'a');
  return MEMBERS.has(claimed) ? claimed : 'a';
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
    await sleep(failureDelayMs());
    send(res, 401, { error: 'unauthorized' });
    return;
  }

  // A cheap endpoint whose only job is to tell the unlock screen that the
  // passphrase is right — and which side it belongs to.
  if (url.pathname === '/api/session' && req.method === 'GET') {
    send(res, 200, { ok: true, member });
    return;
  }

  /**
   * Names, dates and the reunion belong to the two of you, not to whichever
   * device happened to type them. They were per-device, which meant a reunion
   * set on a phone was invisible everywhere else.
   */
  if (url.pathname === '/api/settings') {
    if (req.method === 'GET') {
      send(res, 200, store.settings ?? { settings: null, updatedAt: 0 });
      return;
    }
    if (req.method === 'PUT') {
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        send(res, 400, { error: 'bad body' });
        return;
      }
      if (!body || typeof body.settings !== 'object' || body.settings === null) {
        send(res, 400, { error: 'bad settings' });
        return;
      }
      const updatedAt = Number.isFinite(body.updatedAt) ? Number(body.updatedAt) : Date.now();
      // Last write wins, and a slow retry never overwrites a newer edit.
      if (!store.settings || store.settings.updatedAt <= updatedAt) {
        store.settings = { settings: body.settings, updatedAt };
        await persist();
      }
      send(res, 200, store.settings);
      return;
    }
    send(res, 405, { error: 'method not allowed' });
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
