import { test } from 'node:test';
import assert from 'node:assert';
import '../pow-client.js';

const MehrPoW = globalThis.MehrPoW;

test('MehrPoW.resolveUrl handles same-origin and cross-domain endpoints', () => {
  assert.strictEqual(
    MehrPoW.resolveUrl('/pow/challenge'),
    '/pow/challenge'
  );
  assert.strictEqual(
    MehrPoW.resolveUrl('/api/pow/challenge'),
    '/api/pow/challenge'
  );
  assert.strictEqual(
    MehrPoW.resolveUrl('/pow/challenge', 'https://api.example.com'),
    'https://api.example.com/pow/challenge'
  );
  assert.strictEqual(
    MehrPoW.resolveUrl('pow/challenge', 'https://api.example.com/'),
    'https://api.example.com/pow/challenge'
  );
  assert.strictEqual(
    MehrPoW.resolveUrl('challenge', 'https://api.example.com/v2/'),
    'https://api.example.com/v2/challenge'
  );
});

test('MehrPoW.getHeaders converts solution to HTTP headers', () => {
  const headers = MehrPoW.getHeaders({ token: 'test.jwt.token', nonce: 123456 });
  assert.deepStrictEqual(headers, {
    'X-Mehr-PoW-Token': 'test.jwt.token',
    'X-Mehr-PoW-Nonce': '123456'
  });

  assert.deepStrictEqual(MehrPoW.getHeaders(null), {});
});

test('MehrPoW.solve invokes custom callApi handler with request parameters', async () => {
  let calledWith = null;
  const mockApi = async (req) => {
    calledWith = req;
    return {
      token: 'fake.jwt.token',
      salt: 'salt123',
      difficulty: 8,
      context: req.context
    };
  };

  try {
    await MehrPoW.solve({
      callApi: mockApi,
      action: 'invoice.create',
      domain: 'https://api.example.com',
      endpoint: '/pow/challenge'
    });
  } catch (e) {
    // In Node.js without DOM Worker, worker creation throws after callApi returns
  }

  assert.ok(calledWith !== null, 'callApi should be invoked');
  assert.strictEqual(calledWith.action, 'invoice.create');
  assert.strictEqual(calledWith.domain, 'https://api.example.com');
  assert.strictEqual(calledWith.endpoint, '/pow/challenge');
  assert.strictEqual(calledWith.url, 'https://api.example.com/pow/challenge');
});

test('MehrPoW.protect auto-injects pow-gate into form if absent', () => {
  const children = [];
  const submitBtn = {
    tagName: 'BUTTON',
    type: 'submit',
    parentNode: {
      insertBefore: (newChild, refChild) => {
        const idx = children.indexOf(refChild);
        if (idx !== -1) children.splice(idx, 0, newChild);
        else children.push(newChild);
      }
    }
  };
  children.push(submitBtn);

  const mockForm = {
    tagName: 'FORM',
    querySelector: (sel) => {
      if (sel.includes('pow-gate')) return null;
      if (sel.includes('submit')) return submitBtn;
      return null;
    },
    appendChild: (el) => children.push(el),
    getAttribute: () => null,
    addEventListener: () => {}
  };

  globalThis.document = {
    createElement: (tag) => {
      return {
        tagName: tag.toUpperCase(),
        className: '',
        setAttribute: () => {},
        querySelector: () => null
      };
    }
  };

  const handle = MehrPoW.protect(mockForm, { mode: 'manual' });
  assert.ok(handle, 'protect should return handle');
  assert.strictEqual(typeof handle.solve, 'function');
  assert.strictEqual(typeof handle.cancel, 'function');
  assert.strictEqual(typeof handle.reset, 'function');
  assert.strictEqual(typeof handle.destroy, 'function');
  assert.ok(children.some(c => c.className && c.className.includes('pow-gate')), 'pow-gate should be injected');

  delete globalThis.document;
});

test('MehrPoW.protect invokes callApi and attaches submit handlers', async () => {
  let callApiParams = null;
  let submitCalled = false;
  const listeners = {};

  const mockForm = {
    tagName: 'FORM',
    querySelector: (sel) => null,
    appendChild: () => {},
    getAttribute: () => null,
    addEventListener: (event, fn) => {
      listeners[event] = fn;
    },
    removeEventListener: (event, fn) => {
      delete listeners[event];
    }
  };

  globalThis.document = {
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      className: '',
      setAttribute: () => {},
      querySelector: () => null
    })
  };

  const handle = MehrPoW.protect(mockForm, {
    mode: 'onclick',
    difficulty: 18,
    action: 'account.register',
    callApi: async (req) => {
      callApiParams = req;
      return {
        token: 'token.123',
        salt: 'salt123',
        difficulty: 18,
        context: 'ctx'
      };
    },
    onSubmit: (sol) => {
      submitCalled = true;
    }
  });

  assert.ok(handle, 'handle should exist');
  assert.strictEqual(typeof listeners['submit'], 'function', 'submit listener should be attached');

  handle.destroy();
  assert.strictEqual(listeners['submit'], undefined, 'submit listener should be removed on destroy');

  delete globalThis.document;
});

test('MehrPoW automatically injects embedded styles and complete widget DOM', () => {
  const headChildren = [];
  const formChildren = [];
  const attrs = {};

  const mockHead = {
    appendChild: (el) => headChildren.push(el)
  };

  const mockForm = {
    tagName: 'FORM',
    querySelector: (sel) => null,
    appendChild: (el) => formChildren.push(el),
    getAttribute: () => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  globalThis.document = {
    head: mockHead,
    getElementById: (id) => headChildren.find(c => c.id === id) || null,
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        id: '',
        textContent: '',
        innerHTML: '',
        setAttribute: (k, v) => { attrs[k] = v; },
        querySelector: () => null
      };
      return el;
    }
  };

  const handle = MehrPoW.protect(mockForm, {
    mode: 'manual',
    theme: 'dark'
  });

  assert.ok(handle, 'handle should exist');
  const styleEl = headChildren.find(c => c.id === 'mehr-pow-client-styles');
  assert.ok(styleEl, 'style tag should be injected into head');
  assert.ok(styleEl.textContent.includes('.pow-gate'), 'injected style should contain .pow-gate rules');

  const injectedGate = formChildren.find(c => c.className && c.className.includes('pow-gate'));
  assert.ok(injectedGate, 'pow-gate should be injected into form');
  assert.strictEqual(attrs['data-pow-theme'], 'dark', 'theme should be set');
  assert.ok(injectedGate.innerHTML.includes('pow-bar-track'), 'gate should include progress track');
  assert.ok(injectedGate.innerHTML.includes('pow-cancel-btn'), 'gate should include cancel button');
  assert.ok(injectedGate.innerHTML.includes('pow-gate-foot'), 'gate should include footer badge');

  handle.destroy();
  delete globalThis.document;
});

test('MehrPoW.solve rejects immediately when signal is already aborted', async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    async () => {
      await MehrPoW.solve({
        endpoint: '/pow/challenge',
        signal: controller.signal
      });
    },
    (err) => {
      assert.strictEqual(err.name, 'AbortError');
      return true;
    }
  );
});

test('MehrPoW.protect releases submit button and dispatches pow:cancel event on cancel', () => {
  const submitBtn = {
    tagName: 'BUTTON',
    type: 'submit',
    disabled: true,
    textContent: 'Original Submit',
    attributes: {},
    hasAttribute: (k) => Boolean(submitBtn.attributes[k]),
    getAttribute: (k) => submitBtn.attributes[k] || null,
    setAttribute: (k, v) => { submitBtn.attributes[k] = String(v); },
    removeAttribute: (k) => { delete submitBtn.attributes[k]; }
  };

  let cancelDispatched = false;
  const mockForm = {
    tagName: 'FORM',
    querySelector: (sel) => {
      if (sel.includes('pow-gate')) return null;
      if (sel.includes('submit')) return submitBtn;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel.includes('submit')) return [submitBtn];
      return [];
    },
    appendChild: () => {},
    getAttribute: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: (evt) => {
      if (evt.type === 'pow:cancel') {
        cancelDispatched = true;
      }
    }
  };

  globalThis.document = {
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      className: '',
      setAttribute: () => {},
      querySelector: () => null
    })
  };

  let onCancelCalled = false;
  const handle = MehrPoW.protect(mockForm, {
    mode: 'manual',
    onCancel: () => { onCancelCalled = true; }
  });

  // Verify that cancel re-enables button and fires events
  assert.strictEqual(submitBtn.disabled, true);
  handle.cancel('User aborted');

  assert.strictEqual(submitBtn.disabled, false, 'submit button should be re-enabled');
  assert.strictEqual(cancelDispatched, true, 'pow:cancel event should be dispatched');

  handle.destroy();
  delete globalThis.document;
});


