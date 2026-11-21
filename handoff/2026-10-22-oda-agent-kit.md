# Oda Agent Kit Handoff - 2026-10-22

## Goal and Pending Work

Complete the three fixes in `BUG-MCP-PARAM-INCONSISTENCY.md`; priority and acceptance criteria are in `status.md`: orders parser, snake_case MCP parameters, then visible unavailable-item warnings. Commit and push each fix separately to the user's fork. No implementation, live API inspection, or tests for these fixes have occurred in this session.

## Verified Checkout State

1. Branch `main`, HEAD `5625537` (upstream merge); local `origin/main` points to the same commit. Remotes were not fetched for this handoff.
2. Before handoff edits, the only worktree change was untracked `BUG-MCP-PARAM-INCONSISTENCY.md`; preserve it. This handoff and the `status.md` update are also uncommitted.
3. Existing `handoff/2026-05-25.md` and all memory are preserved. No process was stopped or restarted.

## Exact Resume Commands

```bash
cd /Users/twilsher/dev/oda-agent-kit
git status --short --branch
git remote -v
git log -6 --oneline --decorate
sed -n '1,180p' status.md
sed -n '1,220p' BUG-MCP-PARAM-INCONSISTENCY.md
sed -n '90,125p' packages/core/src/schemas.ts
sed -n '390,410p' packages/core/src/client.ts
sed -n '140,285p' packages/mcp-server/src/server.ts
rg -n 'orders|availability|productId|orderId' packages/core/src/__tests__ packages/mcp-server/src/__tests__ docs/tool-contracts.md
npm test --workspace @oda-agent/core -- --runInBand
npm test --workspace @oda-agent/mcp-server -- --runInBand
npm run build
npm run lint
```

After each independently verified fix, stage only its files, commit with a descriptive message, then run `git push origin main`. Recheck branch/remotes before pushing. Resume with the orders investigation before changing schemas.

## Investigation Details and Risks

1. `getOrders()` currently validates `/orders/?page=1` with `createOdaPageSchema(OdaOrderSchema)`; `getOrder()` shares the order schema. Capture the actual read-only response before deciding mappings; do not invent missing values or silently discard orders.
2. Credentials are injected by `~/.local/bin/oda-mcp-server` from local secret storage; absence of shell environment credentials is expected. Prefer registered Oda MCP raw GET access; the user also requested curl inspection with a stored session. Never print credentials, cookies, or personal order/address data, or commit raw authenticated captures. Live access has not been verified here.
3. MCP raw paths are relative to the existing API base: `/orders/`, not `/api/v1/orders/`. Current MCP camelCase fields include product tools/add (`productId`) and order details (`orderId`); audit the entire published surface.
4. Unavailable-item warning should be top-level and tested without mutating a live cart. Current cart normalization handles nested availability; check it remains accurate when forming warnings.
5. Native fetch changed in the upstream merge; inspect cookie handling if authenticated inspection fails. Historical multiple MCP processes do not prove stale code; identify ownership before any restart. No current process count was checked.
6. Historical full workspace tests/build/lint passed at the June merge, with existing CLI/MCP `version.ts` lint warnings. Those results are not evidence that the pending October fixes work.
