// ==UserScript==
// @name         RO-TAK // Zikam's Tactical Overhaul
// @namespace    https://github.com
// @version      1.0.0
// @description  ATAK C2 UI Overhaul, Right-Click Radial Menu, Guided 9-Line MEDEVAC/CAS, MGRS Telemetry & Native Maps for RO-TAK
// @author       Zikam (@zikaalm)
// @icon         https://githubusercontent.com
// @match        https://ro-tak.vercel.app/*
// @grant        GM_xmlhttpRequest
// @connect      ://githubusercontent.com
// @updateURL    https://://githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/zikam-rotak-overhaul.user.js
// @downloadURL  https://://githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/zikam-rotak-overhaul.user.js
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  const REPO_RAW = 'https://raw.githubusercontent.com/zikalm666-prog/RO-TAK---Zikams-Overhaul/main/';

  // Evitar bucle infinito si ya se inyectó el overhaul
  if (window.__ZIKAM_ROTAK_LOADED__) return;
  window.__ZIKAM_ROTAK_LOADED__ = true;

  // Mostrar pantalla de carga táctica mientras se descarga tu index.html desde GitHub
  window.stop();
  document.documentElement.innerHTML =
    '<head><title>RO-TAK // Zikam\'s Overhaul</title></head>' +
    '<body style="margin:0;background:#090b09;color:#00ff41;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;">' +
    '<div style="border:1px solid #00ff41;padding:18px 30px;background:#0d100d;text-align:center;">' +
    '<div style="font-size:15px;font-weight:800;letter-spacing:2px;">INITIALIZING ATAK OVERHAUL...</div>' +
    '<div style="font-size:10px;color:#94a3b8;margin-top:6px;">SYNCING C2 MODULES FROM GITHUB</div>' +
    '</div></body>';

  GM_xmlhttpRequest({
    method: 'GET',
    url: REPO_RAW + 'index.html?t=' + Date.now(),
    onload: function(res) {
      if (res.status !== 200 || !res.responseText) {
        alert('Error loading RO-TAK Overhaul from GitHub (' + res.status + ')');
        return;
      }

      let html = res.responseText;

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
    },
    onerror: function() {
      alert('Network error: Could not fetch RO-TAK Overhaul from GitHub.');
    }
  });
})();
