import { test } from 'node:test';
import assert from 'node:assert';
import {
  sha256,
  bytesToHex,
  hexToBytes,
  countLeadingZeroBits,
  hashContext,
  createChallenge,
  parseChallenge,
  verifyChallengeSignature,
  solvePoW,
  verifySolution
} from '../pow-engine.js';

test('SHA-256 standard vectors', async () => {
  const emptyHash = await sha256('');
  assert.strictEqual(
    bytesToHex(emptyHash),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );

  const abcHash = await sha256('abc');
  assert.strictEqual(
    bytesToHex(abcHash),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('countLeadingZeroBits bit counting precision', () => {
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x00, 0x00, 0x00])), 24);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x80, 0x00])), 0);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x40, 0x00])), 1);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x20, 0x00])), 2);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x10, 0x00])), 3);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x08, 0x00])), 4);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x04, 0x00])), 5);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x02, 0x00])), 6);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x01, 0x00])), 7);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x00, 0x80])), 8);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x00, 0x08])), 12);
  assert.strictEqual(countLeadingZeroBits(new Uint8Array([0x00, 0x00, 0x80])), 16);
});

test('Context fingerprinting binds form data deterministically', async () => {
  const ctxA = await hashContext({ email: 'alice@example.com', amount: '50' });
  const ctxB = await hashContext({ amount: '50', email: 'alice@example.com' });
  assert.strictEqual(ctxA, ctxB, 'Object key order must be deterministic');

  const ctxC = await hashContext({ email: 'bob@example.com', amount: '50' });
  assert.notStrictEqual(ctxA, ctxC, 'Different inputs must produce different fingerprints');
});

test('Stateless HMAC challenge generation and parsing', async () => {
  const secretKey = 'master-secret-key-123';
  const token = await createChallenge({
    secretKey,
    action: 'invoice.create',
    context: 'inv_998124',
    difficulty: 14,
    ttlSeconds: 60
  });

  assert.ok(token.includes('.'));
  const { payload } = parseChallenge(token);
  assert.strictEqual(payload.v, 1);
  assert.strictEqual(payload.act, 'invoice.create');
  assert.strictEqual(payload.diff, 14);
  assert.ok(payload.exp > payload.iat);

  const verified = await verifyChallengeSignature(token, secretKey);
  assert.strictEqual(verified.valid, true);

  const badSecret = await verifyChallengeSignature(token, 'wrong-secret');
  assert.strictEqual(badSecret.valid, false);
});

test('Challenge expiration prevents replay', async () => {
  const secretKey = 'master-secret-key-123';
  const token = await createChallenge({
    secretKey,
    action: 'account.register',
    difficulty: 10,
    ttlSeconds: -10 // expired in the past
  });

  const verified = await verifyChallengeSignature(token, secretKey);
  assert.strictEqual(verified.valid, false);
  assert.strictEqual(verified.expired, true);
});

test('PoW solver and O(1) server verification', async () => {
  const secretKey = 'secret-test-server';
  const action = 'account.register';
  const context = 'username=mehr_dev';
  const difficulty = 12; // 12 bits is fast for test suite

  const token = await createChallenge({
    secretKey,
    action,
    context,
    difficulty,
    ttlSeconds: 120
  });

  const { payload } = parseChallenge(token);
  const solution = await solvePoW({
    salt: payload.salt,
    context: payload.ctx,
    difficulty: payload.diff
  });

  assert.strictEqual(solution.solved, true);
  assert.ok(solution.zeroBits >= difficulty);

  // Valid verification
  const check = await verifySolution({
    token,
    nonce: solution.nonce,
    context,
    secretKey,
    expectedAction: action
  });

  assert.strictEqual(check.valid, true);
  assert.strictEqual(check.action, action);

  // Mismatched nonce fails
  const badNonce = await verifySolution({
    token,
    nonce: solution.nonce + 999999,
    context,
    secretKey
  });
  assert.strictEqual(badNonce.valid, false);

  // Context tampering fails
  const badCtx = await verifySolution({
    token,
    nonce: solution.nonce,
    context: 'username=hacker_spoof',
    secretKey
  });
  assert.strictEqual(badCtx.valid, false);

  // Action tampering fails
  const badAct = await verifySolution({
    token,
    nonce: solution.nonce,
    context,
    secretKey,
    expectedAction: 'invoice.create' // token was issued for account.register!
  });
  assert.strictEqual(badAct.valid, false);

  // Rogue server spoofing (signed by attacker secret key) fails
  const spoofedToken = await createChallenge({
    secretKey: 'attacker-controlled-rogue-key',
    action,
    context,
    difficulty: 4, // trivial difficulty
    ttlSeconds: 60
  });
  const rogueCheck = await verifySolution({
    token: spoofedToken,
    nonce: 1,
    context,
    secretKey // real server secret key
  });
  assert.strictEqual(rogueCheck.valid, false);
  assert.strictEqual(rogueCheck.error, 'Signature mismatch');

  // Insufficient token difficulty fails against minDifficulty threshold
  const lowDiffCheck = await verifySolution({
    token, // token was issued with diff: 14
    nonce: solution.nonce,
    context,
    secretKey,
    minDifficulty: 18 // endpoint requires 18 bits!
  });
  assert.strictEqual(lowDiffCheck.valid, false);
  assert.ok(lowDiffCheck.error.includes('Insufficient token difficulty'));
});
