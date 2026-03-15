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
- **Code review**: All changes go through pull request review before merging (enforced via branch protection rules)
