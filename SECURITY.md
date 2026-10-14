# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly through GitHub's **Private vulnerability reporting** feature:

1. Navigate to the [Security tab](../../security) of this repository
2. Click **"Report a vulnerability"**
3. Fill in the details of the vulnerability

**Please do NOT open a public issue for security vulnerabilities.**

We will acknowledge your report within 72 hours and aim to provide a fix or mitigation plan within 7 days for critical issues.

## Security Practices

This project follows these security practices:

- **Dependency management**: Automated dependency updates via Dependabot with weekly checks for npm packages and GitHub Actions
- **CI/CD hardening**: All GitHub Actions use SHA-pinned versions with minimal permissions (`contents: read`). [StepSecurity Harden Runner](https://github.com/step-security/harden-runner) monitors network egress in CI workflows
- **Security scoring**: [OpenSSF Scorecard](https://securityscorecards.dev/) runs weekly to evaluate and track the project's security posture
- **Verification**: CI runs dependency audit gates, security regression tests, type checks for web and bot code, Docker production builds, and Git history secret scans
- **Code review**: Pull request review is recommended. The 2026-10-14 audit found that `main` branch protection and repository secret scanning/push protection were not enabled; these account settings require separate configuration
- **Audit exception**: The unpatched GHSA-vfj7-8cjw-p6xm advisory in development-only `braces@3.0.3` is allowed only until 2026-11-14. No production dependency advisory is exempted. The gate rejects other/new advisories and expired exceptions
- **Overrides**: `postcss`, `deepmerge-ts`, `@xmldom/xmldom`, and `katex` use patched versions; `puppeteer-core` 25 removes the vulnerable `extract-zip` browser-installation dependency. Prisma remains on its patched 6.x line because 7.x changes the client/driver/configuration architecture; TypeScript is on 6.x because the lint parser does not yet support 7.x; ESLint is on 9.x because Next's React/import/accessibility plugins do not yet declare ESLint 10 support
