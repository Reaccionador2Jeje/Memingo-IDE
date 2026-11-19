# AtDev Billing — Hybrid plans (Memingo IDE)

**Status:** proposal only. The desktop editor and basic local editing workflow remain free.

## Hybrid model

Do not lock opening, editing, saving, syntax highlighting, local projects, or ordinary local Git workflows behind a subscription. Optional paid services may include AtDev-hosted collaboration, cloud workspace sync, hosted agent execution, or managed integrations when those services exist.

## Proposed plans (CLP/month; exploratory)

| Plan | Reference price | Scope |
| --- | ---: | --- |
| IDE Community | $0 | Core editor and local development |
| IDE Plus | $990 | Optional cloud sync and expanded workspace conveniences, when implemented |
| IDE Developer | $1,990 | Hosted collaboration and hosted agent allowance, when implemented |

Prices are placeholders. Do not display or sell benefits that have not shipped.

## Suggested entitlements

- `ide.cloud_sync.enabled`
- `ide.cloud_workspaces.max`
- `ide.collaboration.seats`
- `ide.hosted_agent.requests.monthly`

Local editing must remain functional offline and when Billing is unavailable. Hosted agent usage needs server-side quotas and cost controls. Never send workspace files to hosted services without clear user consent.

## Launch gates

Document data collection, workspace encryption, export/deletion, service availability, and hosted-agent limits. Keep checkout disabled until services exist and an adult account owner has reviewed payment-provider eligibility and legal/tax obligations.
