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
