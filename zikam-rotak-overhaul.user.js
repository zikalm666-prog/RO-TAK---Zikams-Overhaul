// ==UserScript==
// @name         RO-TAK // Zikam's Tactical Overhaul
// @namespace    https://github.com
// @version      0.7.0b
// @description  RO-TAK C2 UI Overhaul, Right-Click Radial Menu, Guided 9-Line MEDEVAC/CAS, MGRS Telemetry & Native Maps for RO-TAK
// @author       Zikam (@zikaalm)
// @icon         https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/icon-192.png
// @match        https://ro-tak.vercel.app/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      ro-tak.vercel.app
// @updateURL    https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/zikam-rotak-overhaul.user.js
// @downloadURL  https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/zikam-rotak-overhaul.user.js
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ------------------------------------------------------------------ config
  const SCRIPT_VERSION = '0.7.0b';
  const REPO_RAW = 'https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/';
  const REPO_URL = 'https://github.com/zikalm666-prog/RO-TAK---Zikams-Overhaul';
  const DOWNLOAD_URL = REPO_RAW + 'zikam-rotak-overhaul.user.js';
  const FETCH_TIMEOUT_MS = 15000;
  const BIG_FETCH_TIMEOUT_MS = 5 * 60 * 1000; // 15K/16K maps are big

  // Assets that already exist on ro-tak.vercel.app: left untouched.
  const UPSTREAM_ASSETS = new Set([
    'images/avatar.webp', 'images/og.png', 'images/poppy.png',
    'images/os-apple.png', 'images/os-intel.png', 'images/os-windows.png',
    'images/intro/laptop.webp', 'images/intro/phone.webp',
    'images/intro/se_arm.svg', 'images/intro/se_inf.svg', 'images/intro/se_mech.svg',
    'images/intro/sf_arm.svg', 'images/intro/sf_inf.svg', 'images/intro/sf_rec.svg',
    'images/landing/1.jpg', 'images/landing/2.jpg', 'images/landing/aqwerd.jpg',
    'images/landing/map1.webp', 'images/landing/messey.jpg', 'images/landing/southern.jpg'
  ]);
  // Exist upstream too, but we want the overhaul's own icons.
  const FORCE_REPO_ASSETS = new Set(['icon-192.png', 'icon-512.png']);
  // Huge native maps: not prefetched, fetched on demand when the user presses LOAD.
  const LAZY_ASSET_RE = /(^|\/)(SawangFull|Rono16k)\.png$/i;

  const APP_ROUTES = ['/', '/index.html', '/play', '/play/'];
  const SKIP_PREFIXES = ['/api/', '/_vercel/', '/.well-known/'];

  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon' };
  const log = (...a) => console.log('[RO-TAK Overhaul]', ...a);

  // ------------------------------------------------------------ route checks
  if (window.top !== window.self) return; // never run inside iframes
  const path = location.pathname;
  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) return;
  // Static files (sw.js, manifest, images...) are left alone.
  if (/\.[a-z0-9]{1,8}$/i.test(path) && !/\.html?$/i.test(path)) return;

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
  log('started v' + SCRIPT_VERSION + ' | mode =', MODE, '| path =', path, '| http status =', status || 'n/a');

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
      '</div></body>';
  }
  function setStatus(msg, isError) {
    log(msg);
    const el = document.getElementById('rotak-status');
    if (!el) return;
    el.textContent = msg;
    if (isError) el.style.color = '#ff4d4d';
  }

  // ------------------------------------------------------------ GM helpers
  function gmGet(url, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      try {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          responseType: opts.blob ? 'blob' : 'text',
          timeout: opts.timeout || FETCH_TIMEOUT_MS,
          onload: (res) => {
            if (res.status >= 200 && res.status < 300) resolve(res);
            else reject(new Error('HTTP ' + res.status + ' -> ' + url.replace(/\?.*$/, '')));
          },
          onerror: () => reject(new Error('Request failed (blocked by an extension or no network): ' + url)),
          ontimeout: () => reject(new Error('Timeout: ' + url)),
          onabort: () => reject(new Error('Aborted: ' + url))
        });
      } catch (e) { reject(e); }
    });
  }
  const extOf = (p) => { const m = p.match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : ''; };
  const normPath = (p) => p.replace(/^(\.\/|\/)+/, '');

  function fetchRepoBlob(p, timeout) {
    return gmGet(REPO_RAW + p, { blob: true, timeout }).then((res) => {
      const b = res.response;
      return new Blob([b], { type: MIME[extOf(p)] || b.type || 'application/octet-stream' });
    });
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('FileReader failed'));
      fr.readAsDataURL(blob);
    });
  }

  // ---------------------------------------------- lazy asset bridge (page <-> userscript)
  // The page cannot read raw.githubusercontent.com (header CSP + CORS), so the page asks
  // the userscript through postMessage and gets back a blob: URL (allowed by img-src).
  const assetCache = new Map();
  function resolveAsset(p, mode) {
    const key = mode + ':' + p;
    if (!assetCache.has(key)) {
      assetCache.set(key, fetchRepoBlob(p, BIG_FETCH_TIMEOUT_MS)
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
    resolveAsset(normPath(String(req.path)), req.mode === 'data' ? 'data' : 'blob')
      .then((url) => reply({ id: req.id, url }), (err) => reply({ id: req.id, error: String((err && err.message) || err) }));
  });

  // ----------------------------------------------------- package.json (version)
  function fetchPackage() {
    return gmGet(REPO_RAW + 'package.json?t=' + Date.now())
      .then((res) => JSON.parse(res.responseText))
      .catch((e) => { log('package.json not available:', e.message); return null; });
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
        try { urls.set(p, await resolveAsset(p, 'blob')); }
        catch (e) { log('asset skipped:', p, '-', e.message); }
        done++;
        setStatus('SYNCING ASSETS ' + done + '/' + list.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return html.replace(ASSET_RE, (m, p) => urls.get(p) || m);
  }

  // ---- code that runs inside the page (context of the RO-TAK app) ----
  // Must not reference any variable from the userscript scope; config comes in as the argument.
  function pageHook(cfg) {
    // 1) lazy repo images for setImg() (native maps Sawang / Ronograd)
    var pending = {}, seq = 0;
    window.addEventListener('message', function (ev) {
      if (ev.origin !== location.origin || typeof ev.data !== 'string' || ev.data.indexOf('rotak:res:') !== 0) return;
      var o; try { o = JSON.parse(ev.data.slice(10)); } catch (_) { return; }
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

    // 2) package.json info + update notice
    window.__ROTAK_OVERHAUL__ = { script: cfg.scriptVersion, package: cfg.pkgVersion, repo: cfg.repoUrl };
    var nums = function (v) { return (String(v).match(/\d+/g) || []).map(Number); };
    var newer = function (a, b) {
      var x = nums(a), y = nums(b);
      for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
      return false;
    };
    if (cfg.pkgVersion && newer(cfg.pkgVersion, cfg.scriptVersion)) {
      var bar = document.createElement('a');
      bar.href = cfg.downloadUrl; bar.target = '_blank'; bar.rel = 'noopener';
      bar.textContent = 'OVERHAUL UPDATE ' + cfg.pkgVersion + ' AVAILABLE (you have ' + cfg.scriptVersion + ') - click to update';
      bar.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:100000;background:#0d100d;color:#00ff41;border:1px solid #00ff41;padding:7px 14px;font:700 11px monospace;letter-spacing:1px;text-decoration:none;';
      bar.onclick = function () { setTimeout(function () { bar.remove(); }, 300); };
      document.body.appendChild(bar);
    }
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

  function runPageHook(pkg) {
    const cfg = {
      upstream: Array.from(UPSTREAM_ASSETS),
      scriptVersion: SCRIPT_VERSION,
      pkgVersion: pkg && pkg.version ? String(pkg.version) : '',
      repoUrl: REPO_URL,
      downloadUrl: DOWNLOAD_URL
    };
    const s = document.createElement('script');
    s.textContent = '(' + pageHook.toString() + ')(' + JSON.stringify(cfg) + ');';
    document.body.appendChild(s);
  }

  // -------------------------------------------------------------------- run
  const screenShown = domReady.then(renderLoadingScreen);

  screenShown
    .then(() => {
      setStatus(MODE === '404' ? 'SIGNAL LOST - LOADING 404 SECTOR' : 'SYNCING MODULES FROM GITHUB');
      const page = (MODE === '404' ? '404.html' : 'index.html') + '?t=' + Date.now();
      return Promise.all([gmGet(REPO_RAW + page).then((r) => r.responseText), fetchPackage()]);
    })
    .then(async ([html, pkg]) => {
      setStatus('SYNCING ASSETS...');
      const prepared = await inlineRepoAssets(rewriteHtml(html, pkg));
      setStatus('MOUNTING...');
      await mountHtml(prepared);
      if (MODE === 'app') runPageHook(pkg);
      log('mounted OK (' + MODE + ')' + (pkg && pkg.version ? ' | package.json v' + pkg.version : ''));
    })
    .catch((err) => {
      console.error('[RO-TAK Overhaul]', err);
      setStatus('ERROR: ' + (err && err.message ? err.message : err), true);
    });
})();