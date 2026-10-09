/**
 * Mehr Proof of Work (PoW) - Frontend Application & Interactive Solver
 * Zero External CDNs · Zero Runtime HTML/CSS Injection
 */

import {
  createChallenge,
  parseChallenge,
  verifyChallengeSignature,
  verifySolution,
  countLeadingZeroBits,
  bytesToHex,
  sha256
} from './pow-engine.js';

/* =============================================
   TRANSLATIONS DICTIONARY
   ============================================= */

const TRANSLATIONS = {
  en: {
    "nav.playground": "Playground",
    "nav.widgets": "Design System",
    "nav.spec": "Specification",
    "nav.code": "Examples",
    "pref.theme": "Theme",
    "pref.language": "Language",
    "hero.badge": "Anti-Bot Standard",
    "hero.title": "Mehr Proof-of-Work (PoW)",
    "hero.subtitle": "Transparent, long-lasting anti-bot architecture: Stateless HMAC challenges, non-blocking Web Workers, and zero-wait human UX.",
    "play.title": "Interactive PoW Engine & Form Simulation",
    "play.subtitle": "Experience how opportunistic background solving primes cryptographic proofs before a user finishes typing.",
    "widgets.title": "Visual Design Language & Components",
    "widgets.subtitle": "Reusable, production-ready UI gates and progress state components for project-wide account generation.",
    "spec.title": "Technical Specification & Architecture",
    "spec.subtitle": "Cryptographic HMAC tokens, context fingerprinting, replay resistance, and multi-tenant sharding.",
    "examples.title": "Production Implementation Examples",
    "examples.subtitle": "Self-contained solvers and middleware for Go, JavaScript/TypeScript, Python, PHP, and POSIX Shell.",
    "btn.submit": "Create Account",
    "btn.submitting": "Submitting...",
    "btn.verified": "Verified & Ready",
    "copied": "Copied!"
  },
  fa: {
    "nav.playground": "آزمایشگاه زنده",
    "nav.widgets": "سامانه طراحی",
    "nav.spec": "مشخصات فنی",
    "nav.code": "نمونه‌کدها",
    "pref.theme": "پوسته",
    "pref.language": "زبان",
    "hero.badge": "استاندارد ضد بات",
    "hero.title": "اثبات کار مهر (PoW)",
    "hero.subtitle": "معماری پایدار و شفاف مقابله با اسپم: چالش‌های بدون دیتابیس HMAC، پردازش پس‌زمینه بدون افت سرعت و تجربه کاربری بدون معطلی.",
    "play.title": "آزمایشگاه زنده و شبیه‌ساز فرم",
    "play.subtitle": "مشاهده کنید چگونه حل موازی در پس‌زمینه، محاسبات اثبات کار را پیش از اتمام تایپ کاربر آماده می‌کند.",
    "widgets.title": "زبان بصری و کامپوننت‌های رابط کاربری",
    "widgets.subtitle": "طراحی کامپوننت‌های پیشرفت و وضعیت برای تولید حساب‌ها و صدور فاکتور در سراسر سامانه‌های مهر.",
    "spec.title": "مشخصات فنی و معماری امنیتی",
    "spec.subtitle": "توکن‌های امضاشده بدون دیتابیس، اتصال به زمینه درخواست، جلوگیری از بازپخش و درجه سختی متغیر.",
    "examples.title": "نمونه‌کدهای آماده پیاده‌سازی",
    "examples.subtitle": "کتابخانه‌های مستقل و میدل‌ور برای زبان‌های Go، جاوااسکریپت، پایتون، PHP و POSIX Shell.",
    "btn.submit": "ایجاد حساب کاربری",
    "btn.submitting": "در حال ارسال...",
    "btn.verified": "تأییدشده و آماده",
    "copied": "کپی شد!"
  }
};

/* =============================================
   PLAYGROUND CONTROLLER
   ============================================= */

let currentWorker = null;
let currentChallenge = null;
let currentSolution = null;
let isSolving = false;
let isCatchupMode = false;
const DEMO_SECRET_KEY = 'mehr-pow-master-secret-demo-key';

function initPlaygroundController() {
  const form = document.getElementById('demo-form');
  const jobSelect = document.getElementById('job-select');
  const diffSlider = document.getElementById('diff-slider');
  const diffVal = document.getElementById('diff-val');
  const gateEl = document.getElementById('pow-gate');
  const barFill = document.getElementById('pow-bar-fill');
  const statusLabel = document.getElementById('gate-status-text');
  const percentLabel = document.getElementById('gate-percent');
  const btnSubmit = document.getElementById('demo-submit-btn');
  const btnSimFast = document.getElementById('btn-sim-fast');
  const btnReset = document.getElementById('btn-reset');

  const statHashrate = document.getElementById('stat-hashrate');
  const statIterations = document.getElementById('stat-iterations');
  const statElapsed = document.getElementById('stat-elapsed');
  const statNonce = document.getElementById('stat-nonce');
  const tokenInspectBox = document.getElementById('token-inspect-box');

  const inputs = document.querySelectorAll('#demo-form input:not([type="submit"])');

  function updateDifficultyDisplay() {
    if (diffSlider && diffVal) {
      diffVal.textContent = `${diffSlider.value} bits (~${Math.pow(2, parseInt(diffSlider.value, 10)).toLocaleString()} hashes)`;
    }
  }

  if (diffSlider) {
    diffSlider.addEventListener('input', () => {
      updateDifficultyDisplay();
      startChallengePreparation(false);
    });
  }

  if (jobSelect) {
    jobSelect.addEventListener('change', () => {
      const selected = jobSelect.value;
      if (selected === 'account.register') {
        if (diffSlider) diffSlider.value = '16';
      } else if (selected === 'invoice.create') {
        if (diffSlider) diffSlider.value = '17';
      } else if (selected === 'message.dispatch') {
        if (diffSlider) diffSlider.value = '18';
      }
      updateDifficultyDisplay();
      startChallengePreparation(false);
    });
  }

  // Background priming triggered on form focus
  inputs.forEach(inp => {
    inp.addEventListener('focus', () => {
      if (!isSolving && !currentSolution) {
        startChallengePreparation(false);
      }
    });
  });

  async function startChallengePreparation(catchup) {
    if (currentWorker) {
      currentWorker.terminate();
      currentWorker = null;
    }
    isSolving = true;
    isCatchupMode = catchup;
    currentSolution = null;

    const action = jobSelect ? jobSelect.value : 'account.register';
    const difficulty = diffSlider ? parseInt(diffSlider.value, 10) : 16;
    const contextStr = Array.from(inputs).map(i => `${i.name}=${i.value}`).join('&');

    // Create stateless challenge
    currentChallenge = await createChallenge({
      secretKey: DEMO_SECRET_KEY,
      action,
      context: contextStr,
      difficulty,
      ttlSeconds: 180
    });

    if (tokenInspectBox) {
      tokenInspectBox.textContent = `Token: ${currentChallenge}\nAction: ${action} | Diff: ${difficulty}b`;
    }

    if (gateEl) {
      gateEl.className = catchup ? 'pow-gate state-catchup' : 'pow-gate state-solving';
    }
    if (statusLabel) statusLabel.textContent = catchup ? 'Catch-Up Solving...' : 'Securing in Background...';
    if (percentLabel) percentLabel.textContent = '10%';

    if (btnSubmit) {
      if (catchup) {
        btnSubmit.className = 'pow-submit-btn catchup';
        btnSubmit.textContent = 'Securing Proof...';
      } else {
        btnSubmit.className = 'pow-submit-btn';
        btnSubmit.textContent = 'Create Account';
      }
    }

    // Launch worker
    currentWorker = new Worker('worker.js');
    const { payload } = parseChallenge(currentChallenge);

    currentWorker.postMessage({
      type: 'solve',
      salt: payload.salt,
      context: payload.ctx,
      difficulty: payload.diff,
      startNonce: 0
    });

    currentWorker.onmessage = async (e) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        if (statHashrate) statHashrate.textContent = `${msg.hashesPerSec.toLocaleString()} H/s`;
        if (statIterations) statIterations.textContent = msg.iterations.toLocaleString();
        if (statElapsed) statElapsed.textContent = `${Math.round(msg.elapsedMs)} ms`;
        if (percentLabel) percentLabel.textContent = `${msg.percent}%`;

        if (isCatchupMode && btnSubmit) {
          btnSubmit.textContent = `Securing Proof (${msg.percent}%)...`;
        }
      } else if (msg.type === 'solved') {
        isSolving = false;
        currentSolution = msg;

        if (statHashrate) statHashrate.textContent = `${msg.hashesPerSec.toLocaleString()} H/s`;
        if (statIterations) statIterations.textContent = msg.iterations.toLocaleString();
        if (statElapsed) statElapsed.textContent = `${Math.round(msg.elapsedMs)} ms`;
        if (statNonce) statNonce.textContent = `0x${msg.nonce.toString(16)}`;

        if (percentLabel) percentLabel.textContent = '100%';
        if (gateEl) gateEl.className = 'pow-gate state-ready';
        if (statusLabel) statusLabel.textContent = 'Proof Verified · Instant Ready';

        // Server-side instant verification check
        const serverVerify = await verifySolution({
          token: currentChallenge,
          nonce: msg.nonce,
          context: contextStr,
          secretKey: DEMO_SECRET_KEY,
          expectedAction: action
        });

        if (tokenInspectBox) {
          tokenInspectBox.textContent = `Token: ${currentChallenge}\nNonce: 0x${msg.nonce.toString(16)} (${msg.nonce})\nServer Verify: ${serverVerify.valid ? 'VALID (O(1) verified)' : 'FAILED'}\nHash: ${msg.hash}\nElapsed: ${Math.round(msg.elapsedMs)}ms`;
        }

        if (isCatchupMode) {
          // Auto-submit simulation
          triggerSubmissionSuccess(msg);
        } else {
          if (btnSubmit) {
            btnSubmit.className = 'pow-submit-btn ready';
            btnSubmit.textContent = 'Verified & Ready · Submit Now';
          }
        }
      }
    };
  }

  function triggerSubmissionSuccess(sol) {
    if (btnSubmit) {
      btnSubmit.className = 'pow-submit-btn ready';
      btnSubmit.textContent = 'Success! Account Created';
    }
    showToast(`Proof verified in ${Math.round(sol.elapsedMs)}ms! Form submitted with 0 delay.`);
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (currentSolution) {
        triggerSubmissionSuccess(currentSolution);
      } else {
        // Fast-path / autofill catchup mode triggered
        startChallengePreparation(true);
      }
    });
  }

  if (btnSimFast) {
    btnSimFast.addEventListener('click', () => {
      // Simulate user autofilling in 100ms and immediately clicking submit
      startChallengePreparation(true);
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (currentWorker) {
        currentWorker.terminate();
        currentWorker = null;
      }
      isSolving = false;
      isCatchupMode = false;
      currentSolution = null;
      currentChallenge = null;

      if (percentLabel) percentLabel.textContent = '0%';
      if (gateEl) gateEl.className = 'pow-gate state-idle';
      if (statusLabel) statusLabel.textContent = 'Waiting for input...';
      if (btnSubmit) {
        btnSubmit.className = 'pow-submit-btn';
        btnSubmit.textContent = 'Create Account';
      }
      if (tokenInspectBox) tokenInspectBox.textContent = 'Waiting for challenge generation...';
      if (statHashrate) statHashrate.textContent = '--';
      if (statIterations) statIterations.textContent = '--';
      if (statElapsed) statElapsed.textContent = '--';
      if (statNonce) statNonce.textContent = '--';
    });
  }

  updateDifficultyDisplay();
}

/* =============================================
   PREFERENCES & THEME CONTROLLER
   ============================================= */

function initPreferences() {
  const root = document.querySelector('[data-menu-root]');
  const trigger = document.querySelector('[data-dropdown-toggle]');
  const menu = root?.querySelector('.dropdown-menu');

  if (trigger && menu) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (e) => {
      if (!root.contains(e.target)) {
        menu.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.querySelectorAll('[data-theme-val]').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.getAttribute('data-theme-val')));
  });

  document.querySelectorAll('[data-lang-val]').forEach(btn => {
    btn.addEventListener('click', () => setLocale(btn.getAttribute('data-lang-val')));
  });

  setTheme(localStorage.getItem('mehr_pow_theme') || 'dark', false);
  setLocale(localStorage.getItem('mehr_pow_locale') || 'en', false);
}

function setTheme(theme, save = true) {
  if (save) localStorage.setItem('mehr_pow_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);

  document.querySelectorAll('[data-theme-val]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-theme-val') === theme);
  });

  const iconName = theme === 'light' ? 'sun' : (theme === 'black' ? 'contrast' : 'moon');
  const icon = document.querySelector('[data-pref-theme-icon] use');
  if (icon) icon.setAttribute('href', `#${iconName}`);
}

function setLocale(lang, save = true) {
  if (save) localStorage.setItem('mehr_pow_locale', lang);
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');

  document.querySelectorAll('[data-lang-val]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-lang-val') === lang);
  });

  const flagName = lang === 'fa' ? 'flag-ir' : 'flag-us';
  const flag = document.querySelector('[data-pref-lang-icon] use');
  if (flag) flag.setAttribute('href', `#${flagName}`);

  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (dict[k]) {
      el.textContent = dict[k];
    }
  });
}

/* =============================================
   ROUTER & SPA CONTROLLER
   ============================================= */

function initRouter() {
  function navigateTo(path, push = true) {
    let normalized = path.replace(/\/+$/, '') || '/';
    if (normalized === '/playground') normalized = '/';

    const views = {
      '/': document.getElementById('view-playground'),
      '/widgets': document.getElementById('view-widgets'),
      '/spec': document.getElementById('view-spec'),
      '/examples': document.getElementById('view-examples')
    };

    Object.entries(views).forEach(([route, el]) => {
      if (!el) return;
      el.classList.toggle('active', route === normalized);
    });

    document.querySelectorAll('.nav-link[data-route], .bottom-nav-link[data-route]').forEach(link => {
      const route = link.getAttribute('data-route');
      const active = route === normalized || (normalized === '/' && (route === '/' || route === '/playground'));
      link.classList.toggle('active', active);
    });

    if (push) {
      if (window.location.pathname !== normalized) {
        window.history.pushState(null, '', normalized);
      }
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-route], a.nav-brand');
    if (!link) return;

    const route = link.getAttribute('data-route') || link.getAttribute('href');
    if (route && (route.startsWith('/') || route.startsWith('#'))) {
      e.preventDefault();
      const target = route.startsWith('#') ? `/${route.slice(1)}` : route;
      navigateTo(target, true);
    }
  });

  window.addEventListener('popstate', () => {
    navigateTo(window.location.pathname, false);
  });

  navigateTo(window.location.pathname, false);
}

/* =============================================
   CODE TABS CONTROLLER
   ============================================= */

function initCodeTabs() {
  const tabs = document.querySelectorAll('.lang-btn-sm[data-lang-panel]');
  const panels = document.querySelectorAll('.code-panel-sm');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const panelId = tab.getAttribute('data-lang-panel');
      const targetPanel = document.getElementById(panelId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast-notice');
  if (!toast) return;
  toast.querySelector('.toast-msg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

if (typeof window !== 'undefined') {
  window.copySnippet = function(textOrElement, btnElement) {
    let content = '';
    if (typeof textOrElement === 'string') {
      content = textOrElement;
    } else if (textOrElement && textOrElement.dataset && textOrElement.dataset.raw) {
      content = textOrElement.dataset.raw;
    } else if (textOrElement && textOrElement.textContent) {
      content = textOrElement.textContent;
    }

    navigator.clipboard.writeText(content).then(() => {
      const locale = localStorage.getItem('mehr_pow_locale') || 'en';
      showToast(TRANSLATIONS[locale]?.copied || 'Copied!');
      if (btnElement) {
        btnElement.classList.add('copied');
        setTimeout(() => btnElement.classList.remove('copied'), 1200);
      }
    });
  };
}

/* =============================================
   INITIALIZATION
   ============================================= */

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initPreferences();
    initPlaygroundController();
    initRouter();
    initCodeTabs();
  });
}
