# EMS Guardian

[Portfolio](https://github.com/Unmute1-Ai/Unmute1ai#readme) · [Engineering](https://github.com/Unmute1-Ai/U1Ai#readme) · [Security evidence](https://github.com/Unmute1-Ai/glass-box#readme)

**Edge-first communication and field-assistance software for emergency-services workflows.**

EMS Guardian combines an accessible field interface, translation/ASL support, structured handoff tooling, and AI-assisted workflow components. The repository includes a Vite/React application, production container configuration, environment templates, deployment guidance, and verification scripts.

> **Status: development application, not a certified medical device and not independently certified for HIPAA or clinical compliance.** Any real-world emergency or healthcare deployment requires security review, medical-direction approval, jurisdiction-specific validation, privacy review, and authenticated integrations.

## What it includes

- **Field interface** for structured incident and patient-workflow support.
- **Accessible communication** concepts including ASL and multilingual interaction.
- **Structured handoff/reporting** flows.
- **AI-assisted components** behind explicit configuration boundaries.
- **Deployment assets**: production Dockerfile, Docker Compose, Nginx config, environment templates.
- **Security controls in code/configuration** including authentication, rate limiting, audit-oriented utilities, and secure-header configuration.
- **Combined site**: static marketing pages in `public/` — the Unmute1ai hub at `/welcome/`, Argus Responder at `/argus/`, and U1 AccessGuard at `/accessguard/` — copied verbatim into `dist/` by the build.

## Safety boundary

EMS Guardian must not be treated as an autonomous clinical authority. AI output is advisory. The application must not represent generated content as an official emergency directive, medical order, diagnosis, or authenticated dispatch message unless the relevant external authority integration has been separately implemented and verified.

Do not place real PHI, credentials, secrets, or production API keys in the repository.

## Combined site

The built site is more than the app. `/welcome/` is the Unmute1ai platform hub, linking **Argus Responder** at `/argus/`, **U1 AccessGuard** at `/accessguard/`, and the U1 Field app at the root. The marketing pages live in `public/` and are copied verbatim into `dist/` by the build; the app itself is untouched at `/`.

## Staff area

`/staff/` is a password-protected static landing page of staff quick links. Protection is nginx HTTP basic auth — there is no backend, no sessions, no roles, and no self-service password reset; browsers show their native login prompt. Interactive staff tooling would require the server-side tier (see the open Express-rewrite discussion) and is out of scope here.

### Go-live: one command

Set the staff credentials in the environment and bring the stack up — that is the whole deployment:

```bash
export STAFF_USER=ops STAFF_PASSWORD='a-strong-passphrase'
docker compose -f docker-compose.production.yml up -d
```

On first boot the container generates a bcrypt credential file at `nginx/staff/staff.htpasswd`. The file is written once and never overwritten: it survives container recreation, and later boots need no credential environment at all.

Prefer a throwaway first credential to picking a password? Set `STAFF_GENERATE_PASSWORD=true` (and no `STAFF_PASSWORD`): the container generates a strong random password and logs it exactly once at startup — read it from `docker compose -f docker-compose.production.yml logs web`. The username defaults to `staff` unless `STAFF_USER` is set.

Fail closed: with no credential file and no credential environment, the container exits non-zero with the exact variable to set. `/staff/` is never served unauthenticated, including after misconfiguration.

Two operator-side prerequisites come from the existing mounts: TLS certificates in `./certs/` must be readable by the container (root-owned, or 644 — a key owned by your user with mode 600 is not readable inside the container), and the `./nginx/staff/` store directory should be left for Docker to create on first `up` (the container runs with dropped capabilities and cannot generate into a directory it does not own).

Rotate credentials by replacing (or deleting) `nginx/staff/staff.htpasswd`, then recreating the container: `docker compose -f docker-compose.production.yml up -d --force-recreate web`.

### Manual alternative: operator-provided htpasswd

Prefer managing the file yourself? Place an htpasswd file in the store directory before starting — an operator-provided file always wins over the bootstrap environment:

```bash
mkdir -p nginx/staff
htpasswd -cB nginx/staff/staff.htpasswd <username>   # -c creates the file; -B selects bcrypt
```

Add another account (appends; omit `-c`):

```bash
htpasswd -B nginx/staff/staff.htpasswd <username>
```

Remove an account by deleting its line, then recreate the container — the entrypoint copies the store file into place at boot, so account changes take effect on recreation rather than per request.

Passwords travel only over TLS: the protection lives on the 443 server and port 80 redirects to HTTPS. Repeated attempts are rate-limited by nginx to 5 requests/minute per IP after a 10-request burst.

## Quick start

Requirements: Node.js 18+ and npm 9+.

```bash
npm ci
npm run lint
npm run build
```

For a production-style container build:

```bash
docker build -f Dockerfile.production -t u1/ems-guardian:local .
```

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) and [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) before any deployment.

## Demo build

`npm run build:demo` produces an installable PWA demo of the field app for demos and field trials of the UX. It is a separate build flag, not a deployment tier:

```bash
npm run build:demo
npm run preview   # serve dist/ locally, or host dist/ on any static server
```

What `VITE_DEMO_MODE=true` changes (production builds — plain `npm run build` — are unaffected):

- No production init: the auth/audit/security initialization path (`src/lib/productionInit.ts`) is skipped, so the app opens straight into the field UI with no sign-in step.
- A non-dismissible **Demo · Sample Data** badge marks every screen, including AR HUD.
- Seeded sample dispatch data populates the comms panel on first open — no live dispatch, no real PHI.
- PWA plumbing is injected into `index.html`: the web manifest (`public/manifest.webmanifest`, standalone display, `#070B12` theme) and registration of `public/sw.js`, which cache-first serves the app shell and runtime-caches MediaPipe model files and map tiles so the ASL translator and maps keep working offline after first load. Install it from the browser's install prompt over HTTPS.

**Key-exposure note:** like every build of this app, the demo bundle bakes `GEMINI_API_KEY` (and any ElevenLabs key) into the client JavaScript at build time. Anyone loading a public demo URL can extract those keys with browser devtools. Before hosting a public demo, create provider-side keys with spend caps and budget alerts — the static demo cannot rate-limit them server-side. Production deployments are equally client-baked; keys are supplied at build time via the environment, never committed.

## Production gates

A deployment is not considered production-approved merely because the application builds.

Required before real-world use:

1. CI build/type-check passes from a clean checkout.
2. Dependency/security review is complete.
3. Secrets are supplied through the deployment platform, never committed.
4. Threat model and incident-response contacts are assigned.
5. Privacy/data-retention behavior is verified against the actual deployment.
6. Clinical/emergency claims are reviewed by qualified domain owners.
7. External integrations are authenticated and least-privilege.
8. Accessibility testing includes keyboard, screen reader, contrast, zoom, and real user testing.
9. Rollback and backup procedures are tested.
10. Any regulatory/compliance claim is supported by independent evidence.

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).

## Repository map

- `src/` — application code
- `public/` — static marketing pages (hub, Argus Responder, AccessGuard) copied verbatim into `dist/`
- `Dockerfile.production` — production container definition
- `docker-compose.production.yml` — local/hosted production-style composition
- `nginx.conf` — reverse-proxy configuration
- `env.example.production` — environment variable template
- `verify-production.sh` — repository verification helper
- `DEPLOYMENT_GUIDE.md` — deployment notes
- `SECURITY_POLICY.md` / `SECURITY.md` — security guidance

## Accessibility

Accessibility is a first-class product requirement. Features and claims should be verified against the shipped interface rather than assumed from component intent. Automated checks are useful, but manual assistive-technology testing remains required.

## Evidence and claims

This repository distinguishes **implemented controls** from **external certification**. A configured encryption library, security header, or audit logger does not by itself establish HIPAA compliance, medical-device status, clinical validation, or endorsement by any healthcare organization.

## License / use

Review repository licensing and organizational policy before redistribution or operational deployment.

---

**Unmute1AI**  
Accessibility First. Authority by Design.
