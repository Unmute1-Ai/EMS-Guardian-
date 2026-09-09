# EMS Guardian

**Edge-first communication and field-assistance software for emergency-services workflows.**

EMS Guardian combines an accessible field interface, translation/ASL support, structured handoff tooling, and AI-assisted workflow components. The repository includes a Vite/React application, production container configuration, environment templates, deployment guidance, and verification scripts.

> **Status: production candidate, not a certified medical device and not independently certified for HIPAA or clinical compliance.** Any real-world emergency or healthcare deployment requires security review, medical-direction approval, jurisdiction-specific validation, privacy review, and authenticated integrations.

## What it includes

- **Field interface** for structured incident and patient-workflow support.
- **Accessible communication** concepts including ASL and multilingual interaction.
- **Structured handoff/reporting** flows.
- **AI-assisted components** behind explicit configuration boundaries.
- **Deployment assets**: production Dockerfile, Docker Compose, Nginx config, environment templates.
- **Security controls in code/configuration** including authentication, rate limiting, audit-oriented utilities, and secure-header configuration.

## Safety boundary

EMS Guardian must not be treated as an autonomous clinical authority. AI output is advisory. The application must not represent generated content as an official emergency directive, medical order, diagnosis, or authenticated dispatch message unless the relevant external authority integration has been separately implemented and verified.

Do not place real PHI, credentials, secrets, or production API keys in the repository.

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
