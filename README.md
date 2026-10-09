# <img src="favicon.svg" width="32" height="32" alt="Mehr PoW logo" align="absmiddle"> Mehr Proof-of-Work (`pow`)

> **Stateless HMAC-SHA256 Proof-of-Work Protocol & Client Library**  
> HMAC-SHA256 Tokens · Non-Blocking Web Workers · O(1) Server Verification

[![Website](https://img.shields.io/badge/Live%20Site-pow.mehrnet.com-ff8a2a.svg)](https://pow.mehrnet.com)
[![GitHub License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-Passing-success.svg)]()

---

## Overview

Traditional bot mitigation relies on two fundamentally flawed approaches:
1. **Third-Party CAPTCHAs (Google reCAPTCHA, Cloudflare Turnstile, hCaptcha):** Leaks user telemetry to third parties, breaks when CDNs are blocked, and frustrates real users with annoying image-clicking puzzles.
2. **Naive Browser PoW:** Freezes the browser's UI thread upon submit or sets static difficulty targets that GPUs and ASICs easily crack for fractions of a cent.

**Mehr PoW** is a self-contained, long-lasting anti-bot specification and design system engineered for high-concurrency production workloads (user registrations, public invoice creation, anonymous feedback, and high-frequency endpoints).

---

## Core Architectural Pillars

### 1. The "Zero-Wait" Pipelining Pattern
Real users should **never wait** for a proof to solve:
* **Background Warm-up:** The moment a user focuses or interacts with a form input, a non-blocking `Web Worker` begins solving the cryptographic challenge on a secondary thread.
* **The Human Speed Margin:** Humans require 4 to 8 seconds to enter form data. A standard baseline PoW challenge finishes in **0.8 to 1.4 seconds**.
* **Zero Delay:** By the time the user clicks "Submit", the challenge is already 100% computed and verified.
* **Catch-Up Grace:** If an autofill extension (e.g. 1Password) submits the form in 100ms, the button smoothly displays an active progress bar with honest cryptographic messaging (*"Verifying browser... 75%"*) and automatically dispatches upon completion without a second click.

### 2. Stateless HMAC Challenge Token ($O(1)$ Verification)
Servers do not need Redis or database state to track challenges:
$$\text{Token} = \text{Base64Url}(\text{Payload}) + \text{"."} + \text{HMAC-SHA256}(\text{SecretKey}, \text{Base64Url}(\text{Payload}))$$

#### Payload Schema:
```json
{
  "v": 1,
  "act": "invoice.create",
  "iat": 1790022600,
  "exp": 1790022780,
  "diff": 16,
  "salt": "a1b2c3d4e5f67890",
  "ctx": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

* **Action Binding (`act`):** Proofs issued for account registration cannot be swapped for financial transactions or password resets.
* **Context Fingerprinting (`ctx`):** Binds to `SHA256(form_fields)`. Prevents attackers from taking a solved proof from user A and replaying it for user B.
* **Expiration (`exp`):** Challenges expire in 3 minutes, preventing token pooling.

---

## Visual Design Language (`.pow-gate`)

The Mehr PoW visual gate provides honest, transparent telemetry across 4 states:

| Lifecycle State | Visual Experience | Status Text |
| :--- | :--- | :--- |
| **Idle** | Muted outline, inactive track | *"Ready to verify (18 bits)..."* |
| **Solving** | Smooth pulse shimmer with telemetry | *"Verifying browser... (45%)"* |
| **Ready** | Emerald green fill & verified timing | *"Browser Verified — took 14.01s (27,767 H/s)"* |
| **Catch-up** | High-precision fill for fast autofill | *"Solving challenge (80%)..."* & auto-submits |

---

## Drop-in Client Library (`pow-client.js`)

Add zero-delay anti-bot protection to any HTML form or SPA:

```html
<script src="https://pow.mehrnet.com/pow-client.js"></script>
<script>
  MehrPoW.protect('#signup-form', {
    // Optional: for separate backend API domains (CORS)
    domain: 'https://api.example.com',
    endpoint: '/api/pow/challenge',
    action: 'account.register',
    mode: 'background' // Solves non-blockingly while user enters credentials
  });
</script>
```

Supports cross-origin APIs via the optional `domain` parameter, automatic Web Worker spawning via inline blobs (zero external worker files), hidden input injection (`pow_token`, `pow_nonce`), and programmatic solving (`MehrPoW.solve(...)`).

---

## Implementations

Self-contained solvers and middleware are included in the repository and showcased on [pow.mehrnet.com/implementation](https://pow.mehrnet.com/implementation):
* **Go:** `http.Handler` middleware with native bit counting (`math/bits.LeadingZeros8`).
* **JavaScript / TypeScript:** Non-blocking Web Worker client + Cloudflare Worker/Node verifier.
* **Python:** FastAPI / Flask verification decorator.
* **PHP:** Vanilla single-file verification script.
* **POSIX Shell:** `/bin/sh` solver using standard POSIX utilities (`od`, `awk`, `sha256sum`).

---

## Deployment

The website is deployed to Cloudflare Workers / Static Assets:
```bash
npm install
npm test
npm run deploy
```

---

## License

MIT © Mehrnet
