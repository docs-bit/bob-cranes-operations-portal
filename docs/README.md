# Documentation index

This directory contains the maintained technical and operational documentation for the BOB Cranes Operations Portal. Start with the root [README](../README.md) for a product overview and repository entry point.

| Guide | Purpose |
|---|---|
| [Architecture guide](ARCHITECTURE.md) | Canonical, maintained source for client, API, data, authentication, route, and deployment boundaries. |
| [Architecture Guide PDF](reference/BOB_Cranes_Architecture_Guide.pdf) | Formatted companion reference for the architecture guide; the Markdown guide remains authoritative. |
| [Development guide](DEVELOPMENT.md) | Local environment setup, database workflow, testing, and implementation conventions. |
| [Running locally](RUNNING_LOCALLY.md) | Step-by-step clone, install, environment, database, first-admin, verification, and troubleshooting guide. |
| [Operations guide](OPERATIONS.md) | Vercel release path, production migrations, verification, rollback, monitoring, and ownership. |
| [Production-readiness runbook](PRODUCTION_READINESS.md) | Detailed release controls and operational safeguards. |
| [Historical records](HISTORY.md) | Index and interpretation rules for retained QA, planning, design, and verification material. |
| [Product requirements](product/PRD_v2.0.md) | Retained consolidated product-requirements reference. |

## Documentation maintenance

The README and the maintained guides must be updated when a route, command, environment variable, access boundary, database workflow, or deployment topology changes. When past QA or design material is retained, place it under `docs/history/` and label it as historical context rather than current operating procedure.

For security reporting, use the repository [security policy](../.github/SECURITY.md). For change and pull-request expectations, use the [contribution guide](../CONTRIBUTING.md).
