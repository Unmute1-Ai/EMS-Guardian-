# EMS Guardian Threat Model (STRIDE)

Scope: browser SPA + `server/index.ts` API + third-party AI (Gemini, ElevenLabs). Last reviewed: 2026-10-22.

## Assets
1. **Patient information** entered by responders (field notes, voice, camera frames).
2. **API keys** for Gemini / ElevenLabs (cost + data-access exposure).
3. **Integrity of guidance** shown to responders (protocol hints, hazard alerts, translations).
4. **Availability** in the field, including disconnected operation.

## Trust boundaries
```
[Responder device: browser + service worker]
        │  HTTPS (nginx, TLS)          ← boundary 1: public network
[API server: holds keys, validates, logs]
        │  HTTPS / WSS                 ← boundary 2: third-party processors
[Google Gemini]   [ElevenLabs]
```
Gemini Live is the exception: the browser connects to Google directly with a single-use, short-lived token from the server.

## Threats and mitigations

| ID | STRIDE | Threat | Mitigation in repo | Residual risk |
|---|---|---|---|---|
| T1 | Spoofing | Anyone on the network calls `/api` and spends AI credits or mints Live tokens | Origin check, per-IP rate limits (6/min for tokens), single-use 30-min tokens | **High** until server-side auth exists (control map B1) |
| T2 | Info disclosure | API keys shipped in the JS bundle | Keys are server-only; the bundle was checked for key values | Low |
| T3 | Info disclosure | PHI written to logs | Logs record metadata only, never bodies | Low |
| T4 | Info disclosure | PHI left in the offline cache on a lost or stolen device | Service worker never caches `/api/*`; app state is in-memory | Medium: OS screen lock / MDM required (inherited) |
| T5 | Info disclosure | PHI sent to third-party AI | Server-side proxy limits the fields sent | **High** until BAAs are in place (B3) |
| T6 | Tampering | Forged "model" turns or system parts in simulator history steer the AI | History reduced to plain `user`/`model` text, max 20 turns × 4k chars | Low |
| T7 | Tampering | Prompt injection through spoken or translated content produces unsafe guidance | System prompts state AI output is advisory; Markdown is rendered without raw HTML | **Medium**: AI output must never be treated as a medical order (README safety boundary) |
| T8 | Tampering | XSS via AI output or injected script | React escaping; `react-markdown` with no raw HTML; strict CSP (no inline script) | Low |
| T9 | Tampering | Compromised npm dependency or GitHub Action | SHA-pinned actions, `--ignore-scripts`, audit gate, dependency-review, Dependabot, SBOM | Medium (supply chain is never zero) |
| T10 | Repudiation | No record of who requested what, or a record quietly edited afterwards | Signed, hash-chained receipt per request: user `sub`, IP, route, status; verifiable with `npm run audit:verify` | Low: someone holding both the signing key and the file can rewrite history, so keep the key off the log host |
| T11 | DoS | Request flooding or oversized bodies | Rate limits, 256 KB body cap, input length caps | Medium: volumetric DDoS needs the edge/WAF (inherited) |
| T12 | DoS | Loss of connectivity in the field | Offline shell, self-hosted MediaPipe, on-device TTS + handoff fallback | Medium: cloud AI features are unavailable offline |
| T13 | Elevation | Clickjacking / framing the app | `frame-ancestors 'none'`, `X-Frame-Options` | Low |
| T14 | Elevation | Container breakout / root process | Non-root user, tini, minimal Alpine image | Low (also depends on host hardening) |

## Adversarial review: fixes applied in this change
- Spoofed simulator history passed straight to Gemini → sanitized (`cleanHistory`).
- Unvalidated coordinates → range-checked.
- CSP was disabled → strict production CSP.
- Any website could use the API through a visitor's browser → origin allow-list.
- Rate limits keyed on the proxy IP behind nginx → `TRUST_PROXY`.
- No API audit trail → structured logging, including denied requests.
- Upstream error messages leaked to clients → generic errors.
- Hand-tracking loaded from a public CDN (a supply-chain risk, and it breaks offline) → self-hosted.

## Open items (owner needed)
1. Server-side auth: OIDC + PIV/CAC or MFA, validated with `jose` on every `/api` route.
2. BAAs / DPAs with Google and ElevenLabs, or an on-prem/edge model (e.g. NVIDIA NIM on Jetson) for disconnected and classified use.
3. Delete or rewrite the unused browser-side "HIPAA" and encryption modules so they can't be mistaken for real controls.
4. Automated tests (unit + Playwright offline test in airplane mode).
5. An independent penetration test before any operational pilot.
