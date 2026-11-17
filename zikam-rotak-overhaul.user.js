// ==UserScript==
// @name         RO-TAK // Zikam's Tactical Overhaul
// @namespace    https://github.com
// @version      0.6.0b
// @description  RO-TAK C2 UI Overhaul, Right-Click Radial Menu, Guided 9-Line MEDEVAC/CAS, MGRS Telemetry & Native Maps for RO-TAK
// @author       Zikam (@zikaalm)
// @icon         https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/icon-192.png
// @match        https://ro-tak.vercel.app/*
// @grant        none
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/zikam-rotak-overhaul.user.js
// @downloadURL  https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/zikam-rotak-overhaul.user.js
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  const REPO_RAW = 'https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/';

  if (window.__ROTAK_ENHANCED_LOADED__) return;
  window.__ROTAK_ENHANCED_LOADED__ = true;

  window.stop();
  document.documentElement.innerHTML =
    '<head><title>RO-TAK // Zikam\'s Overhaul</title></head>' +
    '<body style="margin:0;background:#090b09;color:#00ff41;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;">' +
    '<div style="border:1px solid #00ff41;padding:18px 30px;background:#0d100d;text-align:center;">' +
    '<div style="font-size:15px;font-weight:800;letter-spacing:2px;">INITIALIZING RO-TAK OVERHAUL...</div>' +
    '<div style="font-size:10px;color:#94a3b8;margin-top:6px;">SYNCING MODULES FROM GITHUB</div>' +
    '</div></body>';

   fetch(REPO_RAW + 'index.html?t=' + Date.now())
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function(html) {
      html = html
        .replace(/(href|src)=["']\.\/images\//g, '$1="' + REPO_RAW + 'images/')
        .replace(/(href|src)=["']images\//g, '$1="' + REPO_RAW + 'images/')
        .replace(/['"]\.\/images\//g, '"' + REPO_RAW + 'images/')
        .replace(/(href|src)=["']\.?\/?icon-192\.png["']/g, '$1="' + REPO_RAW + 'icon-192.png"')
        .replace(/(href|src)=["']\.?\/?icon-512\.png["']/g, '$1="' + REPO_RAW + 'icon-512.png"')
        .replace(/src=["']\.?\/?milsymbol\.js["']/g, 'src="https://ro-tak.vercel.app/milsymbol.js"')
        .replace(/src=["']\.?\/?symdata\.js["']/g, 'src="https://ro-tak.vercel.app/symdata.js"')
        .replace(/src=["']\.?\/?supabase\.js["']/g, 'src="https://ro-tak.vercel.app/supabase.js"')
        .replace(/<link rel="manifest"[^>]*>/i, '');

      document.open();
      document.write(html);
      document.close();
    })
    .catch(function(err) {
      alert('Network error: Could not fetch RO-TAK Overhaul (' + err.message + ')');
    });
})();
