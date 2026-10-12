/**
 * Mehr PoW - Drop-in Client Library (v1.0.0)
 * 100% Self-Hosted, Zero External Dependencies, Zero-Freeze Web Worker.
 *
 * Supports same-domain backends and cross-domain APIs (via optional `domain`).
 *
 * Quick Usage:
 *   <script src="https://pow.mehrnet.com/pow-client.js"></script>
 *   <script>
 *     MehrPoW.protect('#signup-form', {
 *       endpoint: '/api/pow/challenge',
 *       domain: 'https://api.example.com', // Optional: for separate API domains
 *       action: 'account.register',
 *       mode: 'background' // 'background' (default) | 'onclick'
 *     });
 *   </script>
 */

(function (root, factory) {
  var exported = factory();
  if (typeof define === 'function' && define.amd) {
    define([], function () { return exported; });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  var g = root || (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
  if (g) {
    g.MehrPoW = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * Inline Web Worker Script to eliminate CORS cross-origin worker restrictions.
   */
  var WORKER_SOURCE = [
    'var isRunning = false;',
    'var encoder = new TextEncoder();',
    'function countLeadingZeros(bytes) {',
    '  var zeros = 0;',
    '  for (var i = 0; i < bytes.length; i++) {',
    '    var b = bytes[i];',
    '    if (b === 0) { zeros += 8; }',
    '    else { zeros += Math.clz32(b) - 24; break; }',
    '  }',
    '  return zeros;',
    '}',
    'self.onmessage = async function(e) {',
    '  var data = e.data;',
    '  if (!data) return;',
    '  if (data.type === "stop") { isRunning = false; return; }',
    '  if (data.type === "solve") {',
    '    isRunning = true;',
    '    var salt = data.salt;',
    '    var context = data.context || "";',
    '    var difficulty = data.difficulty || 16;',
    '    var nonce = data.startNonce || 0;',
    '    var startTime = performance.now();',
    '    var iterations = 0;',
    '    var batchSize = 1000;',
    '    var expected = Math.pow(2, difficulty);',
    '    var lastReport = startTime;',
    '    while (isRunning) {',
    '      var end = nonce + batchSize;',
    '      for (; nonce < end; nonce++, iterations++) {',
    '        var cand = salt + ":" + nonce + ":" + context;',
    '        var buf = await crypto.subtle.digest("SHA-256", encoder.encode(cand));',
    '        var bytes = new Uint8Array(buf);',
    '        if (countLeadingZeros(bytes) >= difficulty) {',
    '          var elapsed = performance.now() - startTime;',
    '          var hex = "";',
    '          for (var j = 0; j < bytes.length; j++) {',
    '            hex += bytes[j].toString(16).padStart(2, "0");',
    '          }',
    '          self.postMessage({',
    '            type: "solved",',
    '            nonce: nonce,',
    '            iterations: iterations + 1,',
    '            elapsedMs: elapsed,',
    '            hash: hex,',
    '            hashesPerSec: Math.round(((iterations + 1) / (elapsed || 1)) * 1000)',
    '          });',
    '          isRunning = false;',
    '          return;',
    '        }',
    '      }',
    '      var now = performance.now();',
    '      if (now - lastReport > 50) {',
    '        lastReport = now;',
    '        var elapsedProg = now - startTime;',
    '        var ratio = iterations / expected;',
    '        var pct = Math.min(99, Math.max(1, Math.round((1 - Math.exp(-ratio * 1.15)) * 100)));',
    '        self.postMessage({',
    '          type: "progress",',
    '          nonce: nonce,',
    '          iterations: iterations,',
    '          elapsedMs: elapsedProg,',
    '          percent: pct,',
    '          hashesPerSec: Math.round((iterations / (elapsedProg || 1)) * 1000)',
    '        });',
    '      }',
    '      await new Promise(function(r) { setTimeout(r, 0); });',
    '    }',
    '  }',
    '};'
  ].join('\n');

  var STYLE_ID = 'mehr-pow-client-styles';

  var CLIENT_CSS = [
    ':root {',
    '  --pow-bg: #12151c;',
    '  --pow-border: rgba(255, 255, 255, 0.1);',
    '  --pow-text: #f1f5f9;',
    '  --pow-text-muted: #94a3b8;',
    '  --pow-accent: #ff8a2a;',
    '  --pow-accent-end: #ff9a3d;',
    '  --pow-success: #10b981;',
    '  --pow-track: rgba(255, 255, 255, 0.06);',
    '  --pow-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '  --pow-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;',
    '}',
    '@media (prefers-color-scheme: light) {',
    '  :root {',
    '    --pow-bg: #ffffff;',
    '    --pow-border: rgba(0, 0, 0, 0.12);',
    '    --pow-text: #0f172a;',
    '    --pow-text-muted: #64748b;',
    '    --pow-track: rgba(0, 0, 0, 0.06);',
    '  }',
    '}',
    '[data-theme="light"] .pow-gate,',
    '.pow-gate[data-pow-theme="light"] {',
    '  --pow-bg: #ffffff;',
    '  --pow-border: rgba(0, 0, 0, 0.12);',
    '  --pow-text: #0f172a;',
    '  --pow-text-muted: #64748b;',
    '  --pow-track: rgba(0, 0, 0, 0.06);',
    '}',
    '[data-theme="dark"] .pow-gate,',
    '[data-theme="black"] .pow-gate,',
    '.pow-gate[data-pow-theme="dark"] {',
    '  --pow-bg: #12151c;',
    '  --pow-border: rgba(255, 255, 255, 0.1);',
    '  --pow-text: #f1f5f9;',
    '  --pow-text-muted: #94a3b8;',
    '  --pow-track: rgba(255, 255, 255, 0.06);',
    '}',
    '.pow-gate {',
    '  box-sizing: border-box;',
    '  font-family: var(--pow-font);',
    '  background: var(--code-bg, var(--pow-bg));',
    '  border: 0.0625rem solid var(--code-border, var(--pow-border));',
    '  border-radius: var(--radius-lg, 0.5rem);',
    '  padding: var(--space-4, 0.85rem 1rem);',
    '  display: flex;',
    '  flex-direction: column;',
    '  gap: 0.55rem;',
    '  transition: border-color 0.2s ease, box-shadow 0.2s ease;',
    '  min-width: 0;',
    '  width: 100%;',
    '  max-width: 100%;',
    '  color: var(--pow-text);',
    '  line-height: 1.4;',
    '  text-align: start;',
    '}',
    '.pow-gate *, .pow-gate *::before, .pow-gate *::after {',
    '  box-sizing: border-box;',
    '}',
    '.pow-gate.state-ready {',
    '  border-color: rgba(16, 185, 129, 0.4);',
    '}',
    '.pow-gate-head {',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: space-between;',
    '  font-size: var(--text-xs, 0.8125rem);',
    '  gap: 0.5rem;',
    '}',
    '.pow-gate-status {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 0.45rem;',
    '  font-weight: 600;',
    '  color: var(--pow-text);',
    '  min-width: 0;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  white-space: nowrap;',
    '}',
    '.pow-gate-icon {',
    '  width: 1.125rem;',
    '  height: 1.125rem;',
    '  flex-shrink: 0;',
    '  color: var(--pow-accent);',
    '  transition: transform 0.3s ease, color 0.3s ease;',
    '}',
    '.pow-icon-arrow {',
    '  display: block;',
    '  transform-box: view-box;',
    '  transform-origin: 27.315px 26.739px;',
    '  transition: transform 0.3s ease, opacity 0.3s ease;',
    '}',
    '.pow-spinner-wrap {',
    '  display: none;',
    '  transform-box: view-box;',
    '  transform-origin: 27.315px 26.739px;',
    '}',
    '.pow-spinner-circle {',
    '  transform-box: view-box;',
    '  transform-origin: 27.315px 26.739px;',
    '  stroke-dasharray: 1, 112;',
    '  stroke-dashoffset: 0;',
    '}',
    '.pow-icon-check {',
    '  transform-box: view-box;',
    '  transform-origin: 27.315px 26.739px;',
    '  transition: transform 0.3s ease;',
    '}',
    '.pow-gate.state-solving .pow-icon-arrow,',
    '.pow-gate.state-catchup .pow-icon-arrow {',
    '  display: none;',
    '}',
    '.pow-gate.state-solving .pow-spinner-wrap,',
    '.pow-gate.state-catchup .pow-spinner-wrap {',
    '  display: block;',
    '  animation: pow-material-rot 1.4s linear infinite;',
    '}',
    '.pow-gate.state-solving .pow-spinner-circle,',
    '.pow-gate.state-catchup .pow-spinner-circle {',
    '  animation: pow-material-dash 1.4s ease-in-out infinite;',
    '}',
    '.pow-gate.state-catchup .pow-spinner-wrap {',
    '  animation-duration: 0.8s;',
    '}',
    '.pow-gate.state-catchup .pow-spinner-circle {',
    '  animation-duration: 0.8s;',
    '}',
    '.pow-gate.state-ready .pow-gate-icon {',
    '  color: var(--pow-success);',
    '}',
    '.pow-gate.state-ready .pow-spinner-wrap {',
    '  display: none;',
    '}',
    '.pow-gate.state-ready .pow-icon-arrow {',
    '  display: block;',
    '  animation: pow-pop-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;',
    '}',
    '.pow-gate.state-ready .pow-icon-check {',
    '  animation: pow-check-pop 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;',
    '}',
    '@keyframes pow-material-rot {',
    '  0%   { transform: rotate(0deg); }',
    '  100% { transform: rotate(360deg); }',
    '}',
    '@keyframes pow-material-dash {',
    '  0% {',
    '    stroke-dasharray: 1, 112;',
    '    stroke-dashoffset: 0;',
    '  }',
    '  50% {',
    '    stroke-dasharray: 82, 112;',
    '    stroke-dashoffset: -20;',
    '  }',
    '  100% {',
    '    stroke-dasharray: 1, 112;',
    '    stroke-dashoffset: -110;',
    '  }',
    '}',
    '@keyframes pow-pop-in {',
    '  0% {',
    '    opacity: 0;',
    '    transform: scale(0.85);',
    '  }',
    '  100% {',
    '    opacity: 1;',
    '    transform: scale(1);',
    '  }',
    '}',
    '@keyframes pow-check-pop {',
    '  0% {',
    '    transform: scale(0.92);',
    '  }',
    '  50% {',
    '    transform: scale(1.08);',
    '  }',
    '  100% {',
    '    transform: scale(1);',
    '  }',
    '}',
    '.pow-gate-head-actions {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 0.5rem;',
    '  flex-shrink: 0;',
    '}',
    '.pow-cancel-btn {',
    '  display: none;',
    '  align-items: center;',
    '  gap: 0.25rem;',
    '  padding: 0.18rem 0.55rem;',
    '  font-size: 0.7rem;',
    '  font-weight: 600;',
    '  color: #ef4444;',
    '  background: rgba(239, 68, 68, 0.08);',
    '  border: 0.0625rem solid rgba(239, 68, 68, 0.3);',
    '  border-radius: var(--radius-full, 9999rem);',
    '  cursor: pointer;',
    '  transition: all 0.15s ease;',
    '  line-height: 1.2;',
    '}',
    '.pow-cancel-btn:hover {',
    '  background: #ef4444;',
    '  color: #ffffff;',
    '  border-color: #ef4444;',
    '}',
    '.pow-cancel-icon {',
    '  width: 0.75rem;',
    '  height: 0.75rem;',
    '  flex-shrink: 0;',
    '}',
    '.pow-gate.state-solving .pow-cancel-btn,',
    '.pow-gate.state-catchup .pow-cancel-btn {',
    '  display: inline-flex;',
    '}',
    '.pow-gate-pill {',
    '  font-family: var(--font-mono, var(--pow-mono));',
    '  font-size: 0.72rem;',
    '  font-weight: 600;',
    '  color: var(--text-dim, var(--pow-text-muted));',
    '  flex-shrink: 0;',
    '}',
    '.pow-bar-track {',
    '  width: 100%;',
    '  height: 0.3rem;',
    '  background: var(--bg-tertiary, var(--pow-track));',
    '  border-radius: 0.1rem;',
    '  overflow: hidden;',
    '  position: relative;',
    '  box-shadow: inset 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.2);',
    '}',
    '.pow-bar-svg {',
    '  width: 100%;',
    '  height: 100%;',
    '  display: block;',
    '  overflow: hidden;',
    '  border-radius: 0.1rem;',
    '}',
    '.pow-bar-bg {',
    '  fill: transparent;',
    '  rx: 2;',
    '  ry: 2;',
    '}',
    '.pow-bar-fill {',
    '  fill: #ff8a2a;',
    '  fill: url(#powGrad);',
    '  fill: url(#powGradAuto);',
    '  rx: 2;',
    '  ry: 2;',
    '  transition: width 150ms ease-out;',
    '}',
    '.pow-gate.state-ready .pow-bar-fill {',
    '  fill: var(--success, var(--pow-success)) !important;',
    '  transition: width 200ms ease-out, fill 250ms ease-out;',
    '}',
    '.pow-gate-foot {',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: flex-end;',
    '  font-size: 0.65rem;',
    '  color: var(--text-dim, var(--pow-text-muted));',
    '  gap: 0.35rem;',
    '  margin-top: -0.15rem;',
    '  user-select: none;',
    '}',
    '.pow-foot-icon {',
    '  width: 0.6875rem;',
    '  height: 0.6875rem;',
    '  color: var(--pow-accent);',
    '  opacity: 0.85;',
    '}',
    '.pow-gate-foot a {',
    '  color: inherit;',
    '  text-decoration: none;',
    '  opacity: 0.75;',
    '  transition: opacity 0.15s ease;',
    '}',
    '.pow-gate-foot a:hover {',
    '  opacity: 1;',
    '  text-decoration: underline;',
    '}',
    '.pow-foot-dot {',
    '  opacity: 0.5;',
    '}',
    '[dir="rtl"] .pow-gate,',
    '.pow-gate[dir="rtl"] {',
    '  direction: rtl;',
    '  text-align: right;',
    '}',
    '[dir="rtl"] .pow-gate-foot,',
    '.pow-gate[dir="rtl"] .pow-gate-foot {',
    '  justify-content: flex-start;',
    '}'
  ].join('\n');

  function injectStyles() {
    if (typeof document === 'undefined' || !document.head || typeof document.getElementById !== 'function') {
      return;
    }
    if (document.getElementById(STYLE_ID)) return;
    try {
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CLIENT_CSS;
      document.head.appendChild(style);
    } catch (e) {
      // Ignore in non-browser environments
    }
  }

  if (typeof document !== 'undefined') {
    if (document.head) {
      injectStyles();
    } else if (typeof document.addEventListener === 'function') {
      document.addEventListener('DOMContentLoaded', injectStyles);
    }
  }

  /**
   * Resolves target URL by combining optional base domain with endpoint path.
   */
  function resolveUrl(endpoint, domain) {
    var ep = endpoint || '/pow/challenge';
    if (!domain) return ep;
    try {
      return new URL(ep, domain).toString();
    } catch (e) {
      var base = domain.replace(/\/+$/, '');
      var path = ep.indexOf('/') === 0 ? ep : '/' + ep;
      return base + path;
    }
  }

  /**
   * Spawns an inline worker via Blob URL.
   */
  function createInlineWorker() {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
      return null;
    }
    try {
      var blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
      var url = URL.createObjectURL(blob);
      return new Worker(url);
    } catch (e) {
      return null;
    }
  }

  /**
   * Programmatic challenge fetch and solver.
   *
   * @param {Object} opts
   * @param {string} [opts.endpoint] - API challenge endpoint (default: '/pow/challenge')
   * @param {string} [opts.domain] - Optional base domain for cross-domain APIs (e.g. 'https://api.example.com')
   * @param {string} [opts.action] - Action identifier (e.g. 'account.register')
   * @param {string} [opts.context] - Context fingerprint or string
   * @param {Function} [opts.onProgress] - Progress callback
   * @returns {Promise<Object>} Solution object
   */
  function solve(opts) {
    opts = opts || {};
    var url = resolveUrl(opts.endpoint, opts.domain);
    var action = opts.action || 'form.submit';
    var context = opts.context || '';
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;

    var challengePromise;
    if (typeof opts.callApi === 'function') {
      challengePromise = Promise.resolve(opts.callApi({
        action: action,
        context: context,
        endpoint: opts.endpoint || '/pow/challenge',
        domain: opts.domain || '',
        url: url
      }));
    } else {
      challengePromise = fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          action: action,
          context: context
        })
      }).then(function (res) {
        if (!res.ok) {
          throw new Error('PoW challenge request failed: HTTP ' + res.status);
        }
        return res.json();
      });
    }

    return challengePromise.then(function (challenge) {
        return new Promise(function (resolve, reject) {
          var worker = createInlineWorker();
          if (!worker) {
            reject(new Error('Web Workers not supported in this environment'));
            return;
          }

          worker.onmessage = function (e) {
            var msg = e.data;
            if (!msg) return;

            if (msg.type === 'progress' && onProgress) {
              onProgress(msg);
            } else if (msg.type === 'solved') {
              worker.terminate();
              resolve({
                token: challenge.token,
                nonce: msg.nonce,
                elapsedMs: msg.elapsedMs,
                hashesPerSec: msg.hashesPerSec,
                difficulty: challenge.difficulty,
                hash: msg.hash
              });
            }
          };

          worker.onerror = function (err) {
            worker.terminate();
            reject(err);
          };

          worker.postMessage({
            type: 'solve',
            salt: challenge.salt,
            context: challenge.context || context,
            difficulty: challenge.difficulty
          });
        });
      });
  }

  /**
   * Helper to format HTTP headers for SPA fetch/XHR requests.
   */
  function getHeaders(solution) {
    if (!solution) return {};
    return {
      'X-Mehr-PoW-Token': solution.token,
      'X-Mehr-PoW-Nonce': String(solution.nonce)
    };
  }

  /**
   * Protects an HTML <form> element with automatic PoW verification.
   *
   * @param {string|HTMLFormElement} formSelectorOrElement
   * @param {Object} [options]
   * @param {string} [options.endpoint] - Challenge endpoint (default: '/pow/challenge')
   * @param {string} [options.domain] - Optional API domain (e.g. 'https://api.example.com')
   * @param {string} [options.action] - Action identifier
   * @param {string} [options.mode] - 'background' (default) or 'onclick'
   * @param {Function} [options.onReady] - Called when proof is ready
   * @param {Function} [options.onProgress] - Called on solver progress
   * @param {Function} [options.onError] - Called on solver error
   * @returns {Object} Protection controller handle
   */
  function protect(formSelectorOrElement, options) {
    options = options || {};
    var form = typeof formSelectorOrElement === 'string'
      ? document.querySelector(formSelectorOrElement)
      : formSelectorOrElement;

    if (!form || form.tagName !== 'FORM') {
      console.warn('[MehrPoW] Target form element not found:', formSelectorOrElement);
      return null;
    }

    if (options.style !== false && options.css !== false) {
      injectStyles();
    }

    var endpoint = options.endpoint || form.getAttribute('data-pow-endpoint') || '/pow/challenge';
    var domain = options.domain || form.getAttribute('data-pow-domain') || '';
    var action = options.action || form.getAttribute('data-pow-action') || 'form.submit';
    var mode = options.mode || form.getAttribute('data-pow-mode') || 'background';

    var gateEl = form.querySelector('[data-pow-gate]') || form.querySelector('.pow-gate');
    if (!gateEl && options.gate !== false && typeof document !== 'undefined') {
      gateEl = document.createElement('div');
      gateEl.className = 'pow-gate state-idle';
      gateEl.setAttribute('data-pow-gate', '');
      if (options.theme) {
        gateEl.setAttribute('data-pow-theme', options.theme);
      }

      var showBadge = options.badge !== false;
      var cancelText = (options.strings && options.strings.cancel) || 'Cancel';
      var idleText = (options.strings && options.strings.idle) || 'Ready to verify...';

      var badgeHtml = showBadge ? [
        '<div class="pow-gate-foot">',
        '  <svg class="pow-foot-icon" viewBox="6.05 4.85 41.36 41.36" fill="none" aria-hidden="true">',
        '    <path d="M27.315 7.261a19.45 19.45 0 0 0-13.518 4.917l1.23-6.743-3.193-.582-2.162 11.836 11.84 2.16.582-3.193-6.08-1.11a16.173 16.173 0 1 1-4.982 8.064l-3.142-.824A19.478 19.478 0 1 0 27.315 7.261z" fill="currentColor"/>',
        '    <path fill-rule="evenodd" clip-rule="evenodd" d="M38.847 21.919 35.928 19 24.477 30.452 19.923 25.9 17 28.822l7.483 7.484 2.923-2.923-.011-.012L38.847 21.92z" fill="currentColor"/>',
        '  </svg>',
        '  <span>Proof of Work</span>',
        '  <span class="pow-foot-dot">·</span>',
        '  <a href="https://pow.mehrnet.com" target="_blank" rel="noopener noreferrer">mehrnet</a>',
        '</div>'
      ].join('') : '';

      gateEl.innerHTML = [
        '<div class="pow-gate-head">',
        '  <span class="pow-gate-status">',
        '    <svg class="pow-gate-icon" viewBox="6.05 4.85 41.36 41.36" fill="none" aria-hidden="true">',
        '      <g class="pow-icon-arrow">',
        '        <path d="M 13.797 12.178 l 1.23 -6.743 l -3.193 -0.582 l -2.162 11.836 l 11.84 2.16 l 0.582 -3.193 l -6.08 -1.11 a 16.173 16.173 0 1 1 2.025 25.441 l -1.896 2.707 a 19.478 19.478 0 1 0 -2.346 -30.516 z" fill="currentColor"/>',
        '      </g>',
        '      <g class="pow-spinner-wrap">',
        '        <circle class="pow-spinner-circle" cx="27.315" cy="26.739" r="17.825" stroke="currentColor" stroke-width="3.305" stroke-linecap="round" fill="none"/>',
        '      </g>',
        '      <g class="pow-icon-check">',
        '        <path fill-rule="evenodd" clip-rule="evenodd" d="M38.847 21.919 35.928 19 24.477 30.452 19.923 25.9 17 28.822l7.483 7.484 2.923-2.923-.011-.012L38.847 21.92z" fill="currentColor"/>',
        '      </g>',
        '    </svg>',
        '    <span data-pow-status>' + idleText + '</span>',
        '  </span>',
        '  <div class="pow-gate-head-actions">',
        '    <button type="button" class="pow-cancel-btn" data-pow-cancel title="Cancel verification">',
        '      <svg class="pow-cancel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
        '        <line x1="18" y1="6" x2="6" y2="18"></line>',
        '        <line x1="6" y1="6" x2="18" y2="18"></line>',
        '      </svg>',
        '      <span>' + cancelText + '</span>',
        '    </button>',
        '    <span class="pow-gate-pill" data-pow-percent>0%</span>',
        '  </div>',
        '</div>',
        '<div class="pow-bar-track">',
        '  <svg class="pow-bar-svg" aria-hidden="true">',
        '    <defs>',
        '      <linearGradient id="powGradAuto" x1="0" y1="0" x2="1" y2="0">',
        '        <stop offset="0%" stop-color="#ff9a3d" />',
        '        <stop offset="100%" stop-color="#ff8a2a" />',
        '      </linearGradient>',
        '    </defs>',
        '    <rect class="pow-bar-bg" x="0" y="0" width="100%" height="100%" rx="2" ry="2" />',
        '    <rect class="pow-bar-fill" data-pow-bar x="0" y="0" width="0%" height="100%" rx="2" ry="2" fill="url(#powGradAuto)" />',
        '  </svg>',
        '</div>',
        badgeHtml
      ].join('');

      var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn && submitBtn.parentNode) {
        submitBtn.parentNode.insertBefore(gateEl, submitBtn);
      } else {
        form.appendChild(gateEl);
      }
    }

    var statusEl = gateEl ? (gateEl.querySelector('[data-pow-status]') || gateEl.querySelector('#gate-status-text') || gateEl.querySelector('.pow-gate-status span:last-child')) : null;
    var percentEl = gateEl ? (gateEl.querySelector('[data-pow-percent]') || gateEl.querySelector('.pow-gate-pill')) : null;
    var barFillEl = gateEl ? (gateEl.querySelector('[data-pow-bar]') || gateEl.querySelector('.pow-bar-fill')) : null;

    var currentSolution = null;
    var isSolving = false;
    var isSubmitting = false;
    var isCatchupMode = false;
    var activeWorker = null;

    // Ensure hidden inputs exist
    function ensureHiddenInputs() {
      var tokenInput = form.querySelector('input[name="pow_token"]');
      if (!tokenInput) {
        tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = 'pow_token';
        form.appendChild(tokenInput);
      }
      var nonceInput = form.querySelector('input[name="pow_nonce"]');
      if (!nonceInput) {
        nonceInput = document.createElement('input');
        nonceInput.type = 'hidden';
        nonceInput.name = 'pow_nonce';
        form.appendChild(nonceInput);
      }
      return { tokenInput: tokenInput, nonceInput: nonceInput };
    }

    var strings = options.strings || {};
    var getSolvingText = function (isCatchup) {
      if (isCatchup) return strings.solving || 'Solving Challenge...';
      return strings.verifying || 'Verifying Browser...';
    };
    var getVerifiedText = function (sec, hps) {
      if (typeof strings.verified === 'function') return strings.verified(sec, hps);
      if (typeof strings.verified === 'string') return strings.verified;
      return 'Browser Verified - took ' + sec + 's (' + hps + ' H/s)';
    };

    function updateGate(state, text, percent) {
      if (gateEl) {
        gateEl.className = 'pow-gate state-' + state;
      }
      if (statusEl && text) {
        statusEl.textContent = text;
      }
      if (percentEl && typeof percent === 'number') {
        percentEl.textContent = percent + '%';
      }
      if (barFillEl && typeof percent === 'number') {
        barFillEl.setAttribute('width', percent + '%');
      }
    }

    function startSolving(isCatchup) {
      if (isSolving || currentSolution) return;
      isSolving = true;
      isCatchupMode = !!isCatchup;

      updateGate(isCatchupMode ? 'catchup' : 'solving', getSolvingText(isCatchupMode), 0);

      var challengeUrl = resolveUrl(endpoint, domain);

      var challengePromise;
      if (typeof options.callApi === 'function') {
        challengePromise = Promise.resolve(options.callApi({
          action: action,
          difficulty: options.difficulty,
          endpoint: endpoint,
          domain: domain,
          url: challengeUrl
        }));
      } else {
        challengePromise = fetch(challengeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ action: action })
        }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        });
      }

      challengePromise
        .then(function (challenge) {
          activeWorker = createInlineWorker();
          if (!activeWorker) throw new Error('Web Worker unavailable');

          activeWorker.onmessage = function (e) {
            var msg = e.data;
            if (!msg) return;

            if (msg.type === 'progress') {
              updateGate(isCatchupMode ? 'catchup' : 'solving', null, msg.percent);
              if (options.onProgress) options.onProgress(msg);
            } else if (msg.type === 'solved') {
              activeWorker.terminate();
              activeWorker = null;
              isSolving = false;

              currentSolution = {
                token: challenge.token,
                nonce: msg.nonce,
                elapsedMs: msg.elapsedMs,
                hashesPerSec: msg.hashesPerSec,
                difficulty: challenge.difficulty,
                hash: msg.hash,
                iterations: msg.iterations,
                context: challenge.context || '',
                action: challenge.action || action,
                isCatchup: !!isCatchupMode
              };

              var durationSec = (msg.elapsedMs / 1000).toFixed(2);
              var hps = Math.round(msg.hashesPerSec).toLocaleString();
              updateGate('ready', getVerifiedText(durationSec, hps), 100);

              var inputs = ensureHiddenInputs();
              inputs.tokenInput.value = challenge.token;
              inputs.nonceInput.value = String(msg.nonce);

              if (options.onReady) {
                options.onReady(currentSolution);
              }

              if (typeof options.verifyApi === 'function') {
                Promise.resolve(options.verifyApi(currentSolution))
                  .then(function (res) {
                    if (options.onVerified) options.onVerified(res, currentSolution);
                  })
                  .catch(function (e) {
                    console.warn('[MehrPoW] verifyApi error:', e);
                  });
              }

              if (isSubmitting) {
                if (typeof options.onSubmit === 'function') {
                  options.onSubmit(currentSolution);
                } else {
                  form.submit();
                }
              }
            }
          };

          activeWorker.onerror = function (err) {
            if (activeWorker) activeWorker.terminate();
            activeWorker = null;
            isSolving = false;
            updateGate('idle', strings.error || 'Verification error', 0);
            if (options.onError) options.onError(err);
          };

          activeWorker.postMessage({
            type: 'solve',
            salt: challenge.salt,
            context: challenge.context || '',
            difficulty: challenge.difficulty
          });
        })
        .catch(function (err) {
          isSolving = false;
          updateGate('idle', strings.error || 'Challenge error', 0);
          if (options.onError) options.onError(err);
        });
    }

    // Bind submit event
    function handleSubmit(e) {
      if (currentSolution) {
        // Solution already computed! Attach and allow submit.
        var inputs = ensureHiddenInputs();
        inputs.tokenInput.value = currentSolution.token;
        inputs.nonceInput.value = String(currentSolution.nonce);
        if (typeof options.onSubmit === 'function') {
          e.preventDefault();
          options.onSubmit(currentSolution);
        }
        return;
      }

      e.preventDefault();
      isSubmitting = true;

      if (isSolving) {
        isCatchupMode = true;
        updateGate('catchup', getSolvingText(true), null);
      } else {
        startSolving(true);
      }
    }

    form.addEventListener('submit', handleSubmit);

    // Bind optional cancel button inside gate
    var cancelBtn = gateEl ? gateEl.querySelector('[data-pow-cancel], .pow-cancel-btn, #btn-cancel-pow') : null;
    function handleCancel(e) {
      e.preventDefault();
      e.stopPropagation();
      controller.cancel();
      if (options.onCancel) options.onCancel();
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', handleCancel);
    }

    // Start verification strategy
    if (mode === 'background') {
      startSolving(false);
    } else {
      updateGate('idle', strings.idle || 'Ready to verify...', 0);
    }

    var controller = {
      solve: function (catchup) {
        var wantsCatchup = catchup !== false;
        if (isSolving) {
          if (wantsCatchup) {
            isSubmitting = true;
            isCatchupMode = true;
            updateGate('catchup', getSolvingText(true), null);
          }
          return;
        }
        if (currentSolution) {
          controller.reset();
        }
        if (wantsCatchup) {
          isSubmitting = true;
        }
        startSolving(wantsCatchup);
      },
      cancel: function () {
        if (activeWorker) {
          activeWorker.terminate();
          activeWorker = null;
        }
        isSolving = false;
        isSubmitting = false;
        isCatchupMode = false;
        currentSolution = null;
        updateGate('idle', strings.cancelled || 'Verification cancelled', 0);
      },
      reset: function () {
        if (activeWorker) {
          activeWorker.terminate();
          activeWorker = null;
        }
        isSolving = false;
        isSubmitting = false;
        isCatchupMode = false;
        currentSolution = null;
        updateGate('idle', strings.idle || 'Ready to verify...', 0);
      },
      getSolution: function () { return currentSolution; },
      isSolving: function () { return isSolving; },
      isCatchup: function () { return isCatchupMode; },
      destroy: function () {
        if (activeWorker) {
          activeWorker.terminate();
          activeWorker = null;
        }
        if (typeof form.removeEventListener === 'function') {
          form.removeEventListener('submit', handleSubmit);
        }
        if (cancelBtn && typeof cancelBtn.removeEventListener === 'function') {
          cancelBtn.removeEventListener('click', handleCancel);
        }
      }
    };

    return controller;
  }

  return {
    protect: protect,
    solve: solve,
    getHeaders: getHeaders,
    resolveUrl: resolveUrl
  };
});
