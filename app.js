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
    "play.title": "Interactive PoW Engine & Benchmark",
    "play.subtitle": "Explore stateless HMAC challenges across 14 to 24 bits of difficulty and observe live Web Worker solving performance.",
    "widgets.title": "Visual Design Language & Components",
    "widgets.subtitle": "Reusable, production-ready UI gates and progress state components for project-wide account generation.",
    "spec.title": "Technical Specification & Architecture",
    "spec.subtitle": "Cryptographic HMAC tokens, context fingerprinting, replay resistance, and multi-tenant sharding.",
    "examples.title": "Production Implementation Examples",
    "examples.subtitle": "Self-contained solvers and middleware for Go, JavaScript/TypeScript, Python, PHP, and POSIX Shell.",
    "mode.label": "Execution Strategy:",
    "mode.background": "Start in Background",
    "mode.onclick": "Start on Submit Click",
    "preset.form": "Public Form Submission",
    "preset.comment": "User Comment & Post",
    "preset.invoice": "Public Invoice Generation",
    "preset.register": "Account Registration",
    "preset.security": "High Security Barrier",
    "btn.start": "Start Verification",
    "btn.verifying": "Verifying Browser...",
    "btn.verified": "Browser Verified",
    "btn.cancel": "Cancel",
    "btn.sim_rapid": "Simulate Rapid Click",
    "btn.reset": "Reset Benchmark",
    "btn.submit": "Start Verification",
    "btn.submitting": "Verifying...",
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
    "play.title": "موتور تعاملی و بنچمارک اثبات کار",
    "play.subtitle": "آزمایش چالش‌های بدون دیتابیس اثبات کار از سختی ۱۴ تا ۲۴ بیت و مشاهده کارایی زنده پردازشگر وب.",
    "widgets.title": "زبان بصری و کامپوننت‌های رابط کاربری",
    "widgets.subtitle": "طراحی کامپوننت‌های پیشرفت و وضعیت برای تولید حساب‌ها و صدور فاکتور در سراسر سامانه‌های مهر.",
    "spec.title": "مشخصات فنی و معماری امنیتی",
    "spec.subtitle": "توکن‌های امضاشده بدون دیتابیس، اتصال به زمینه درخواست، جلوگیری از بازپخش و درجه سختی متغیر.",
    "examples.title": "نمونه‌کدهای آماده پیاده‌سازی",
    "examples.subtitle": "کتابخانه‌های مستقل و میدل‌ور برای زبان‌های Go، جاوااسکریپت، پایتون، PHP و POSIX Shell.",
    "mode.label": "شیوه اجرا:",
    "mode.background": "اجرا در پس‌زمینه",
    "mode.onclick": "اجرا با کلیک کاربر",
    "preset.form": "ارسال فرم عمومی",
    "preset.comment": "دیدگاه و یادداشت کاربر",
    "preset.invoice": "صدور فاکتور عمومی",
    "preset.register": "ثبت‌نام حساب کاربری",
    "preset.security": "سد امنیتی بالا",
    "btn.start": "شروع تأیید",
    "btn.verifying": "در حال تأیید مرورگر...",
    "btn.verified": "مرورگر تأیید شد",
    "btn.cancel": "انصراف",
    "btn.sim_rapid": "شبیه‌سازی کلیک سریع",
    "btn.reset": "بازنشانی بنچمارک",
    "btn.submit": "شروع تأیید",
    "btn.submitting": "در حال تأیید...",
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
let executionMode = 'background'; // 'background' | 'onclick'
let updateDifficultyDisplayGlobal = null;
const DEMO_SECRET_KEY = 'mehr-pow-master-secret-demo-key';

function getTimeEstimate(bits, isFa) {
  const exp = Math.pow(2, bits);
  const sec = exp / 320000;
  if (sec < 0.03) return isFa ? 'بسیار سریع (< ۰.۰۳ ثانیه)' : 'Instant (< 0.03s)';
  if (sec < 1) return isFa ? `تقریباً ${sec.toFixed(2)} ثانیه` : `Est. ~${sec.toFixed(2)}s`;
  if (sec < 60) return isFa ? `تقریباً ${Math.round(sec)} ثانیه` : `Est. ~${Math.round(sec)}s`;
  const min = Math.round(sec / 60);
  return isFa ? `تقریباً ${min} دقیقه (سد سنگین)` : `Est. ~${min} min (High barrier)`;
}

function initPlaygroundController() {
  const modeTabs = document.querySelectorAll('.mode-tab[data-mode]');
  const diffSlider = document.getElementById('diff-slider');
  const diffVal = document.getElementById('diff-val');
  const diffTimeEst = document.getElementById('diff-time-est');
  const presetBtns = document.querySelectorAll('.diff-bar-segment[data-diff]');
  const gateEl = document.getElementById('pow-gate');
  const barFill = document.getElementById('pow-bar-fill');
  const statusLabel = document.getElementById('gate-status-text');
  const percentLabel = document.getElementById('gate-percent');
  const btnCancel = document.getElementById('btn-cancel-pow');
  const btnSubmit = document.getElementById('demo-submit-btn');
  const btnSimFast = document.getElementById('btn-sim-fast');
  const btnReset = document.getElementById('btn-reset');

  const statHashrate = document.getElementById('stat-hashrate');
  const statIterations = document.getElementById('stat-iterations');
  const statElapsed = document.getElementById('stat-elapsed');
  const statNonce = document.getElementById('stat-nonce');
  const tokenInspectBox = document.getElementById('token-inspect-box');

  function updateDifficultyDisplay() {
    if (!diffSlider) return;
    const val = parseInt(diffSlider.value, 10);
    const exp = Math.pow(2, val);
    const isFa = document.documentElement.getAttribute('lang') === 'fa';
    if (diffVal) {
      diffVal.textContent = isFa
        ? `${val} بیت (~${exp.toLocaleString()} هش)`
        : `${val} bits (~${exp.toLocaleString()} hashes)`;
    }
    if (diffTimeEst) {
      diffTimeEst.textContent = getTimeEstimate(val, isFa);
    }
    presetBtns.forEach(btn => {
      const btnDiff = parseInt(btn.getAttribute('data-diff'), 10);
      btn.classList.toggle('active', btnDiff === val);
    });
  }
  updateDifficultyDisplayGlobal = updateDifficultyDisplay;

  function resetStateOnly() {
    if (currentWorker) {
      currentWorker.terminate();
      currentWorker = null;
    }
    isSolving = false;
    isCatchupMode = false;
    currentSolution = null;
    currentChallenge = null;

    const val = diffSlider ? parseInt(diffSlider.value, 10) : 18;
    const isFa = document.documentElement.getAttribute('lang') === 'fa';
    if (percentLabel) percentLabel.textContent = '0%';
    if (barFill) barFill.setAttribute('width', '0%');
    if (gateEl) gateEl.className = 'pow-gate state-idle';
    if (statusLabel) {
      statusLabel.textContent = isFa
        ? `آماده برای تأیید (${val} بیت)...`
        : `Ready to verify (${val} bits)...`;
    }
    if (btnSubmit) {
      btnSubmit.className = 'pow-submit-btn';
      btnSubmit.textContent = isFa ? 'شروع تأیید' : 'Start Verification';
    }
    if (tokenInspectBox) {
      tokenInspectBox.textContent = isFa
        ? 'در انتظار تولید چالش...'
        : 'Waiting for challenge generation...';
    }
    if (statHashrate) statHashrate.textContent = '--';
    if (statIterations) statIterations.textContent = '--';
    if (statElapsed) statElapsed.textContent = '--';
    if (statNonce) statNonce.textContent = '--';
  }

  // Mode Switcher handlers
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetMode = tab.getAttribute('data-mode');
      if (targetMode === executionMode) return;
      executionMode = targetMode;
      modeTabs.forEach(t => {
        const isActive = t.getAttribute('data-mode') === executionMode;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-checked', String(isActive));
      });

      if (executionMode === 'background') {
        startChallengePreparation(false);
      } else {
        resetStateOnly();
      }
    });
  });

  if (diffSlider) {
    diffSlider.addEventListener('input', () => {
      updateDifficultyDisplay();
      if (executionMode === 'background') {
        startChallengePreparation(false);
      } else {
        resetStateOnly();
      }
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-diff'), 10);
      if (diffSlider) {
        diffSlider.value = String(val);
        updateDifficultyDisplay();
        if (executionMode === 'background') {
          startChallengePreparation(false);
        } else {
          resetStateOnly();
        }
      }
    });
  });

  // Cancel Button inside solving gate
  if (btnCancel) {
    btnCancel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentWorker) {
        currentWorker.terminate();
        currentWorker = null;
      }
      isSolving = false;
      isCatchupMode = false;
      currentSolution = null;

      const isFa = document.documentElement.getAttribute('lang') === 'fa';
      if (gateEl) gateEl.className = 'pow-gate state-idle';
      if (barFill) barFill.setAttribute('width', '0%');
      if (percentLabel) percentLabel.textContent = '0%';
      if (statusLabel) {
        statusLabel.textContent = isFa ? 'تأیید لغو شد' : 'Verification cancelled';
      }
      if (btnSubmit) {
        btnSubmit.className = 'pow-submit-btn';
        btnSubmit.textContent = isFa ? 'شروع تأیید' : 'Start Verification';
      }
      if (statHashrate) statHashrate.textContent = '--';
      if (statElapsed) statElapsed.textContent = '--';
    });
  }

  async function startChallengePreparation(catchup) {
    if (currentWorker) {
      currentWorker.terminate();
      currentWorker = null;
    }
    isSolving = true;
    isCatchupMode = catchup;
    currentSolution = null;

    const difficulty = diffSlider ? parseInt(diffSlider.value, 10) : 18;
    const actionName = difficulty === 14 ? 'form.submit'
      : (difficulty === 16 ? 'comment.create'
      : (difficulty === 18 ? 'invoice.create'
      : (difficulty === 21 ? 'account.register'
      : 'security.barrier')));
    const contextStr = `action=${actionName}&diff=${difficulty}&session=${Math.random().toString(36).slice(2, 10)}`;

    // Create stateless challenge
    currentChallenge = await createChallenge({
      secretKey: DEMO_SECRET_KEY,
      action: actionName,
      context: contextStr,
      difficulty,
      ttlSeconds: 180
    });

    if (tokenInspectBox) {
      tokenInspectBox.textContent = `Token: ${currentChallenge}\nAction: ${actionName} | Target: ${difficulty} bits\nContext: ${contextStr}`;
    }

    if (gateEl) {
      gateEl.className = catchup ? 'pow-gate state-catchup' : 'pow-gate state-solving';
    }
    const isFa = document.documentElement.getAttribute('lang') === 'fa';
    if (statusLabel) {
      statusLabel.textContent = catchup
        ? (isFa ? 'در حال حل چالش...' : 'Solving Challenge...')
        : (isFa ? 'در حال تأیید مرورگر...' : 'Verifying Browser...');
    }
    if (percentLabel) percentLabel.textContent = '0%';
    if (barFill) barFill.setAttribute('width', '0%');

    if (btnSubmit) {
      if (catchup) {
        btnSubmit.className = 'pow-submit-btn catchup';
        btnSubmit.textContent = isFa ? 'در حال حل چالش...' : 'Solving Challenge...';
      } else {
        btnSubmit.className = 'pow-submit-btn';
        btnSubmit.textContent = isFa ? 'در حال تأیید...' : 'Verifying Browser...';
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
        const durSec = (msg.elapsedMs / 1000).toFixed(2);
        if (statHashrate) statHashrate.textContent = `${msg.hashesPerSec.toLocaleString()} H/s`;
        if (statIterations) statIterations.textContent = msg.iterations.toLocaleString();
        if (statElapsed) statElapsed.textContent = `${durSec}s (${Math.round(msg.elapsedMs)} ms)`;
        if (percentLabel) percentLabel.textContent = `${msg.percent}%`;
        if (barFill) barFill.setAttribute('width', `${msg.percent}%`);

        if (btnSubmit) {
          btnSubmit.textContent = isFa
            ? `در حال تأیید (${msg.percent}%)...`
            : `Verifying (${msg.percent}%)...`;
        }
      } else if (msg.type === 'solved') {
        isSolving = false;
        currentSolution = msg;

        const durationSec = (msg.elapsedMs / 1000).toFixed(2);
        const hps = Math.round(msg.hashesPerSec).toLocaleString('en-US');
        const isCurrentFa = document.documentElement.getAttribute('lang') === 'fa';

        if (statHashrate) statHashrate.textContent = `${hps} H/s`;
        if (statIterations) statIterations.textContent = msg.iterations.toLocaleString();
        if (statElapsed) statElapsed.textContent = `${durationSec}s (${Math.round(msg.elapsedMs)} ms)`;
        if (statNonce) statNonce.textContent = `0x${msg.nonce.toString(16)}`;

        if (percentLabel) percentLabel.textContent = '100%';
        if (barFill) barFill.setAttribute('width', '100%');
        if (gateEl) gateEl.className = 'pow-gate state-ready';
        if (statusLabel) {
          statusLabel.textContent = isCurrentFa
            ? `مرورگر تأیید شد — در ${durationSec} ثانیه (${hps} هش/ثانیه)`
            : `Browser Verified - took ${durationSec}s (${hps} H/s)`;
        }

        // Server-side instant verification check
        const serverVerify = await verifySolution({
          token: currentChallenge,
          nonce: msg.nonce,
          context: contextStr,
          secretKey: DEMO_SECRET_KEY,
          expectedAction: actionName
        });

        if (tokenInspectBox) {
          tokenInspectBox.textContent = `Token: ${currentChallenge}\nNonce: 0x${msg.nonce.toString(16)} (${msg.nonce})\nServer Verify: ${serverVerify.valid ? 'VALID (O(1) verified)' : 'FAILED'}\nHash: ${msg.hash}\nElapsed: ${durationSec}s (${Math.round(msg.elapsedMs)}ms)`;
        }

        if (btnSubmit) {
          btnSubmit.className = 'pow-submit-btn ready';
          if (executionMode === 'background') {
            btnSubmit.textContent = isCurrentFa
              ? `مرورگر تأیید شد (${durationSec} ثانیه) · ارسال فرم`
              : `Browser Verified (${durationSec}s) · Submit Now`;
          } else {
            btnSubmit.textContent = isCurrentFa
              ? `مرورگر تأیید شد (${durationSec} ثانیه) · اجرای مجدد`
              : `Browser Verified (${durationSec}s) · Run Again`;
          }
        }

        if (isCatchupMode) {
          showToast(isCurrentFa
            ? `اثبات در ${durationSec} ثانیه تأیید شد! درخواست فوراً پردازش گردید.`
            : `Proof verified in ${durationSec}s! Request processed with zero delay.`
          );
        }
      }
    };
  }

  if (btnSubmit) {
    btnSubmit.addEventListener('click', () => {
      if (currentSolution) {
        const isFa = document.documentElement.getAttribute('lang') === 'fa';
        if (executionMode === 'background') {
          showToast(isFa
            ? 'مرورگر قبلاً تأیید شده است! درخواست با ۰ ثانیه معطلی ارسال گردید.'
            : 'Browser already verified! Request submitted with 0 delay.');
        } else {
          startChallengePreparation(false);
        }
      } else if (isSolving) {
        startChallengePreparation(true);
      } else {
        startChallengePreparation(false);
      }
    });
  }

  if (btnSimFast) {
    btnSimFast.addEventListener('click', () => {
      startChallengePreparation(true);
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      resetStateOnly();
    });
  }

  updateDifficultyDisplay();

  // If initial mode is background, start solver warm-up
  if (executionMode === 'background') {
    startChallengePreparation(false);
  }
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

  const statusLabel = document.getElementById('gate-status-text');
  const btnSubmit = document.getElementById('demo-submit-btn');
  const diffSlider = document.getElementById('diff-slider');
  const val = diffSlider ? parseInt(diffSlider.value, 10) : 18;

  if (updateDifficultyDisplayGlobal) {
    updateDifficultyDisplayGlobal();
  }

  if (currentSolution && statusLabel) {
    const durationSec = (currentSolution.elapsedMs / 1000).toFixed(2);
    const hps = Math.round(currentSolution.hashesPerSec).toLocaleString('en-US');
    statusLabel.textContent = lang === 'fa'
      ? `مرورگر تأیید شد — در ${durationSec} ثانیه (${hps} هش/ثانیه)`
      : `Browser Verified - took ${durationSec}s (${hps} H/s)`;
    if (btnSubmit && btnSubmit.classList.contains('ready')) {
      if (executionMode === 'background') {
        btnSubmit.textContent = lang === 'fa'
          ? `مرورگر تأیید شد (${durationSec} ثانیه) · ارسال فرم`
          : `Browser Verified (${durationSec}s) · Submit Now`;
      } else {
        btnSubmit.textContent = lang === 'fa'
          ? `مرورگر تأیید شد (${durationSec} ثانیه) · اجرای مجدد`
          : `Browser Verified (${durationSec}s) · Run Again`;
      }
    }
  } else if (!isSolving && statusLabel) {
    statusLabel.textContent = lang === 'fa'
      ? `آماده برای تأیید (${val} بیت)...`
      : `Ready to verify (${val} bits)...`;
    if (btnSubmit && !btnSubmit.classList.contains('ready')) {
      btnSubmit.textContent = lang === 'fa' ? 'شروع تأیید' : 'Start Verification';
    }
  }
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
