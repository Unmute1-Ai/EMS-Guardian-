# FedRAMP Readiness Plan: Argus (EMS Guardian)

**Status:** not FedRAMP authorized. FedRAMP authorization is granted by an agency Authorizing Official (or the FedRAMP Board) after an assessment by an accredited **3PAO**. This document records where the product stands and the path there.

**Target baseline:** FedRAMP **Moderate** (EMS patient data plus public-safety operations).

## 1. What the code now enforces (`COMPLIANCE_MODE=fedramp`)
The server refuses to start unless all of these hold:
- OIDC sign-in configured, and no auth bypass (IA-2, AC-3)
- Gemini through **Vertex AI** with service-account credentials, never an API key (SA-9, IA-5)
- TLS terminated at a trusted proxy (`TRUST_PROXY`) (SC-8)

And it switches off anything outside the authorization boundary:
- **ElevenLabs is off**: it has no FedRAMP authorization. Spoken alerts use the device's built-in voice.
- **Gemini Live is off**: browser-direct sessions bypass the server boundary. Live translation and live hazard detection are unavailable in this mode until they are re-architected to run through the server.

## 2. Authorization boundary (proposed)
```
[Agency device: browser + Argus PWA]          outside boundary (agency-managed endpoint)
        │ HTTPS
┌───────┴──────────── FedRAMP boundary (Argus CSO) ─────────────┐
│ WAF / LB → oauth2-proxy (PIV/CAC via agency IdP) → Argus API   │
│ Logs → SIEM          Container registry (signed images)        │
└───────┬────────────────────────────────────────────────────────┘
        │ private / TLS
[Google Cloud Vertex AI]   leveraged, FedRAMP-authorized service
```
Host on a FedRAMP-authorized IaaS/PaaS (e.g. AWS GovCloud, Azure Government, Google Cloud Assured Workloads) and inherit their physical and environmental controls.

## 3. Gaps to close, in order

| # | Gap | Controls | Effort |
|---|---|---|---|
| 1 | Choose a FedRAMP-authorized host and region; deploy there | SA-9, SC-7, PE-* (inherited) | Medium |
| 2 | FIPS 140-validated crypto for TLS (FIPS-mode OpenSSL in nginx / LB) | SC-13 | Medium |
| 3 | Signed container images + SLSA provenance; vulnerability scanning of images | CM-14, SI-7, RA-5 | Low |
| 4 | Central logging to a SIEM with 1-yr online / 3-yr total retention, alerting | AU-4, AU-6, AU-9, AU-11 | Medium |
| 5 | Monthly OS / container / dependency scans with POA&M tracking | RA-5, CA-5 | Low (CI exists) |
| 6 | Route Gemini Live through the server (WebSocket relay) so it stays inside the boundary | SC-7, AC-4 | Medium |
| 7 | Incident response plan + US-CERT reporting procedure; contingency plan + backup tests | IR-*, CP-* | Medium (docs) |
| 8 | System Security Plan (SSP), using the NIST control map as the starting point | PL-2 | High (docs) |
| 9 | Agency sponsor, then a 3PAO readiness assessment (RAR) | CA-2 | Business |
| 10 | 3PAO full assessment → ATO | CA-6 | Business |

**Shorter paths to market while the above is underway:**
- **FedRAMP 20x / Low-impact pilots** for non-PHI training features (the simulator).
- **Agency-hosted deployment:** the agency runs Argus inside its own ATO boundary, and the software inherits the agency's authorization. This is often the fastest route for state and local EMS.
- **StateRAMP / TX-RAMP** for state and local agencies, which reuse much of the same evidence.

## 4. Evidence already in the repository
- `NIST-800-53-CONTROL-MAP.md`: control-by-control status
- `THREAT-MODEL.md`: STRIDE analysis
- `HIPAA-SECURITY-RULE-MAP.md`
- CI: SBOM per build, CodeQL, gitleaks, dependency audit, SHA-pinned actions, Dependabot
