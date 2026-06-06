# Oda Agent Kit Status

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
