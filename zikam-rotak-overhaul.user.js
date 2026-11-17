// ==UserScript==
// @name         RO-TAK // Zikam's Tactical Overhaul
// @namespace    https://github.com
// @version      0.6.2b
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
// ==/UserScript==

(function () {
  'use strict';

  const REPO_RAW = 'https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/';
  const SITE = 'https://ro-tak.vercel.app/';

  if (window.__ROTAK_ENHANCED_LOADED__) return;
  window.__ROTAK_ENHANCED_LOADED__ = true;

  let mounted = false;

  // ---------- Loading screen (never overwrites a mounted page) ----------
  function renderLoadingScreen() {
    if (mounted) return;
    const root = document.documentElement;
    if (!root) return;
    root.innerHTML =
      '<head><meta charset="utf-8"><title>RO-TAK // Zikam\'s Overhaul</title></head>' +
      '<body style="margin:0;background:#090b09;color:#00ff41;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;">' +
      '<div style="border:1px solid #00ff41;padding:18px 30px;background:#0d100d;text-align:center;">' +
      '<div style="font-size:15px;font-weight:800;letter-spacing:2px;">INITIALIZING RO-TAK OVERHAUL...</div>' +
      '<div style="font-size:10px;color:#94a3b8;margin-top:6px;">SYNCING MODULES FROM GITHUB</div>' +
      '</div></body>';
  }

  try { window.stop(); } catch (_) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderLoadingScreen, { once: true });
  } else {
    renderLoadingScreen();
  }

  // ---------- Helpers ----------
  function gm(url) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        onload: resolve,
        onerror: function () { reject(new Error('Network error: ' + url)); },
        ontimeout: function () { reject(new Error('Timeout: ' + url)); }
      });
    });
  }

  // Only the overhaul's own assets come from the GitHub repo. Everything else
  // (milsymbol.js, symdata.js, original images...) resolves against ro-tak.vercel.app.
  // IMPORTANT: only the path is replaced, never the surrounding quotes
  // (replacing the quote broke `'./images/x.png'` into `"https://...x.png'` = SyntaxError).
  function rewriteHtml(html) {
    return html
      .replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '')
      .replace(/<link rel="manifest"[^>]*>/i, '')
      .replace(/(?:\.\/)?images\/(bg-tactical\.png|discord-avatar\.(?:png|jpg|webp))/g, REPO_RAW + 'images/$1')
      .replace(/(href|src)=(["'])\.?\/?icon-(192|512)\.png\2/g, '$1=$2' + REPO_RAW + 'icon-$3.png$2')
      // <base> so relative URLs (milsymbol.js, images/...) always resolve to the real site, even on /play/
      .replace(/<head([^>]*)>/i, '<head$1><base href="' + SITE + '">');
  }

  function mount(html) {
    mounted = true;
    document.open();
    document.write(html);
    document.close();
  }

  // ---------- Main ----------
  (async function () {
    try {
      const isPlayOrRoot = /^\/(play\/?)?$/.test(location.pathname);

      // Ask the real server what it answers for this URL: 404 -> overhaul 404 page
      let file = 'index.html';
      if (!isPlayOrRoot) {
        try {
          const here = await gm(location.href);
          if (here.status === 404) file = '404.html';
        } catch (_) {}
      }

      const res = await gm(REPO_RAW + file + '?t=' + Date.now());
      if (res.status < 200 || res.status >= 300) {
        throw new Error('HTTP ' + res.status + ' while fetching ' + file);
      }
      mount(rewriteHtml(res.responseText));
    } catch (err) {
      console.error('[RO-TAK Overhaul]', err);
      alert('RO-TAK Overhaul error: ' + err.message);
    }
  })();
})();