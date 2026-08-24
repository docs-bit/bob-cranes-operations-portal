## Summary

Explain the operational reason for this change and the user or department outcome it supports.

## Scope

| Area | Changed? | Notes |
|---|---:|---|
| Public rental journey | [ ] | |
| Portal route or workspace | [ ] | |
| API, authorization, or validation | [ ] | |
| Database schema or migration | [ ] | |
| Deployment or environment configuration | [ ] | |
| Documentation or screenshots | [ ] | |

## Validation

Mark the checks completed for this change.

- [ ] `pnpm run check`
- [ ] `pnpm test`
- [ ] `pnpm run build`
- [ ] `pnpm run test:e2e`, when routes or user flows changed
- [ ] Manual verification of the affected role, department, or public flow

## Database and security review

- [ ] This change does not require a database migration.
- [ ] If a migration is included, the schema and generated migration artifacts were reviewed together.
- [ ] No credential, database dump, customer data, or other confidential material is included.
- [ ] Server-side authorization remains enforced for protected behavior.

## Documentation and rollout

- [ ] README or the relevant `docs/` guide was updated when behavior, routes, commands, variables, or operations changed.
- [ ] Release, migration, rollback, or monitoring implications are documented when applicable.

## Additional context

Provide redacted screenshots, relevant issue links, or reviewer notes. Do not include secrets or personal data.
