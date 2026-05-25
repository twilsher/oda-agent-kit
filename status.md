# Oda Agent Kit Status

## 2026-05-25
- Implemented MCP cart/delivery mutation gaps: `oda_remove_from_cart`, `oda_set_delivery_slot`, and `oda_add_to_cart` with `quantity: 0` as remove-by-product alias.
- Removal uses Oda's cart quantity update primitive: `POST /api/v1/cart/items/?group_by=recipes` with `quantity: 0`; cart-line removal resolves `cart.items[].id` to product ID first.
- Delivery-slot setting uses Oda's slot-picker flow: `POST /api/v1/slot-picker/info/` with `deliverySlotId` and `inModal: false`.
- Verified core and MCP tests/builds; MCP lint still reports the pre-existing `src/version.ts` unused eslint-disable warning only.
- Final order placement and payment remain blocked for v0.
