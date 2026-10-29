# Argus Pilot Runbook

For the team standing up an Argus pilot with an EMS, Fire or Police agency.

## 0. Pick the pilot type first

| | **Synthetic-data pilot** | **Live-PHI pilot** |
|---|---|---|
| Data | Training scenarios and made-up patients only | Real patient encounters |
| `COMPLIANCE_MODE` | blank | `hipaa` (or `fedramp`) |
| AI | AI Studio key allowed | Vertex AI under a signed Google Cloud BAA |
| Paperwork | Pilot agreement | Pilot agreement **+ BAA with the agency + BAAs with processors** + agency risk analysis |
| Typical length | 2–4 weeks | 60–90 days after legal review |

**Start with a synthetic-data pilot.** It proves the workflow on real devices and in real crews' hands, while BAAs are negotiated in parallel.

## 1. Prerequisites
- [ ] A Linux VM (2 vCPU / 4 GB) on the agency's cloud or a FedRAMP-authorized host, with Docker Engine 24+ and Compose v2
- [ ] DNS name for the pilot (e.g. `argus.pilot.<agency>.gov`) and a TLS certificate in `./certs/cert.pem` + `key.pem`
- [ ] An OIDC client in the agency IdP (Entra ID, Okta, Keycloak, Login.gov)
  - Redirect URI: `https://<host>/oauth2/callback`
  - Roles/groups claim containing `argus-responder` for pilot users
  - MFA or PIV/CAC required by IdP policy
- [ ] AI: either a Vertex AI project + service account (live PHI), or a Gemini API key (synthetic only)
- [ ] Pilot devices: tablets or phones with an up-to-date Chrome/Edge/Safari, camera + mic, MDM with disk encryption and screen lock

## 2. Deploy
```bash
git clone https://github.com/Unmute1-Ai/EMS-Guardian- argus && cd argus
cp .env.production.example .env.production   # fill in every value
npm ci && npm run audit:keygen -- ./secrets   # audit signing key (once); hand secrets/audit-public.pem to the auditor
sudo chown 1001 ./secrets/audit-signing.pem   # readable by the container user only
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
docker compose -f docker-compose.production.yml ps          # all healthy?
curl -fsS https://<host>/health                             # {"ok":true,"auth":"oidc",...}
curl -fsS https://<host>/ready                              # {"ready":true}
```
In `hipaa` / `fedramp` mode the `argus` container **will not start** if a safeguard is missing. `docker compose logs argus` lists exactly which.

## 3. Go-live checklist (do it on a pilot device)
- [ ] Opening the URL sends you to the agency sign-in, then into Argus
- [ ] A user **without** the pilot role is refused (403)
- [ ] ASL tab: camera permission prompt, hands tracked
- [ ] Translate tab: mic permission, a Spanish sentence is translated
- [ ] Report tab: notes produce a MIST report
- [ ] Spoken alert plays on agency switch (cloud or device voice)
- [ ] **Airplane mode:** reload; the app opens, ASL tracking works, the Report tab gives the offline template
- [ ] `docker compose logs argus | grep '"evt":"api"'` shows entries with the tester's user id and **no request bodies**
- [ ] Copy the thread out and verify it: `docker compose cp argus:/var/lib/argus/audit/thread.jsonl . && npm run audit:verify -- thread.jsonl secrets/audit-public.pem` prints `OK`
- [ ] The crew lead has the support contact and knows the AI is advisory

## 4. Day-2 operations
| Task | How |
|---|---|
| Logs | `docker compose logs -f argus`; ship JSON lines to the agency SIEM (retain 6 yrs for PHI pilots) |
| Upgrade | `git pull && docker compose ... up -d --build`; `/ready` gates traffic, shutdown is graceful (10 s drain) |
| Rollback | `ARGUS_VERSION=<previous> docker compose ... up -d` (tag every image you deploy), or `git checkout <tag>` and rebuild |
| Rotate secrets | Update `.env.production`, `up -d`; rotating `OAUTH2_PROXY_COOKIE_SECRET` signs everyone out |
| Rotate the audit key | Archive and verify the current thread, then generate a new key **and** start a new thread file (the server refuses to append to a thread signed by another key) |
| Dependency patches | Merge Dependabot PRs after CI passes; redeploy weekly |
| Device update | Users get new versions on next reload (service worker revalidates) |

## 5. Incidents
| Situation | Do this |
|---|---|
| AI down / slow | Crews keep working: device voice, offline handoff template, ASL on device. Check `/ready` and the provider status page. |
| Sign-in broken | Check the IdP and `docker compose logs oauth2-proxy`. **Do not** set `AUTH_DISABLED` on a live-PHI pilot. |
| Audit thread fails to verify | Treat as a security incident: preserve the volume and the stack logs, note the `seq` it broke at, and compare against the SIEM copy (stdout receipts) to see what changed. |
| Suspected data exposure | Stop the stack (`docker compose down`), preserve logs, and notify the agency privacy officer **immediately**. HIPAA breach clock: notification without unreasonable delay, ≤ 60 days. |
| Unsafe AI output reported | Capture time + user id from the log (never the patient data), file an issue, and brief crews: AI output is advisory, follow protocol and medical control. |

## 6. Exit criteria (decide at pilot close)
- Crews used ASL / translate on ≥ N real or simulated encounters
- Time-to-communication versus the baseline (interpreter line / gestures)
- Zero sign-in bypasses; no PHI in logs (spot-check)
- Crew feedback survey; list of must-fix issues before wider rollout
