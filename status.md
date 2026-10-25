# Oda Agent Kit Status

## Current Priority: October MCP Bugs

1. Implemented orders fix using the meal-planning window's verified 2026-10-25 response shapes: flattened month groups, date-cursor pagination, and string `order_number` detail lookups. Synthetic fixtures and full workspace tests/build/lint pass (existing version.ts warnings only). Live requests have not been repeated from this window.
2. Standardized the published MCP parameters on snake_case: product tools and add/remove use `product_id`; order details use string `order_number`. Clean break from camelCase inputs; core TypeScript method names remain unchanged. Protocol coverage checks all tool parameter names.
3. Implemented top-level `warnings` for unavailable `oda_add_to_cart` products, including the availability reason when present. Adds remain allowed; available items return `warnings: []`. Nested cart availability now informs normalized product availability too. Fixture/protocol tests cover this without live cart mutations.
4. Commit and push each fix separately to `origin` (`twilsher/oda-agent-kit`), in the order above. Keep Oda business logic in core and adapters thin.

The source report is `BUG-MCP-PARAM-INCONSISTENCY.md`. Checkout, payment, and final order placement remain out of scope.

## Upstream Integration

Merged upstream into our fork in `5625537`, adopting package version `0.6.12`, OpenClaw maintenance, and global-fetch support while retaining our mixed-search, cart, and delivery-slot fixes. Push to `origin`; do not push to `upstream`. Runtime behavior after that merge has not been revalidated during the October handoff.

## 2026-05-25
- Implemented MCP cart/delivery mutation gaps: `oda_remove_from_cart`, `oda_set_delivery_slot`, and `oda_add_to_cart` with `quantity: 0` as remove-by-product alias.
- Removal uses Oda's cart quantity update primitive: `POST /api/v1/cart/items/?group_by=recipes` with `quantity: 0`; cart-line removal resolves `cart.items[].id` to product ID first.
- Delivery-slot setting uses Oda's slot-picker flow: `POST /api/v1/slot-picker/info/` with `deliverySlotId` and `inModal: false`.
- Verified core and MCP tests/builds; MCP lint still reports the pre-existing `src/version.ts` unused eslint-disable warning only.
- Final order placement and payment remain blocked for v0.

## 2026-05-29
- Fixed stale delivery-slot responses by making `getDeliverySlots()` compute the Europe/Oslo current date on every call and include `date=<YYYY-MM-DD>` plus a timestamp cache-buster in `/slot-picker/slots/` requests.
- Delivery-slot GETs now send no-cache request headers.
- Rebuilt core and MCP packages; terminated stale running MCP server processes so reconnect starts the new code.

## 2026-06-06
- Fixed current Oda slot-picker response parsing: live payload now uses `delivery_slots` plus snake_case slot fields (`open_datetime`, `close_datetime`, `is_full`, `is_unavailable`).
- Added sanitized fixture coverage for the snake_case slot-picker payload.
- Live check parsed 47 slots successfully; Jun 7 slots were present but unavailable due cart product availability constraints, with available slots starting Jun 8.
- Fixed cart removal for product-list sourced rows: removal now reads the raw cart and posts negative quantity deltas to `/cart/items/?group_by=recipes`, including `from_list_id` where Oda reports list provenance.
- Re-registered `oda_remove_from_cart` with a raw Zod shape and tightened schema coverage so `confirmed`, `product_id`, and `cart_line_id` remain visible to MCP clients.
