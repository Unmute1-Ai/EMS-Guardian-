# HIPAA Security Rule Map: Argus (EMS Guardian)

**What this is:** how the software supports the technical safeguards of the HIPAA Security Rule (45 CFR §164.312).
**What this is not:** a statement that Argus is "HIPAA compliant." HIPAA compliance belongs to the **covered entity** (the EMS agency or hospital) and its business associates, and depends on their policies, workforce training, risk analysis and signed BAAs. Software alone can't make anyone compliant.

Run with `COMPLIANCE_MODE=hipaa`. The server refuses to start unless the safeguards below are configured.

## Technical safeguards (§164.312)

| Standard | Requirement | How Argus meets it | Owner |
|---|---|---|---|
| (a)(1) Access control | Unique user identification (R) | OIDC sign-in on every `/api` call; the user's `sub` is attached to each request (`server/auth.ts`) | Argus + agency IdP |
| | Emergency access procedure (R) | Break-glass accounts in the agency IdP | Agency |
| | Automatic logoff (A) | Session lifetime is set by the IdP / proxy (recommended: 15-min idle on shared devices) | Agency IdP |
| | Encryption/decryption (A) | No PHI stored server-side; PHI is never written to the offline cache; devices need full-disk encryption (MDM) | Argus + agency MDM |
| (b) Audit controls | Record activity on systems with ePHI | JSON audit line per API call: time, route, status, user, IP, including denials. Bodies are never logged. | Argus; retention by log pipeline (6 yrs recommended) |
| (c)(1) Integrity | Protect ePHI from improper alteration | TLS in transit; no server-side ePHI store; the client can't forge AI history turns (`cleanHistory`) | Argus |
| (d) Authentication | Verify the person is who they claim | Tokens verified against the IdP's keys: issuer, audience, expiry, asymmetric algorithms only, optional role | Argus + IdP (MFA / PIV) |
| (e)(1) Transmission security | Guard ePHI in transit | HTTPS to the server; HTTPS to Vertex AI; HSTS; CSP | Argus + nginx TLS |

R = required, A = addressable.

## Business associates (§164.308(b), §164.314)

| Processor | What it receives | BAA | Argus setting |
|---|---|---|---|
| Google Cloud **Vertex AI** (Gemini) | Field notes, transcripts, frames sent for AI features | Available under the Google Cloud BAA; Vertex AI is a covered service. **Confirm the current covered-services list when signing.** | `GOOGLE_GENAI_USE_VERTEXAI=true` (required in hipaa mode) |
| Google **AI Studio** API key | Same | **No BAA.** | Blocked in hipaa mode |
| ElevenLabs | Text of spoken alerts | Enterprise plans only; confirm before use | Off unless `ELEVENLABS_BAA=true`; otherwise the device voice is used |
| Hosting (AWS / GCP / Azure) | Logs, traffic | Standard cloud BAA | Agency / Unmute1ai |
| Unmute1ai | Operates the service | Unmute1ai signs a BAA with each agency | Contract |

## Administrative and physical safeguards (agency-owned)
Risk analysis (§164.308(a)(1)), workforce training, sanctions policy, contingency plan, device and media controls, facility access. Argus supplies the system description and threat model (`THREAT-MODEL.md`) as input to the agency's risk analysis.

## Still open before real PHI
1. Sign BAAs (Google Cloud; ElevenLabs if used; hosting).
2. Agency IdP integration and session-timeout settings.
3. Log retention (6 years) and tamper protection in the log pipeline.
4. Independent security assessment / penetration test.
