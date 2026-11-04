# Security Policy

## Supported Versions

Only the latest minor release line and its immediate predecessor receive security patches and vulnerability assessments. Older versions are end-of-life (EOL) and will not receive updates.

| Version | Supported          |
| :------ | :----------------: |
| 0.5.x   | :white_check_mark: |
| 0.4.x   | :white_check_mark: |
| < 0.4   | :x:                |

## Response SLA

The `@kidthales/picotol` maintenance team is committed to prompt vulnerability handling under the following Service Level Agreement (SLA):

- **Initial Acknowledgment**: Within **48 hours** of receiving a report.
- **Triage & Severity Assessment**: Within **5 business days**, including CVSS / CWE classification and confirmation of reproducibility.
- **Target Resolution Timeline**:
  - **Critical & High Severity**: Coordinated fix and patch release within **14 calendar days**.
  - **Medium & Low Severity**: Remediated in the next scheduled minor/patch release cycle (within **30 calendar days**).

## Scope

### In Scope
- CSS injection vulnerabilities or selector-based exfiltration originating from `@kidthales/picotol` stylesheets or token definitions.
- Tampering or integrity discrepancies in published distribution bundles and cryptographic manifests (`dist/sri.json`, `dist/manifest.json`).
- Build toolchain vulnerabilities in `tools/*.mjs` that could inject malicious code into distribution artifacts.
- Token generation leaks or unescaped CSS custom properties in runtime theming engines.
- Insecure defaults or CSP violations in demo and documentation assets.

### Out of Scope
- Vulnerabilities in downstream consumer applications, host styling frameworks, or third-party web services using `@kidthales/picotol`.
- Native browser rendering bugs or operating system accessibility quirks outside CSS specification boundaries.
- Denial of service attacks targeting public package distribution infrastructure (npm registry, unpkg, jsdelivr, GitHub Packages).
- Attacks requiring physical access to developer machines or social engineering.

## Reporting a Vulnerability

### Preferred Channel: GitHub Private Vulnerability Reporting
Please report security vulnerabilities privately via GitHub Security Advisories:
👉 **[Report a vulnerability via GitHub Advisory](https://github.com/kidthales/picotol/security/advisories/new)**

Do **not** open public GitHub issues or discussions for undisclosed security vulnerabilities.

### Fallback Contact
If you cannot use GitHub Security Advisories or need to reach maintainers directly, email our security contact:
- **Email**: [security@agogpixel.com](mailto:security@agogpixel.com)
- **Secondary / Administrative**: [admin@agogpixel.com](mailto:admin@agogpixel.com)

Please include:
1. A clear description of the vulnerability and potential impact.
2. Step-by-step instructions or minimal proof-of-concept markup to reproduce the issue.
3. Affected versions of `@kidthales/picotol`.
4. Any potential mitigations or remediation patches you have identified.

### Coordinated Disclosure
We practice coordinated vulnerability disclosure. We ask reporters to allow us up to 90 days or until a patch release is published before publicly disclosing vulnerability details. We will credit reporters in our release notes and GitHub Advisories unless anonymity is requested.
