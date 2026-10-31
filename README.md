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

### Creating the credentials file

Credentials are operator-provided and never committed: the file is git-ignored and mounted read-only into the container.

```bash
mkdir -p nginx
htpasswd -cB nginx/staff.htpasswd <username>   # -c creates the file; -B selects bcrypt
```

Add another account (appends; omit `-c`):

```bash
htpasswd -B nginx/staff.htpasswd <username>
```

Remove an account by deleting its line from `nginx/staff.htpasswd`. nginx reads the file per request, so account changes take effect on the next request without a reload. If the file did not exist when the container started, Docker binds a placeholder directory at that path instead — remove it (`rmdir nginx/staff.htpasswd`), generate the file, then recreate the container (`docker compose -f docker-compose.production.yml up -d --force-recreate web`).

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
