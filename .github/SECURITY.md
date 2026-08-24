# Security policy

## Supported deployment line

Security fixes are applied to the current `main` branch and the Vercel production deployment built from it. Do not rely on historical commits or archived Railway application deployments for fixes.

## Reporting a vulnerability

Please **do not open a public GitHub issue** for a suspected vulnerability, exposed credential, authorization bypass, or data-access concern. Instead, contact the BOB Cranes application owner through the organisation’s established private support channel and include:

- A concise description of the issue and its potential impact.
- Clear, non-destructive steps to reproduce it.
- The affected route, feature, or commit when known.
- Any relevant screenshots or request/response details with secrets and personal data removed.

The team will acknowledge a credible report, investigate it, and coordinate remediation privately. Do not attempt to access data that does not belong to you or to disrupt the live service while testing.

## Operational safeguards

The repository intentionally excludes credentials and production database connection strings. Production secrets are stored only in protected deployment-provider settings. Database migrations must be reviewed, backed up, and applied deliberately before the related application release.
