/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 后端参考实现（零依赖）
 * ---------------------------------------------------------------------
 * 设计取舍：
 *   1. 零第三方依赖 —— 只用 Node 内置 http / vm / fs / path，`node server.js` 即跑
 *   2. 规则单一真源 —— 直接用 vm 加载前端的 config / store / engine / api，
 *      服务端与客户端跑的是**同一份战斗与数值代码**，不存在"两套逻辑对不上"
 *   3. 每用户独立沙箱 —— 一个 vm context + 一份 localStorage 影子实现，
 *      因此 store.js 完全不用改就能在服务端运行
 *   4. 落盘为 JSON —— 演示用；生产请换 PostgreSQL（见 schema.sql），
 *      只需替换本文件的 repository 层，业务代码不动
 *
 * 启动：node backend/server.js  [--port 8787]
 * 前端切换：QMHUB.API.useRemote('http://localhost:8787')
 * ========================================================================= */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const PORT = (() => {
  const i = process.argv.indexOf('--port');
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : 8787;
})();

/* 需要加载进沙箱的游戏源文件（顺序敏感） */
const GAME_FILES = [
  'assets/js/data/config.js',
  'assets/js/data/config-ext.js',
  'assets/js/core/store.js',
  'assets/js/core/store-ext.js',
  'assets/js/core/engine.js',
  'assets/js/core/api.js',
  'assets/js/core/api-ext.js'
];

fs.mkdirSync(DATA_DIR, { recursive: true });

/* =========================================================================
 * 一、按用户隔离的沙箱
 * ======================================================================= */
const contexts = new Map();     // username -> { ctx, api, savePath }

function loadGameSource() {
  return GAME_FILES.map(f => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) throw new Error('缺少游戏源文件：' + f);
    return fs.readFileSync(p, 'utf8');
  }).join('\n;\n');
}
const GAME_SOURCE = loadGameSource();

function makeStorage(savePath) {
  let mem = null;
  function read() {
    if (mem) return mem;
    mem = {};
    try {
      if (fs.existsSync(savePath)) mem = JSON.parse(fs.readFileSync(savePath, 'utf8')) || {};
    } catch (e) { mem = {}; }
    return mem;
  }
  function flush() {
    try { fs.writeFileSync(savePath, JSON.stringify(mem || {})); } catch (e) { /* ignore */ }
  }
  return {
    getItem: k => { const v = read()[k]; return v === undefined ? null : v; },
    setItem: (k, v) => { read()[k] = String(v); flush(); },
    removeItem: k => { delete read()[k]; flush(); },
    clear: () => { mem = {}; flush(); },
    key: i => Object.keys(read())[i] || null,
    get length() { return Object.keys(read()).length; }
  };
}

function getSession(username) {
  if (contexts.has(username)) return contexts.get(username);

  const safe = username.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');
  const savePath = path.join(DATA_DIR, safe + '.json');

  const sandbox = {
    console: { log: (...a) => console.log('[game]', ...a), warn: () => {}, error: (...a) => console.error('[game]', ...a) },
    localStorage: makeStorage(savePath),
    setTimeout, clearTimeout, Math, Date, JSON, Object, Array, String, Number, Boolean, Error, RegExp, Promise, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(GAME_SOURCE, ctx, { filename: 'game-bundle.js' });

  const Q = sandbox.QMHUB;
  if (!Q || !Q.API) throw new Error('游戏代码加载失败');

  // 服务端复算：禁止 remote 模式回环
  Q.API.mode = 'local';

  // 初始化存档（store.load 内部会做版本迁移与每日重置）
  Q.Store.load();
  if (Q.Store.dailyExtCheck) Q.Store.dailyExtCheck();
  Q.Store.save();

  const session = { ctx, Q, api: Q.API, store: Q.Store, savePath, username };
  contexts.set(username, session);
  return session;
}

/* =========================================================================
 * 二、路由表（与前端 API.routes 完全对齐）
 * ======================================================================= */
function buildRoutes() {
  const s = getSession('__probe__');
  const routes = [];
  Object.keys(s.api.routes).forEach(key => {
    const [method, p] = key.split(' ');
    const names = p.split('/').filter(Boolean);
    const re = new RegExp('^/' + names.map(seg =>
      seg.startsWith(':') ? '([^/]+)' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('/') + '$');
    routes.push({ method, re, handler: s.api.routes[key], spec: p });
  });
  // 不对外暴露探针会话，并清掉它产生的临时存档
  const probe = contexts.get('__probe__');
  contexts.delete('__probe__');
  if (probe) { try { fs.unlinkSync(probe.savePath); } catch (e) { /* ignore */ } }
  return routes;
}

/* =========================================================================
 * 三、工具
 * ======================================================================= */
function send(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}
const ok = (res, data) => send(res, 200, { code: 0, message: 'ok', data });
const fail = (res, msg, code = 400) => send(res, code, { code, message: msg });

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 1e6) { req.destroy(); resolve({}); return; }
      raw += c;
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.map': 'application/json'
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/assets/petworld.html';
  const target = path.normalize(path.join(ROOT, rel));
  if (!target.startsWith(ROOT)) return fail(res, 'Forbidden', 403);   // 防目录穿越
  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) return fail(res, 'Not Found', 404);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': pathname.endsWith('.html') ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(target).pipe(res);
  });
}

/* =========================================================================
 * 四、请求处理
 * ======================================================================= */
let ROUTES = null;

async function handleApi(req, res, pathname, query, body) {
  // 认证：demo 用 username 换 token；生产请替换为 JWT / Session
  let username = 'guest';
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    try { username = Buffer.from(auth.slice(7), 'base64').toString('utf8') || 'guest'; } catch (e) { username = 'guest'; }
  }
  if (pathname === '/api/auth/login') {
    const name = (body.username || '').trim() || ('guest_' + Math.random().toString(36).slice(2, 8));
    getSession(name);
    return ok(res, { token: Buffer.from(name, 'utf8').toString('base64'), username: name });
  }
  if (pathname === '/api/health') {
    return ok(res, { status: 'up', rooms: contexts.size, uptime: Math.round(process.uptime()) });
  }

  const route = ROUTES.find(r => r.method === req.method && r.re.test(pathname));
  if (!route) return fail(res, '未知接口: ' + req.method + ' ' + pathname, 404);

  const m = pathname.match(route.re);
  const args = m.slice(1).map(a => {
    const n = Number(a);
    return (a !== '' && !isNaN(n) && String(n) === a) ? n : a;
  });

  let session;
  try { session = getSession(username); }
  catch (e) { return fail(res, '会话初始化失败: ' + e.message, 500); }

  const fn = session.api[route.handler];
  if (typeof fn !== 'function') return fail(res, '接口未实现: ' + route.handler, 501);

  try {
    // API 层方法返回 Promise，且内部已做规则校验与存档落盘
    const data = await fn.apply(session.api, args);
    return ok(res, data);
  } catch (e) {
    return fail(res, e && e.message ? e.message : String(e), 400);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  const parsed = new URL(req.url, 'http://localhost');
  const pathname = parsed.pathname;

  if (pathname.startsWith('/api/')) {
    const body = req.method === 'GET' ? {} : await readBody(req);
    return handleApi(req, res, pathname, parsed.searchParams, body);
  }
  return serveStatic(req, res, pathname);
});

try {
  ROUTES = buildRoutes();
} catch (e) {
  console.error('❌ 路由初始化失败：', e.message);
  console.error('   请确认在项目根目录执行：node backend/server.js');
  process.exit(1);
}

server.listen(PORT, () => {
  console.log('');
  console.log('  🐯 灵兽家族 · 后端已启动');
  console.log('  ────────────────────────────────────────');
  console.log('  游戏页面 : http://localhost:' + PORT + '/assets/petworld.html');
  console.log('  论坛页面 : http://localhost:' + PORT + '/index.html');
  console.log('  健康检查 : http://localhost:' + PORT + '/api/health');
  console.log('  已注册接口 : ' + ROUTES.length + ' 个');
  console.log('  存档目录 : ' + DATA_DIR);
  console.log('  ────────────────────────────────────────');
  console.log('  前端接入 : QMHUB.API.useRemote(\'http://localhost:' + PORT + '\')');
  console.log('');
});
