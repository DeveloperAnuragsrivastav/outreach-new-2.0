/**
 * CampaignBuddy — Local Dev Proxy Server
 * ----------------------------------------
 * Run: node server.js
 * Open: http://localhost:3000
 *
 * NOTE: LOCAL DEV ONLY — remove before production deploy.
 *
 * What it does:
 *  - Serves all frontend static files (replaces Live Server)
 *  - Proxies /rest/v1/* and /auth/v1/* → Supabase REST API (server-side)
 *  - Tunnels WebSocket /realtime/* → Supabase Realtime (server-side TLS tunnel)
 */

const http = require('http');
const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const SUPABASE_HOST = 'mjffvxkothiczayhkjcx.supabase.co';
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

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer, Range, x-client-info');
}

// ── Proxy REST API calls to Supabase ─────────────────────────────
function proxyRest(req, res, fullPath) {
  console.log(`[REST PROXY] ${req.method} ${fullPath}`);

  const options = {
    hostname: SUPABASE_HOST,
    port: 443,
    path: fullPath,
    method: req.method,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Host': SUPABASE_HOST,
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    setCORS(res);
    const headers = { 'Content-Type': proxyRes.headers['content-type'] || 'application/json' };
    if (proxyRes.headers['content-range']) headers['Content-Range'] = proxyRes.headers['content-range'];
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[REST ERROR]', err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

// ── Serve static files ───────────────────────────────────────────
function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
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
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = reqUrl.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    setCORS(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy REST and Auth paths to Supabase
  if (pathname.startsWith('/rest/') || pathname.startsWith('/auth/')) {
    proxyRest(req, res, pathname + reqUrl.search);
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!path.extname(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }

  serveStatic(res, filePath);
});

// ── WebSocket tunnel for Supabase Realtime ───────────────────────
// Browser connects to ws://localhost:3000/realtime/...
// We open a TLS connection to supabase.co and tunnel the WebSocket through it
server.on('upgrade', (req, clientSocket, head) => {
  const wsPath = req.url; // e.g. /realtime/v1/websocket?apikey=...
  console.log(`[WS TUNNEL] ${wsPath}`);

  // Open TLS socket directly to Supabase
  const tlsSocket = tls.connect(
    { host: SUPABASE_HOST, port: 443, servername: SUPABASE_HOST },
    () => {
      // Send the HTTP Upgrade request over TLS
      const upgradeReq =
        `GET ${wsPath} HTTP/1.1\r\n` +
        `Host: ${SUPABASE_HOST}\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${req.headers['sec-websocket-key'] || 'dGhlIHNhbXBsZSBub25jZQ=='}\r\n` +
        `Sec-WebSocket-Version: 13\r\n` +
        (req.headers['sec-websocket-protocol']
          ? `Sec-WebSocket-Protocol: ${req.headers['sec-websocket-protocol']}\r\n`
          : '') +
        `\r\n`;

      tlsSocket.write(upgradeReq);
      if (head && head.length) tlsSocket.write(head);
    }
  );

  tlsSocket.on('error', (err) => {
    console.error('[WS TLS ERROR]', err.message);
    clientSocket.destroy();
  });

  clientSocket.on('error', () => tlsSocket.destroy());

  // Pipe data bidirectionally
  tlsSocket.pipe(clientSocket);
  clientSocket.pipe(tlsSocket);

  tlsSocket.on('end', () => clientSocket.end());
  clientSocket.on('end', () => tlsSocket.end());
});

server.listen(PORT, () => {
  console.log('\n✅ CampaignBuddy Dev Server running!');
  console.log(`   Open: http://localhost:${PORT}`);
  console.log('   Supabase REST + Realtime proxied server-side\n');
});
