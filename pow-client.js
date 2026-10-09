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

    var endpoint = options.endpoint || form.getAttribute('data-pow-endpoint') || '/pow/challenge';
    var domain = options.domain || form.getAttribute('data-pow-domain') || '';
    var action = options.action || form.getAttribute('data-pow-action') || 'form.submit';
    var mode = options.mode || form.getAttribute('data-pow-mode') || 'background';

    var gateEl = form.querySelector('[data-pow-gate]') || form.querySelector('.pow-gate');
    if (!gateEl && options.gate !== false && typeof document !== 'undefined') {
      gateEl = document.createElement('div');
      gateEl.className = 'pow-gate state-idle';
      gateEl.setAttribute('data-pow-gate', '');
      gateEl.innerHTML = [
        '<div class="pow-gate-head">',
        '  <span class="pow-gate-status">',
        '    <svg class="icon icon-base icon-accent" viewBox="6.05 4.85 41.36 41.36" fill="none" aria-hidden="true">',
        '      <path d="M27.315 7.261a19.45 19.45 0 0 0-13.518 4.917l1.23-6.743-3.193-.582-2.162 11.836 11.84 2.16.582-3.193-6.08-1.11a16.173 16.173 0 1 1-4.982 8.064l-3.142-.824A19.478 19.478 0 1 0 27.315 7.261z" fill="currentColor"/>',
        '      <path fill-rule="evenodd" clip-rule="evenodd" d="M38.847 21.919 35.928 19 24.477 30.452 19.923 25.9 17 28.822l7.483 7.484 2.923-2.923-.011-.012L38.847 21.92z" fill="currentColor"/>',
        '    </svg>',
        '    <span data-pow-status>Ready to verify...</span>',
        '  </span>',
        '  <div class="pow-gate-head-actions">',
        '    <span class="pow-gate-pill" data-pow-percent>0%</span>',
        '  </div>',
        '</div>',
        '<div class="pow-bar-track">',
        '  <svg class="pow-bar-svg" aria-hidden="true">',
        '    <rect class="pow-bar-bg" x="0" y="0" width="100%" height="100%" rx="2" ry="2" />',
        '    <rect class="pow-bar-fill" data-pow-bar x="0" y="0" width="0%" height="100%" rx="2" ry="2" />',
        '  </svg>',
        '</div>'
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

      updateGate(isCatchup ? 'catchup' : 'solving', isCatchup ? 'Solving Challenge...' : 'Verifying Browser...', 0);

      var challengeUrl = resolveUrl(endpoint, domain);

      var challengePromise;
      if (typeof options.callApi === 'function') {
        challengePromise = Promise.resolve(options.callApi({
          action: action,
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
              updateGate(isCatchup ? 'catchup' : 'solving', null, msg.percent);
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
                difficulty: challenge.difficulty
              };

              var durationSec = (msg.elapsedMs / 1000).toFixed(2);
              var hps = Math.round(msg.hashesPerSec).toLocaleString();
              updateGate('ready', 'Browser Verified - took ' + durationSec + 's (' + hps + ' H/s)', 100);

              var inputs = ensureHiddenInputs();
              inputs.tokenInput.value = challenge.token;
              inputs.nonceInput.value = String(msg.nonce);

              if (options.onReady) {
                options.onReady(currentSolution);
              }

              if (typeof options.verifyApi === 'function') {
                Promise.resolve(options.verifyApi(currentSolution)).catch(function (e) {
                  console.warn('[MehrPoW] verifyApi error:', e);
                });
              }

              if (isSubmitting) {
                form.submit();
              }
            }
          };

          activeWorker.onerror = function (err) {
            if (activeWorker) activeWorker.terminate();
            activeWorker = null;
            isSolving = false;
            updateGate('idle', 'Verification error', 0);
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
          updateGate('idle', 'Challenge error', 0);
          if (options.onError) options.onError(err);
        });
    }

    // Bind submit event
    form.addEventListener('submit', function (e) {
      if (currentSolution) {
        // Solution already computed! Attach and allow instant submit.
        var inputs = ensureHiddenInputs();
        inputs.tokenInput.value = currentSolution.token;
        inputs.nonceInput.value = String(currentSolution.nonce);
        return;
      }

      e.preventDefault();
      isSubmitting = true;

      if (isSolving) {
        updateGate('catchup', 'Solving Challenge...', null);
      } else {
        startSolving(true);
      }
    });

    // Start verification strategy
    if (mode === 'background') {
      startSolving(false);
    } else {
      updateGate('idle', 'Ready to verify...', 0);
    }

    return {
      solve: function () { startSolving(true); },
      reset: function () {
        if (activeWorker) {
          activeWorker.terminate();
          activeWorker = null;
        }
        isSolving = false;
        isSubmitting = false;
        currentSolution = null;
        updateGate('idle', 'Ready to verify...', 0);
      },
      getSolution: function () { return currentSolution; }
    };
  }

  return {
    protect: protect,
    solve: solve,
    getHeaders: getHeaders,
    resolveUrl: resolveUrl
  };
});
