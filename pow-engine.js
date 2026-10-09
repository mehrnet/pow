/**
 * Mehr Proof of Work (PoW) Core Engine
 * Standardized, stateless, long-lasting anti-bot challenge and verification protocol.
 * Universal across Browser Web Workers, Cloudflare Workers, Node.js, Deno, and Bun.
 */

const encoder = new TextEncoder();

/**
 * Computes SHA-256 hash of a string or Uint8Array.
 * Returns Uint8Array of 32 bytes.
 */
export async function sha256(data) {
  const buf = typeof data === 'string' ? encoder.encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(hash);
}

/**
 * Converts a Uint8Array or ArrayBuffer to a hex string.
 */
export function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Converts a hex string to a Uint8Array.
 */
export function hexToBytes(hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Computes a standardized context fingerprint from form inputs or target strings.
 */
export async function hashContext(contextData) {
  let str = '';
  if (typeof contextData === 'string') {
    str = contextData;
  } else if (contextData && typeof contextData === 'object') {
    // Deterministic sorted key serialization
    const keys = Object.keys(contextData).sort();
    str = keys.map(k => `${k}=${contextData[k]}`).join('&');
  }
  const hash = await sha256(str);
  return bytesToHex(hash);
}

/**
 * Counts leading zero bits in a Uint8Array.
 */
export function countLeadingZeroBits(bytes) {
  let zeroBits = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === 0) {
      zeroBits += 8;
    } else {
      zeroBits += Math.clz32(byte) - 24;
      break;
    }
  }
  return zeroBits;
}

/**
 * Base64URL encoding without padding
 */
export function base64UrlEncode(str) {
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL decoding
 */
export function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Computes HMAC-SHA256 signature for a message.
 */
export async function hmacSha256(secretKey, message) {
  const keyBuf = encoder.encode(secretKey);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const msgBuf = encoder.encode(message);
  const sig = await crypto.subtle.sign('HMAC', key, msgBuf);
  return bytesToHex(new Uint8Array(sig));
}

/**
 * Issues a stateless HMAC challenge token.
 */
export async function createChallenge({
  secretKey,
  action = 'account.register',
  context = '',
  difficulty = 16,
  ttlSeconds = 180,
  salt = null
}) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const randomSalt = salt || bytesToHex(crypto.getRandomValues(new Uint8Array(8)));
  const ctxHash = context.length === 64 && /^[0-9a-f]{64}$/i.test(context) 
    ? context.toLowerCase() 
    : await hashContext(context);

  const payload = {
    v: 1,
    act: action,
    iat: now,
    exp,
    diff: difficulty,
    salt: randomSalt,
    ctx: ctxHash
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(payloadJson);
  const signature = await hmacSha256(secretKey, payloadB64);

  return `${payloadB64}.${signature}`;
}

/**
 * Parses and verifies challenge payload structure.
 */
export function parseChallenge(token) {
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid challenge format: missing HMAC signature');
  }
  const [payloadB64, signature] = parts;
  const payloadJson = base64UrlDecode(payloadB64);
  const payload = JSON.parse(payloadJson);
  return { payload, payloadB64, signature };
}

/**
 * Validates HMAC signature and expiration of a challenge token.
 */
export async function verifyChallengeSignature(token, secretKey) {
  const { payload, payloadB64, signature } = parseChallenge(token);
  const expectedSig = await hmacSha256(secretKey, payloadB64);
  if (signature.toLowerCase() !== expectedSig.toLowerCase()) {
    return { valid: false, error: 'Signature mismatch' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (now > payload.exp) {
    return { valid: false, error: 'Challenge expired', expired: true };
  }
  return { valid: true, payload };
}

/**
 * Solves a PoW challenge by finding a nonce whose hash meets the target leading zero bits.
 */
export async function solvePoW({
  salt,
  context = '',
  difficulty = 16,
  startNonce = 0,
  maxIterations = 5000000,
  onProgress = null,
  batchSize = 2000
}) {
  const startTime = performance.now();
  let nonce = startNonce;
  let iterations = 0;
  const ctx = context || '';

  while (iterations < maxIterations) {
    const endBatch = nonce + batchSize;
    for (; nonce < endBatch; nonce++, iterations++) {
      const candidate = `${salt}:${nonce}:${ctx}`;
      const hash = await sha256(candidate);
      const zeroBits = countLeadingZeroBits(hash);
      
      if (zeroBits >= difficulty) {
        const elapsedMs = performance.now() - startTime;
        const hashHex = bytesToHex(hash);
        return {
          solved: true,
          nonce,
          iterations: iterations + 1,
          zeroBits,
          hash: hashHex,
          elapsedMs,
          hashesPerSec: Math.round(((iterations + 1) / (elapsedMs || 1)) * 1000)
        };
      }
    }

    if (onProgress) {
      const elapsedMs = performance.now() - startTime;
      onProgress({
        nonce,
        iterations,
        elapsedMs,
        hashesPerSec: Math.round((iterations / (elapsedMs || 1)) * 1000)
      });
    }

    // Yield thread to keep UI / worker responsive
    await new Promise(r => setTimeout(r, 0));
  }

  return {
    solved: false,
    iterations,
    elapsedMs: performance.now() - startTime
  };
}

/**
 * Server-side O(1) instant verification of client's submitted solution.
 */
export async function verifySolution({
  token,
  nonce,
  context = '',
  secretKey,
  expectedAction = null
}) {
  const sigCheck = await verifyChallengeSignature(token, secretKey);
  if (!sigCheck.valid) {
    return sigCheck;
  }
  const payload = sigCheck.payload;

  if (expectedAction && payload.act !== expectedAction) {
    return { valid: false, error: `Action mismatch: expected ${expectedAction}, got ${payload.act}` };
  }

  const expectedCtx = context.length === 64 && /^[0-9a-f]{64}$/i.test(context)
    ? context.toLowerCase()
    : await hashContext(context);

  if (payload.ctx !== expectedCtx) {
    return { valid: false, error: 'Context fingerprint mismatch' };
  }

  const candidate = `${payload.salt}:${nonce}:${payload.ctx}`;
  const hash = await sha256(candidate);
  const zeroBits = countLeadingZeroBits(hash);

  if (zeroBits < payload.diff) {
    return {
      valid: false,
      error: `Insufficient difficulty: expected ${payload.diff} zero bits, got ${zeroBits}`
    };
  }

  return {
    valid: true,
    action: payload.act,
    zeroBits,
    difficulty: payload.diff,
    hash: bytesToHex(hash),
    issuedAt: payload.iat,
    expiresAt: payload.exp
  };
}
