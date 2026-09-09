# Production Readiness

**Current classification: Production candidate / verification required.**

## Automated gates
- [ ] Clean install succeeds with `npm ci`
- [ ] Type/lint gate passes
- [ ] Production build passes
- [ ] High-severity production dependency audit passes
- [ ] Container build is reproducible

## Operational gates
- [ ] Environment/secrets supplied outside source control
- [ ] Logging excludes PHI/secrets by default
- [ ] Backup and rollback tested
- [ ] Monitoring/alert ownership assigned
- [ ] Dependency update process assigned
- [ ] Incident-response path tested

## Domain gates
- [ ] Medical director / clinical owner reviews clinical workflow claims
- [ ] Emergency-services authority reviews any official-alert/dispatch integration
- [ ] Privacy counsel reviews actual data flows and retention
- [ ] Accessibility evaluation includes manual assistive-technology testing
- [ ] Compliance claims are supported by independent evidence

## Explicit non-claims
This repository does not, by itself, prove HIPAA compliance, FDA clearance, Mayo Clinic endorsement, clinical efficacy, or authorization to operate inside a live emergency-response system.
