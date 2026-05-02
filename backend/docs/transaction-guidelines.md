# Transaction Guidelines

- Do preflight reads and validation outside interactive transactions whenever possible.
- Keep one short transaction for core invariants such as the primary record, ownership, and critical foreign keys.
- Use a second transaction for secondary provisioning such as entitlements, subscriptions, or derived records.
- Prefer bulk inserts for bootstrap paths instead of sequential `upsert` loops.
- If phase 2 fails after phase 1 commits, run explicit compensation instead of stretching the original transaction.
- Keep elevated Prisma transaction timeouts as a guardrail, not as the primary mitigation for slow write paths.
