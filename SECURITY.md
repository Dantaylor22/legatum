# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅ Yes    |
| Older   | ❌ No     |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email: security@digitalrelative.co.uk

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix

We will acknowledge within 48 hours and aim to resolve critical issues within 7 days.

We do not currently offer a bug bounty programme but will publicly acknowledge responsible disclosures with your permission.

## Security measures

- AES-256-GCM client-side encryption (keys never leave your device)
- PBKDF2 key derivation (310,000 iterations, OWASP 2023)
- MFA enforced for all email/password accounts
- Row-level security on all database tables
- All data stored in EU (Ireland)
- GDPR compliant — right to export and erasure built in
- Automated dependency scanning via GitHub Actions
- Security headers: CSP, HSTS, X-Frame-Options, etc.
