# Historical records

## Purpose

This repository retains selected design references, QA records, and release-verification notes because they provide useful context for maintainers. They are **historical evidence**, not a replacement for the current implementation, README, or operating procedures.

For current behavior, use the [README](../README.md), [architecture guide](ARCHITECTURE.md), [development guide](DEVELOPMENT.md), [operations guide](OPERATIONS.md), and [production-readiness runbook](PRODUCTION_READINESS.md).

## Interpretation rules

| Record type | How to use it |
|---|---|
| Product requirements | Understand the original business scope; confirm present behavior in source code and current guides. |
| Design references | Understand visual/design decisions; do not treat them as current UI specifications without reviewing the live application. |
| QA and browser-verification records | Review past regression coverage and context; rerun the maintained automated suite for current release evidence. |
| Deployment and ship-readiness notes | Review historical release context only; use the operations guide for the active Vercel release path and migration procedure. |

## Retained records

| Area | Record | Description |
|---|---|---|
| Product scope | [`product/PRD_v2.0.md`](product/PRD_v2.0.md) | Original consolidated product-requirements document. |
| Landing-page design | [`history/design/`](history/design/) | Reference analysis, implementation model, and visual theme notes. |
| QA and delivery | [`history/verification/`](history/verification/) | Historical functional, browser, responsiveness, and ship-readiness records. |
| Planning | [`history/planning/`](history/planning/) | Retained development task notes where relevant to project history. |

## Maintainer guidance

When a historical document contradicts code, deployment configuration, or the maintained guides, treat the current implementation and maintained guides as authoritative. Update or add a dated historical record only when it provides a durable explanation of a significant design, release, or incident decision.
