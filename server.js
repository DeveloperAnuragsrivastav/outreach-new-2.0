/**
 * CampaignBuddy — Local Dev Proxy Server
 * ----------------------------------------
 * Run: node server.js
 * Open: http://localhost:3000
 *
 * NOTE: This file is for LOCAL DEV only.
 * Remove/ignore before deploying to production.
 *
 * What it does:
 *  - Serves all frontend static files (replaces Live Server)
 *  - Proxies /supabase/* → Supabase REST API (server-side, bypasses ISP block)
 *  - Proxies WebSocket /realtime/* → Supabase Realtime WebSocket
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const net = require('net');

const PORT = 3000;
const SUPABASE_HOST = 'mjffvxkothiczayhkjcx.supabase.co';
const SUPABASE_URL = `https://${SUPABASE_HOST}`;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmZ2eGtvdGhpY3pheWhramN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTEyNjEsImV4cCI6MjA4NzY2NzI2MX0.-g4vsENBmQnCk-M7c-k_lax-tTV2BOJEZxtFEDYxgEc';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
};

// ── CORS helper ──────────────────────────────────────────────────
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer, Range, x-client-info');
}

// ── Proxy REST API calls to Supabase ─────────────────────────────
function proxyRest(req, res, supabasePath) {
  const targetPath = supabasePath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  const options = {
    hostname: SUPABASE_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    setCORS(res);
    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[PROXY ERROR]', err.message);
    res.writeHead(502);
    res.end(JSON.stringify({ error: err.message }));
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

// ── Serve static files ───────────────────────────────────────────
function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + filePath);
      return;
    }
    setCORS(res);
    res.setHeader('Content-Type', contentType);
    res.writeHead(200);
    res.end(data);
  });
}

// ── Main HTTP server ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    setCORS(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy: /rest/v1/* → Supabase REST API
  if (pathname.startsWith('/rest/')) {
    const qs = parsed.search || '';
    console.log(`[REST PROXY] ${req.method} ${pathname}${qs}`);
    proxyRest(req, res, pathname + qs);
    return;
  }

  // Proxy: /auth/v1/* → Supabase Auth
  if (pathname.startsWith('/auth/')) {
    const qs = parsed.search || '';
    console.log(`[AUTH PROXY] ${req.method} ${pathname}${qs}`);
    proxyRest(req, res, pathname + qs);
    return;
  }

  // Static files
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (!path.extname(filePath)) filePath = path.join(filePath, 'index.html');

  console.log(`[STATIC] ${pathname}`);
  serveStatic(req, res, filePath);
});

// ── WebSocket proxy for Supabase Realtime ────────────────────────
server.on('upgrade', (req, socket, head) => {
  console.log(`[WS PROXY] Upgrading: ${req.url}`);

  // Connect to Supabase Realtime WebSocket server-side
  const target = net.connect(443, SUPABASE_HOST, () => {
    // Send CONNECT tunnel request (TLS upgrade)
    target.write(
      `GET ${req.url} HTTP/1.1\r\n` +
      `Host: ${SUPABASE_HOST}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${req.headers['sec-websocket-key']}\r\n` +
      `Sec-WebSocket-Version: 13\r\n` +
      (req.headers['sec-websocket-protocol'] ? `Sec-WebSocket-Protocol: ${req.headers['sec-websocket-protocol']}\r\n` : '') +
      `\r\n`
    );
  });

  target.on('error', (err) => {
    console.error('[WS ERROR]', err.message);
    socket.destroy();
  });

  socket.on('error', () => target.destroy());
  target.on('data', (data) => socket.write(data));
  socket.on('data', (data) => target.write(data));
  target.on('end', () => socket.end());
  socket.on('end', () => target.end());
});

server.listen(PORT, () => {
  console.log('\n✅ CampaignBuddy Dev Server running!');
  console.log(`   Open: http://localhost:${PORT}`);
  console.log('   Supabase REST + Realtime proxied server-side\n');
});
