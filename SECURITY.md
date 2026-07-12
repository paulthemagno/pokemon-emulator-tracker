# Security Policy

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue.

Use GitHub's private vulnerability reporting for this repository instead:

1. Open the repository's **Security** tab.
2. Select **Advisories**.
3. Choose **Report a vulnerability**.

Include the affected area, reproduction steps, expected impact, and any safe
proof of concept that can help validate the report.

## Secrets and save files

Never commit API keys, `.env.local`, emulator save files, memory snapshots, or
Vercel project metadata. The repository ignore rules cover the standard local
paths and supported save extensions, but contributors should still review each
commit before pushing it.
