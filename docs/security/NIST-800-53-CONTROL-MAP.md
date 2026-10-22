# NIST SP 800-53 Rev. 5 / SP 800-218 Control Map: EMS Guardian

**Status:** self-assessment by the development team. **Not** an ATO, FedRAMP, StateRAMP, NATO, or HIPAA certification.
Those require an independent assessor (3PAO / agency AO) and evidence from the actual deployment environment.

**Baseline targeted:** NIST SP 800-53 Rev. 5 **Moderate** (EMS patient data is at least Moderate under FIPS 199).
**Secure development:** NIST SP 800-218 SSDF v1.1.

Legend: **Met** = implemented in this repo and testable · **Partial** = some implementation, gaps listed ·
**Not met** = open work · **Inherited** = must come from the hosting platform / customer.

---

## 1. Findings that block any production or government use

| # | Finding | Controls | Status |
|---|---------|----------|--------|
| B1 | **No server-side authentication.** `/api/*` is protected only by origin check + rate limiting. `src/lib/authManager.ts` runs in the browser and is not wired into the app, so it provides no protection. | IA-2, IA-5, AC-2, AC-3 | **Not met** |
| B2 | **"HIPAA" / encryption modules are inert.** `src/lib/hipaaCompliance.ts` and `src/lib/security.ts` run in the browser, are never imported by the running app, and fall back to the default key `change-me-in-production`. Browser-side keys provide no confidentiality. | SC-28, SC-12, SC-13 | **Not met** |
| B3 | **PHI flows to third-party AI** (Google Gemini, ElevenLabs) with no BAA or data-processing agreement recorded in the repo. | SA-9, PT-2, PT-3 | **Not met** (contractual) |
| B4 | **No FIPS 140-3 validated crypto module** in the app tier. TLS termination at nginx must use a FIPS-validated OpenSSL build for federal use. | SC-13 | **Inherited / Not met** |

Until B1–B3 are closed, the app must only be used with **synthetic data** (training/demo).

---

## 2. Control-by-control

### Access Control (AC)
| Control | Implementation | Status |
|---|---|---|
| AC-3 Access enforcement | None server-side (see B1). | Not met |
| AC-4 Information flow | `/api` rejects browser requests from foreign origins (`server/index.ts`, `ALLOWED_ORIGINS`). Service worker never caches `/api/*` responses. | Partial |
| AC-17 Remote access | Inherited from deployment (VPN / zero-trust edge). | Inherited |

### Audit & Accountability (AU)
| Control | Implementation | Status |
|---|---|---|
| AU-2 / AU-3 Event logging & content | One JSON line per `/api` call: timestamp, method, path, status, latency, client IP, including denials. Request bodies are **never** logged (PHI). | Partial: no user identity (needs B1) |
| AU-9 Protection of audit info | Logs go to stdout; retention and tamper-protection must come from the log pipeline. | Inherited |
| AU-12 Audit generation | Middleware runs before the origin check and rate limiter. | Met |

### Configuration Management (CM)
| Control | Implementation | Status |
|---|---|---|
| CM-2 Baseline config | Dockerfile (non-root user, tini, healthcheck), nginx.conf, `.env.example`. | Partial |
| CM-7 Least functionality | `x-powered-by` disabled; JSON body limit 256 KB; only the listed `/api` routes exist. | Met |
| CM-8 Component inventory | CycloneDX SBOM generated on every CI run, kept 90 days. | Met |

### Identification & Authentication (IA)
| Control | Status |
|---|---|
| IA-2, IA-5, IA-8 | **Not met** (B1). Recommended: OIDC via the agency IdP with PIV/CAC or phishing-resistant MFA, validated by the API server (`jose` is already a dependency). |

### Incident Response (IR)
| Control | Status |
|---|---|
| IR-4 / IR-6 | `SECURITY.md` has a disclosure path. Runbook, contacts, and the reporting chain need an owner. **Partial** |

### Risk Assessment (RA)
| Control | Implementation | Status |
|---|---|---|
| RA-3 Risk assessment | `docs/security/THREAT-MODEL.md` (STRIDE). | Met (initial) |
| RA-5 Vulnerability scanning | CI: `npm audit` (fail on high), CodeQL `security-extended`, gitleaks, dependency-review on PRs; Dependabot weekly. | Met |

### System & Services Acquisition (SA)
| Control | Implementation | Status |
|---|---|---|
| SA-9 External services | Gemini and ElevenLabs keys are held server-side only; the browser gets single-use, 30-min Gemini Live tokens. BAAs: see B3. | Partial |
| SA-11 Developer testing | Type-check + build gate in CI. **No automated test suite yet.** | Partial |
| SA-15 Dev process | SSDF mapping below. | Partial |

### System & Communications Protection (SC)
| Control | Implementation | Status |
|---|---|---|
| SC-5 DoS protection | Per-IP rate limits: 60/min on `/api`, 6/min on live tokens; `TRUST_PROXY` keys limits on the real client IP behind nginx. | Met (app tier) |
| SC-7 Boundary protection | Strict CSP in production (`default-src 'self'`, no inline script, `frame-ancestors 'none'`), helmet headers, HSTS. | Met (app tier) |
| SC-8 Transmission confidentiality | TLS at nginx (TLS 1.2+ in `nginx.conf`). | Inherited |
| SC-12 / SC-13 Crypto | See B2 / B4. | Not met |
| SC-28 Data at rest | The app stores no PHI server-side. Browser cache holds only static assets, never API responses. | Partial |

### System & Information Integrity (SI)
| Control | Implementation | Status |
|---|---|---|
| SI-2 Flaw remediation | Dependabot (npm, actions, docker) + audit gate. 2 critical / 9 high resolved in commit `3e358b8`. | Met |
| SI-10 Input validation | Strings length-capped; coordinates range-checked; chat history reduced to plain `user`/`model` text turns, so clients can't forge system or tool parts. | Met |
| SI-11 Error handling | Upstream error detail is not returned to clients. | Met |

---

## 3. NIST SP 800-218 (SSDF) practices in CI (`.github/workflows/ci.yml`)

| Practice | Evidence |
|---|---|
| PO.3 Toolchain | Pinned Node 20; Actions pinned to full commit SHAs; Dependabot keeps the pins current. |
| PS.1 Protect code | gitleaks secret scan on every push/PR over the full history. *Recommended:* branch protection + required signed commits on `main` (GitHub settings, not in repo). |
| PS.3 Archive & provenance | CycloneDX SBOM artifact per commit. *Next:* SLSA build provenance / signed container image. |
| PW.4 Reuse secure components | `npm ci --ignore-scripts` (no install-time code); audit gate; dependency-review on PRs. |
| PW.7 / PW.8 Code review & testing | CodeQL `security-extended`; TypeScript strict type-check of the frontend and the server. |
| RV.1 Identify vulnerabilities | Dependabot weekly; CodeQL alerts; `SECURITY.md` disclosure. |

---

## 4. Offline / disconnected operation (DDIL)

| Concern | Behavior |
|---|---|
| App availability | Service worker caches the app shell and assets after the first online load. |
| ASL hand tracking | MediaPipe runtime is self-hosted (`/mediapipe/hands`) and precached, so there is **no CDN dependency**. |
| Voice output | Falls back to the device's built-in speech synthesis when ElevenLabs is unreachable. |
| Handoff report | Falls back to an on-device MIST template containing the medic's notes verbatim. |
| Cloud AI (scenarios, translation, Live) | Requires connectivity; fails closed with an error. |
| Data handling | API responses are never written to the offline cache. |

**Not verified:** service-worker install and offline load in a real browser (the development preview blocks service workers). Validate on target devices in airplane mode before field use.
