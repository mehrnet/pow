/**
 * Mehr PoW Background Web Worker
 * Computes cryptographic proof without blocking main UI thread.
 */

const encoder = new TextEncoder();

async function sha256(str) {
  const buf = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(hash);
}

function countLeadingZeroBits(bytes) {
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

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

let isRunning = false;

self.onmessage = async (e) => {
  const data = e.data;
  if (!data) return;

  if (data.type === 'stop') {
    isRunning = false;
    return;
  }

  if (data.type === 'solve') {
    isRunning = true;
    const { salt, context = '', difficulty = 16, startNonce = 0 } = data;
    const startTime = performance.now();
    let nonce = startNonce;
    let iterations = 0;
    const batchSize = 1000;
    const expectedIterations = Math.pow(2, difficulty);
    let lastProgressReport = startTime;

    while (isRunning) {
      const endBatch = nonce + batchSize;
      for (; nonce < endBatch; nonce++, iterations++) {
        const candidate = `${salt}:${nonce}:${context}`;
        const hash = await sha256(candidate);
        const zeroBits = countLeadingZeroBits(hash);

        if (zeroBits >= difficulty) {
          const elapsedMs = performance.now() - startTime;
          self.postMessage({
            type: 'solved',
            nonce,
            iterations: iterations + 1,
            zeroBits,
            hash: bytesToHex(hash),
            elapsedMs,
            hashesPerSec: Math.round(((iterations + 1) / (elapsedMs || 1)) * 1000)
          });
          isRunning = false;
          return;
        }
      }

      const now = performance.now();
      if (now - lastProgressReport > 60) {
        lastProgressReport = now;
        const elapsedMs = now - startTime;
        // Progress heuristic capped at 98% until actual solve
        const percent = Math.min(98, Math.round((iterations / expectedIterations) * 100));
        self.postMessage({
          type: 'progress',
          nonce,
          iterations,
          elapsedMs,
          percent,
          hashesPerSec: Math.round((iterations / (elapsedMs || 1)) * 1000)
        });
      }

      // Keep worker queue free
      await new Promise(r => setTimeout(r, 0));
    }
  }
};
