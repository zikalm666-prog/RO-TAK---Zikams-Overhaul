// ==UserScript==
// @name         RO-TAK - Zikam's Tactical Overhaul
// @namespace    https://github.com
// @version      0.7.1b
// @description  RO-TAK C2 UI Overhaul, Right-Click Radial Menu, Guided 9-Line MEDEVAC/CAS, MGRS Telemetry & Native Maps for RO-TAK
// @author       Zikam (@zikaalm)
// @icon         https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/icon-192.png
// @match        https://ro-tak.vercel.app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      raw.githubusercontent.com
// @connect      ro-tak.vercel.app
// @updateURL    https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/zikam-rotak-overhaul.user.js
// @downloadURL  https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/zikam-rotak-overhaul.user.js
// @run-at       document-start
// @noframes
// ==/UserScript==

/*
 * DEBUG URL PARAMETERS
 *   ?rotak=off    run the ORIGINAL RO-TAK (script does nothing)
 *   ?rotak=cache  skip GitHub and use the last good cached build
 *   ?rotak=reset  clear cached build and cached maps, then reload everything
 */

(function () {
  'use strict';

  // ------------------------------------------------------------------ config
  const SCRIPT_VERSION = '0.7.1b';
  const REPO_SLUG = 'zikalm666-prog/RO-TAK---Zikams-Overhaul';
  const REPO_REF = 'v0.7.1b';            
  const REPO_URL = 'https://github.com/' + REPO_SLUG;
  const RAW_ROOT = 'https://raw.githubusercontent.com/' + REPO_SLUG + '/';
  const DOWNLOAD_URL = RAW_ROOT + 'main/zikam-rotak-overhaul.user.js';
  const FETCH_TIMEOUT_MS = 15000;
  const BIG_FETCH_TIMEOUT_MS = 5 * 60 * 1000; // 15K/16K maps are big
  const REVALIDATE_MS = 12 * 60 * 60 * 1000;  // re-check cached maps against GitHub at most every 12 h
  const HEALTH_WINDOW_MS = 5000;              // a build is "good" if it runs this long without script errors

  let contentRef = REPO_REF;
  let contentBase = RAW_ROOT + contentRef + '/';
  function fallBackToMain() { contentRef = 'main'; contentBase = RAW_ROOT + 'main/'; }

  const UPSTREAM_ASSETS = new Set([
    'images/avatar.webp', 'images/og.png', 'images/poppy.png',
    'images/os-apple.png', 'images/os-intel.png', 'images/os-windows.png',
    'images/intro/laptop.webp', 'images/intro/phone.webp',
    'images/intro/se_arm.svg', 'images/intro/se_inf.svg', 'images/intro/se_mech.svg',
    'images/intro/sf_arm.svg', 'images/intro/sf_inf.svg', 'images/intro/sf_rec.svg',
    'images/landing/1.jpg', 'images/landing/2.jpg', 'images/landing/aqwerd.jpg',
    'images/landing/map1.webp', 'images/landing/messey.jpg', 'images/landing/southern.jpg'
  ]);

  const FORCE_REPO_ASSETS = new Set(['icon-192.png', 'icon-512.png']);
  // Huge native maps: not prefetched, fetched on demand when the user presses LOAD.
  const LAZY_ASSET_RE = /(^|\/)(SawangFull|Rono16k)\.png$/i;
  const SAFE_ASSET_RE = /^(images\/[\w\-.\/]+\.(png|jpe?g|webp|gif|ico|svg)|icon-(192|512)\.png)$/i;

  const APP_ROUTES = ['/', '/index.html', '/play', '/play/'];
  const SKIP_PREFIXES = ['/api/', '/_vercel/', '/.well-known/'];

  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon', svg: 'image/svg+xml' };
  const log = (...a) => console.log('[RO-TAK Overhaul]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ------------------------------------------------------------ route checks
  if (window.top !== window.self) return; // never run inside iframes
  const path = location.pathname;
  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) return;
  // Static files (sw.js, manifest, images...) are left alone.
  if (/\.[a-z0-9]{1,8}$/i.test(path) && !/\.html?$/i.test(path)) return;

  const FORCE = new URLSearchParams(location.search).get('rotak'); // off | cache | reset
  if (FORCE === 'off') { log('disabled by ?rotak=off'); return; }

  if (window.__ROTAK_ENHANCED_LOADED__) return;
  window.__ROTAK_ENHANCED_LOADED__ = true;

  function navStatus() {
    try {
      const e = performance.getEntriesByType('navigation')[0];
      return (e && e.responseStatus) || 0;
    } catch (_) { return 0; }
  }
  const status = navStatus();
  const MODE = (status === 404 || (!status && !APP_ROUTES.includes(path))) ? '404' : 'app';
  log('started v' + SCRIPT_VERSION + ' | pin =', REPO_REF, '| mode =', MODE, '| path =', path, '| http status =', status || 'n/a');

  // ------------------------------------------------------------- DOM ready
  const domReady = new Promise((resolve) => {
    if (document.readyState !== 'loading') return resolve();
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    setTimeout(resolve, 3000); // window.stop() can swallow DOMContentLoaded
  });
  try { window.stop(); } catch (_) {}

  // --------------------------------------------------------- loading screen
  function renderLoadingScreen() {
    const root = document.documentElement || document.appendChild(document.createElement('html'));
    root.innerHTML =
      '<head><meta charset="utf-8"><title>RO-TAK // Zikam\'s Overhaul</title></head>' +
      '<body style="margin:0;background:#090b09;color:#00ff41;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;">' +
      '<div style="border:1px solid #00ff41;padding:18px 30px;background:#0d100d;text-align:center;max-width:80vw;">' +
      '<div style="font-size:15px;font-weight:800;letter-spacing:2px;">INITIALIZING RO-TAK OVERHAUL...</div>' +
      '<div id="rotak-status" style="font-size:10px;color:#94a3b8;margin-top:6px;">SYNCING MODULES FROM GITHUB</div>' +
      '<div id="rotak-actions" style="margin-top:12px;"></div>' +
      '</div></body>';
  }
  function setStatus(msg, isError) {
    log(msg);
    const el = document.getElementById('rotak-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#ff4d4d' : '#94a3b8';
  }
  function showErrorActions() {
    const box = document.getElementById('rotak-actions');
    if (!box) return;
    const css = 'display:inline-block;margin:0 4px;padding:6px 12px;border:1px solid #00ff41;background:#0d100d;color:#00ff41;font:700 10px monospace;letter-spacing:1px;text-decoration:none;cursor:pointer;';
    box.textContent = '';
    const retry = document.createElement('a');
    retry.textContent = 'RETRY'; retry.style.cssText = css; retry.href = location.href;
    retry.onclick = function (e) { e.preventDefault(); location.reload(); };
    const orig = document.createElement('a');
    orig.textContent = 'LOAD ORIGINAL RO-TAK'; orig.style.cssText = css;
    orig.href = location.pathname + '?rotak=off';
    box.append(retry, orig);
  }

  // ------------------------------------------------------------ GM helpers
  function gmGet(url, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      try {
        const details = {
          method: opts.method || 'GET',
          url,
          responseType: opts.blob ? 'blob' : 'text',
          timeout: opts.timeout || FETCH_TIMEOUT_MS,
          onload: (res) => {
            if (res.status >= 200 && res.status < 300) resolve(res);
            else { const err = new Error('HTTP ' + res.status + ' -> ' + url.replace(/\?.*$/, '')); err.status = res.status; reject(err); }
          },
          onerror: () => reject(new Error('Request failed (blocked by an extension or no network): ' + url)),
          ontimeout: () => reject(new Error('Timeout: ' + url)),
          onabort: () => reject(new Error('Aborted: ' + url))
        };
        if (opts.onProgress) details.onprogress = (e) => opts.onProgress(e.loaded || 0, e.total || 0);
        GM_xmlhttpRequest(details);
      } catch (e) { reject(e); }
    });
  }
  // Retries network hiccups, but never retries a definitive 404/403.
  async function gmGetRetry(url, opts, tries) {
    let last;
    for (let i = 0; i < tries; i++) {
      try { return await gmGet(url, opts); }
      catch (e) { last = e; if (e.status === 404 || e.status === 403) break; if (i < tries - 1) await sleep(600 * (i + 1)); }
    }
    throw last;
  }
  const hdr = (res, name) => {
    const m = new RegExp('^' + name + ':\\s*(.+)$', 'im').exec(res.responseHeaders || '');
    return m ? m[1].trim() : '';
  };
  const extOf = (p) => { const m = p.match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : ''; };
  const normPath = (p) => p.replace(/^(\.\/|\/)+/, '');
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('FileReader failed'));
      fr.readAsDataURL(blob);
    });
  }

  // ------------------------------------------------ IndexedDB asset cache
  const DB_NAME = 'rotak-overhaul-cache', STORE = 'assets';
  let dbPromise = null;
  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(STORE);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch (_) { resolve(null); }
      });
    }
    return dbPromise;
  }
  async function idb(mode, fn) {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req && 'result' in req ? req.result : true);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }
  const idbGet = (k) => idb('readonly', (s) => s.get(k));
  const idbPut = (k, v) => idb('readwrite', (s) => s.put(v, k));
  const idbClear = () => idb('readwrite', (s) => s.clear());
  let persistAsked = false;
  function askPersist() {
    if (persistAsked) return;
    persistAsked = true;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (_) {}
  }

  // ---------------------------------------------- progress (userscript -> page)
  let lastProg = 0;
  function reportProgress(p, info, force) {
    const now = Date.now();
    if (!force && now - lastProg < 80) return;
    lastProg = now;
    info.path = p;
    window.postMessage('rotak:prog:' + JSON.stringify(info), location.origin);
  }

  // ---------------------------------------------- repo assets (cache + network)
  function fetchRepoBlob(p, timeout, onProgress) {
    return gmGet(contentBase + p, { blob: true, timeout, onProgress }).then((res) => {
      const b = res.response;
      return {
        blob: new Blob([b], { type: MIME[extOf(p)] || b.type || 'application/octet-stream' }),
        etag: hdr(res, 'etag')
      };
    });
  }

  // Stale-while-revalidate: serve the cached copy now, check GitHub in the background.
  function revalidate(p, hit) {
    if (Date.now() - (hit.checked || 0) < REVALIDATE_MS) return;
    GM_xmlhttpRequest({
      method: 'HEAD', url: contentBase + p, timeout: 10000,
      onload: (res) => {
        if (res.status < 200 || res.status >= 300) return;
        const len = parseInt(hdr(res, 'content-length') || '0', 10);
        const etag = hdr(res, 'etag');
        const lenChanged = !hdr(res, 'content-encoding') && len > 0 && len !== hit.size;
        const etagChanged = !!(etag && hit.etag && hit.ref === contentRef && etag !== hit.etag);
        if (!lenChanged && !etagChanged) { idbPut(p, Object.assign({}, hit, { checked: Date.now() })); return; }
        log('cached asset changed upstream, refreshing in background:', p);
        fetchRepoBlob(p, BIG_FETCH_TIMEOUT_MS).then((got) =>
          idbPut(p, { blob: got.blob, size: got.blob.size, etag: got.etag, ref: contentRef, checked: Date.now() })
        ).catch(() => {});
      },
      onerror: () => {}, ontimeout: () => {}
    });
  }

  async function loadAssetBlob(p, interactive) {
    const hit = await idbGet(p);
    if (hit && hit.blob && hit.blob.size > 0) {
      if (interactive) reportProgress(p, { phase: 'cache' }, true);
      revalidate(p, hit);
      return hit.blob;
    }
    const got = await fetchRepoBlob(p, BIG_FETCH_TIMEOUT_MS,
      interactive ? (loaded, total) => reportProgress(p, { phase: 'download', loaded, total }) : null);
    await idbPut(p, { blob: got.blob, size: got.blob.size, etag: got.etag, ref: contentRef, checked: Date.now() });
    if (got.blob.size > 5 * 1048576) askPersist();
    return got.blob;
  }

  // ---------------------------------------------- lazy asset bridge (page <-> userscript)
  // The page cannot read raw.githubusercontent.com (header CSP + CORS), so the page asks
  // the userscript through postMessage and gets back a blob: URL (allowed by img-src).
  const assetCache = new Map();
  function resolveAsset(p, mode, interactive) {
    const key = mode + ':' + p;
    if (!assetCache.has(key)) {
      assetCache.set(key, loadAssetBlob(p, interactive)
        .then((blob) => (mode === 'data' ? blobToDataUrl(blob) : URL.createObjectURL(blob)))
        .catch((e) => { assetCache.delete(key); throw e; }));
    }
    return assetCache.get(key);
  }
  window.addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return;
    const d = ev.data;
    if (typeof d !== 'string' || d.indexOf('rotak:req:') !== 0) return;
    let req;
    try { req = JSON.parse(d.slice(10)); } catch (_) { return; }
    const reply = (o) => window.postMessage('rotak:res:' + JSON.stringify(o), location.origin);
    const p = normPath(String(req.path));
    if (!SAFE_ASSET_RE.test(p) || p.indexOf('..') !== -1) { reply({ id: req.id, error: 'Path not allowed: ' + p }); return; }
    resolveAsset(p, req.mode === 'data' ? 'data' : 'blob', true)
      .then((url) => reply({ id: req.id, url }), (err) => reply({ id: req.id, error: String((err && err.message) || err) }));
  });

  // ------------------------------------------- last good build (GM storage)
  const goodKey = (file) => 'good:' + file;
  function looksValid(text) { return typeof text === 'string' && text.length > 3000 && /<\/html>/i.test(text); }
  function readGood(file) {
    try {
      const g = GM_getValue(goodKey(file), null);
      return g && looksValid(g.text) ? g : null;
    } catch (_) { return null; }
  }
  function saveGood(file, src, pkg) {
    try {
      const prev = GM_getValue(goodKey(file), null);
      if (prev && prev.text === src.text) return;
      GM_setValue(goodKey(file), { text: src.text, ref: src.ref, pkg: pkg || null, time: Date.now(), script: SCRIPT_VERSION });
      log('saved last good build of ' + file + ' (' + src.ref + ')');
    } catch (e) { log('could not cache build:', e.message); }
  }
  async function clearCaches() {
    try { GM_deleteValue(goodKey('index.html')); GM_deleteValue(goodKey('404.html')); } catch (_) {}
    await idbClear();
    log('caches cleared');
  }
  // A build is only stored as "good" if it ran for a few seconds without uncaught script errors.
  // Best effort: if the browser does not forward page errors to the userscript, it just caches.
  function watchHealth(onGood) {
    let bad = 0;
    const onErr = (e) => {
      const t = e && e.target;
      if (t && t !== window && t.tagName && t.tagName !== 'SCRIPT') return; // broken <img> etc. is not fatal
      const m = String((e && (e.message || (e.reason && e.reason.message))) || '');
      if (/ResizeObserver/i.test(m)) return;
      bad++;
      log('startup error seen:', m || '(script load error)');
    };
    window.addEventListener('error', onErr, true);
    window.addEventListener('unhandledrejection', onErr);
    setTimeout(() => {
      window.removeEventListener('error', onErr, true);
      window.removeEventListener('unhandledrejection', onErr);
      if (!bad) onGood(); else log('build NOT cached: ' + bad + ' error(s) during startup');
    }, HEALTH_WINDOW_MS);
  }

  // ------------------------------------------------------- downloads (pinned)
  async function fetchSource(file) {
    const bust = () => (contentRef === 'main' ? '?t=' + Date.now() : '');
    try {
      const res = await gmGetRetry(contentBase + file + bust(), {}, 2);
      return { text: res.responseText, ref: contentRef };
    } catch (e) {
      // Pin missing (tag not created yet): fall back to main instead of breaking.
      if (e.status === 404 && contentRef !== 'main') {
        log('pin "' + contentRef + '" not found, falling back to main');
        fallBackToMain();
        const res = await gmGetRetry(contentBase + file + bust(), {}, 2);
        return { text: res.responseText, ref: contentRef };
      }
      throw e;
    }
  }
  function fetchPackage() {
    return gmGetRetry(contentBase + 'package.json' + (contentRef === 'main' ? '?t=' + Date.now() : ''), {}, 2)
      .then((res) => JSON.parse(res.responseText))
      .catch((e) => { log('package.json not available:', e.message); return null; });
  }
  // Newest released script = @version of the user.js on main (what Tampermonkey itself updates from).
  function fetchLatestScriptVersion() {
    return gmGet(DOWNLOAD_URL + '?t=' + Date.now(), { timeout: 8000 })
      .then((res) => { const m = /@version\s+(\S+)/.exec((res.responseText || '').slice(0, 3000)); return m ? m[1] : ''; })
      .catch(() => '');
  }
  const verNums = (v) => (String(v).match(/\d+/g) || []).map(Number);
  function isNewer(a, b) {
    const x = verNums(a), y = verNums(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
    return false;
  }

  // ------------------------------------------------------ HTML rewrite
  const ASSET_RE = /(?<![\w:.\/-])(?:\.\/|\/)?(images\/[\w\-.\/]+\.(?:png|jpe?g|webp|gif|ico)|icon-(?:192|512)\.png)(?![\w\-])/gi;

  function isEagerRepoAsset(p) {
    if (FORCE_REPO_ASSETS.has(p)) return true;
    if (UPSTREAM_ASSETS.has(p)) return false;
    if (LAZY_ASSET_RE.test(p)) return false;
    return true; // unknown to upstream => it only exists in the repo
  }

  function rewriteHtml(html, pkg) {
    let out = html
      .replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '')
      .replace(/src=["']\.?\/?milsymbol\.js["']/g, 'src="https://ro-tak.vercel.app/milsymbol.js"')
      .replace(/src=["']\.?\/?symdata\.js["']/g, 'src="https://ro-tak.vercel.app/symdata.js"')
      .replace(/src=["']\.?\/?supabase\.js["']/g, 'src="https://ro-tak.vercel.app/supabase.js"')
      .replace(/<link rel="manifest"[^>]*>/i, '');

    if (MODE === '404') {
      out = out
        .replace(/,\s*url\(['"]https:\/\/githubusercontent\.com['"]\)/g, '') // dead fallback url in 404.html
        .replace(/href=["']https:\/\/github\.com["']/g, 'href="' + REPO_URL + '"');
    }
    if (pkg && pkg.version) {
      out = out.replace(/\bv\d+\.\d+\.\d+[a-z]*\b/g, 'v' + pkg.version);
    }
    return out;
  }

  async function inlineRepoAssets(html) {
    const wanted = new Set();
    html.replace(ASSET_RE, (m, p) => { if (isEagerRepoAsset(p)) wanted.add(p); return m; });
    const list = Array.from(wanted);
    if (!list.length) return html;

    const urls = new Map();
    let done = 0;
    const queue = list.slice();
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift();
        try { urls.set(p, await resolveAsset(p, 'blob', false)); }
        catch (e) { log('asset skipped:', p, '-', e.message); }
        done++;
        setStatus('SYNCING ASSETS ' + done + '/' + list.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return html.replace(ASSET_RE, (m, p) => urls.get(p) || m);
  }

  // ---- code that runs inside the page (context of the RO-TAK app) ----
  function pageHook(cfg) {
    var pending = {}, seq = 0;
    window.addEventListener('message', function (ev) {
      if (ev.origin !== location.origin || typeof ev.data !== 'string') return;
      var o;
      if (ev.data.indexOf('rotak:prog:') === 0) {   // download progress -> map loading HUD
        try { o = JSON.parse(ev.data.slice(11)); } catch (_) { return; }
        try { if (window.atakLoadProgress) window.atakLoadProgress(o); } catch (_) {}
        return;
      }
      if (ev.data.indexOf('rotak:res:') !== 0) return;
      try { o = JSON.parse(ev.data.slice(10)); } catch (_) { return; }
      var p = pending[o.id]; if (!p) return;
      delete pending[o.id];
      if (o.error) p.rej(new Error(o.error)); else p.res(o.url);
    });
    function ask(path, mode) {
      return new Promise(function (res, rej) {
        var id = ++seq; pending[id] = { res: res, rej: rej };
        window.postMessage('rotak:req:' + JSON.stringify({ id: id, path: path, mode: mode }), location.origin);
      });
    }
    var upstream = {}; cfg.upstream.forEach(function (p) { upstream[p] = 1; });
    var needsRepo = function (src) {
      if (typeof src !== 'string') return false;
      var m = src.match(/^(?:\.\/|\/)?(images\/.+)$/);
      return !!m && !upstream[m[1]];
    };
    var spinner = function (on) { try { if (window.showAtakLoading) window.showAtakLoading(on); } catch (_) {} };

    // lazy repo images for setImg() (native maps Sawang / Ronograd)
    if (typeof setImg === 'function') {
      var prevSetImg = setImg;
      setImg = function (src, opt) {
        if (!needsRepo(src)) return prevSetImg(src, opt);
        spinner(true);
        return ask(src, 'blob')
          .then(function (u) { return prevSetImg(u, opt); })
          .then(function (ok) { return ok ? true : ask(src, 'data').then(function (u) { return prevSetImg(u, opt); }); })
          .catch(function (e) { console.error('[RO-TAK Overhaul] map load failed:', e); spinner(false); return false; });
      };
    }
    window.__ROTAK_OVERHAUL__ = { script: cfg.scriptVersion, pin: cfg.pin, ref: cfg.ref, fromCache: cfg.fromCache, repo: cfg.repoUrl };
  }

  // ------------------------------------------------------------ small badges
  function showBadge(text, href, color) {
    try {
      const el = document.createElement(href ? 'a' : 'div');
      if (href) { el.href = href; el.target = '_blank'; el.rel = 'noopener'; }
      el.textContent = text;
      el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:100000;background:#0d100d;color:' + color +
        ';border:1px solid ' + color + ';padding:7px 14px;font:700 11px monospace;letter-spacing:1px;text-decoration:none;cursor:pointer;max-width:90vw;text-align:center;';
      el.onclick = function () { setTimeout(function () { el.remove(); }, 300); };
      document.body.appendChild(el);
    } catch (_) {}
  }

  // ------------------------------------------------------------------ mount
  function mountHtml(html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const scripts = Array.from(parsed.querySelectorAll('script'));
    scripts.forEach((s) => s.remove());

    const root = document.documentElement || document.appendChild(document.createElement('html'));
    root.innerHTML = parsed.documentElement.innerHTML;

    return scripts.reduce((chain, oldScript) => chain.then(() => new Promise((resolve) => {
      const s = document.createElement('script');
      for (const attr of oldScript.attributes) s.setAttribute(attr.name, attr.value);
      if (oldScript.src) {
        s.async = false;
        s.onload = () => resolve();
        s.onerror = () => { console.error('[RO-TAK Overhaul] script failed:', oldScript.src); resolve(); };
        document.body.appendChild(s);
      } else {
        s.textContent = oldScript.textContent;
        try { document.body.appendChild(s); } catch (e) { console.error('[RO-TAK Overhaul] inline script error:', e); }
        resolve();
      }
    })), Promise.resolve());
  }

  function runPageHook(src, fromCache) {
    const cfg = {
      upstream: Array.from(UPSTREAM_ASSETS),
      scriptVersion: SCRIPT_VERSION,
      pin: REPO_REF,
      ref: src.ref,
      fromCache: !!fromCache,
      repoUrl: REPO_URL
    };
    const s = document.createElement('script');
    s.textContent = '(' + pageHook.toString() + ')(' + JSON.stringify(cfg) + ');';
    document.body.appendChild(s);
  }

  // -------------------------------------------------------------------- run
  (async function run() {
    await domReady;
    renderLoadingScreen();
    try {
      if (FORCE === 'reset') await clearCaches();
      const file = MODE === '404' ? '404.html' : 'index.html';
      setStatus(MODE === '404' ? 'SIGNAL LOST - LOADING 404 SECTOR' : 'SYNCING MODULES FROM GITHUB');

      const cached = readGood(file);
      let src = null, pkg = null, fromCache = false, netErr = null;

      if (FORCE !== 'cache') {
        try {
          src = await fetchSource(file);
          if (!looksValid(src.text)) throw new Error('Downloaded page looks incomplete');
        } catch (e) { netErr = e; src = null; log('download failed:', e.message); }
      }
      if (src) {
        pkg = await fetchPackage();
      } else if (cached) {
        src = { text: cached.text, ref: cached.ref };
        pkg = cached.pkg;
        fromCache = true;
        setStatus('GITHUB UNREACHABLE - USING LAST GOOD BUILD');
      } else {
        throw netErr || new Error('No cached build available yet (open the site once with a working connection)');
      }

      setStatus('SYNCING ASSETS...');
      const prepared = await inlineRepoAssets(rewriteHtml(src.text, pkg));
      setStatus('MOUNTING...');
      await mountHtml(prepared);
      if (MODE === 'app') runPageHook(src, fromCache);
      log('mounted OK (' + MODE + ') | build from ' + src.ref + (fromCache ? ' (CACHE)' : '') + (pkg && pkg.version ? ' | package.json v' + pkg.version : ''));

      if (fromCache) {
        const when = cached && cached.time ? new Date(cached.time).toLocaleString() : '?';
        showBadge('OFFLINE MODE - cached build from ' + when, '', '#ff9900');
      } else {
        watchHealth(() => saveGood(file, src, pkg));
        fetchLatestScriptVersion().then((v) => {
          if (v && isNewer(v, SCRIPT_VERSION)) showBadge('OVERHAUL UPDATE ' + v + ' AVAILABLE (you have ' + SCRIPT_VERSION + ') - click to update', DOWNLOAD_URL, '#00ff41');
        });
      }
    } catch (err) {
      console.error('[RO-TAK Overhaul]', err);
      setStatus('ERROR: ' + (err && err.message ? err.message : err), true);
      showErrorActions();
    }
  })();
})();