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
