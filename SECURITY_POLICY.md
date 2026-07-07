# Security Policy & Standards

## Overview

This document outlines the security policies and standards for EMS Guardian medical application.

## 1. Data Protection Standards

### Classification Levels
- **Level 1 (Public)**: General information, marketing materials
- **Level 2 (Internal)**: Internal policies, general operational data
- **Level 3 (Confidential)**: Clinical protocols, operational procedures
- **Level 4 (Restricted - PHI)**: Patient health information, identifiers

### Handling Requirements by Level
| Level | Encryption | Access Control | Audit Log | Retention |
|-------|-----------|-----------------|-----------|-----------|
| 1 | No | Minimal | No | 1 year |
| 2 | Optional | Standard | Basic | 3 years |
| 3 | Required | Strict | Full | 5 years |
| 4 | Required | Strict | Full | 7 years |

## 2. Access Control Policy

### Role Definitions
- **Paramedic**: Field operations, read own records, cannot modify patient data
- **Supervisor**: Access paramedic records, limited administrative functions
- **Administrator**: Full system access (subject to 2-person rule for sensitive operations)
- **Auditor**: Read-only access to audit logs and compliance reports
- **Medical Director**: Clinical protocol approval, clinical decision oversight

### 2-Person Rule
Critical operations require two authorized personnel:
- Deleting patient records
- Modifying clinical protocols
- Accessing other user's sessions
- System configuration changes
- Encryption key rotation

## 3. Password & Authentication Policy

### Password Requirements
- Minimum length: 12 characters
- Must include: UPPERCASE, lowercase, numbers, special characters
- No dictionary words or predictable patterns
- Expiration: Every 90 days
- History: Cannot reuse last 5 passwords

### Multi-Factor Authentication
- **Required for**: All administrators and supervisors
- **Recommended for**: Paramedics (depends on deployment)
- **Methods accepted**: TOTP, Hardware security keys, SMS (backup only)
- **Backup codes**: Generate and store securely

## 4. Network Security

### TLS/SSL Requirements
- Minimum: TLS 1.3
- Certificates: Wildcard or EV (Extended Validation)
- Renewal: Every 90 days (use Let's Encrypt or DigiCert)

### Firewall Rules
```
INBOUND:
- Port 443 (HTTPS): Allowed from anywhere
- Port 80 (HTTP): Redirect to HTTPS only
- SSH (22): Restricted to admin IPs only

OUTBOUND:
- Port 443: Required (API calls, updates)
- Port 53: DNS only
- Restrict all others by default
```

### VPN/Secure Access
- Paramedics in field: VPN mandatory for sensitive operations
- Office staff: VPN required for off-site access
- Encrypted channels: All mobile-to-server communication

## 5. Application Security

### OWASP Top 10 Mitigation
1. **SQL Injection**: Use parameterized queries, ORM
2. **Authentication**: MFA, secure session management
3. **Sensitive Data**: Encryption at rest and in transit
4. **XML External Entities (XXE)**: Disable XML parsing features
5. **Broken Access Control**: Implement RBAC, principle of least privilege
6. **Security Misconfiguration**: Security headers, remove defaults
7. **XSS (Cross-Site Scripting)**: Input validation, CSP headers
8. **CSRF (Cross-Site Request Forgery)**: CSRF tokens, SameSite cookies
9. **Using Known Vulnerable Components**: Regular dependency updates
10. **Insufficient Logging**: Comprehensive audit logging

### Security Headers
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## 6. Incident Response Plan

### Response Timeline
- **0-1 hour**: Detect and contain
- **1-4 hours**: Investigate and assess
- **4-24 hours**: Remediate and notify
- **24-60 days**: Complete notification (per HIPAA)

### Escalation Path
1. **Level 1**: Security team handles, ongoing monitoring
2. **Level 2**: CISO + CTO + Legal involved
3. **Level 3**: Executive + Law Enforcement + Regulatory notification
4. **Level 4**: Public notification, media engagement

## 7. Encryption Standards

### Algorithm Selection
- **Data at Rest**: AES-256-GCM (Galois/Counter Mode)
- **Data in Transit**: TLS 1.3 (already in transit)
- **Hashing**: SHA-256 (for integrity), bcrypt (for passwords)
- **Key Derivation**: PBKDF2 with 100,000 iterations minimum

### Key Management
- Generate keys with cryptographically secure random number generator
- Store keys in secure key management service (AWS KMS, Vault)
- Never store keys in code or version control
- Rotate keys every 90 days
- Maintain key audit log

## 8. Data Retention & Disposal

### Retention Policy
- Active patient records: Retain for legal hold duration
- Audit logs: 6+ years (per HIPAA minimum)
- Backups: Daily (7 days), Weekly (4 weeks), Monthly (12 months)
- Training/test data: Delete within 30 days of test completion

### Secure Deletion
- Use cryptographic erasure (destroy encryption keys)
- Or use 7-pass DOD wiping standard for sensitive data
- Document and audit all deletions
- Certificate of destruction for decommissioned hardware

## 9. Compliance Verification

### Regular Audits
- **Monthly**: Automated security scans
- **Quarterly**: Manual penetration testing
- **Annually**: Third-party security audit
- **Post-Incident**: Forensic analysis

### Compliance Certifications
- HIPAA Business Associate Agreement (BAA) signed
- SOC 2 Type II (recommended)
- ISO 27001 (recommended for large deployments)

## 10. Staff Training & Awareness

### Annual Requirements
- HIPAA Privacy & Security training: 1-2 hours
- Data handling procedures: 1 hour
- Password/MFA security: 30 minutes
- Incident reporting procedures: 30 minutes
- Phishing simulation exercises: Quarterly

### New Hire Onboarding
- Security training before system access
- Role-specific security briefing
- Acceptable use policy signed
- Emergency contact list provided

---

**Policy Version**: 1.0.0
**Effective Date**: 2026-07-07
**Next Review**: 2027-07-07
**Owner**: Chief Information Security Officer
