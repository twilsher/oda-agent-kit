# Bug: inconsistent parameter naming in Oda MCP

Reported from meal-planning window on 2026-10-11.

## The inconsistency

- `oda_add_to_cart` requires `productId` (camelCase)
- `oda_remove_from_cart` requires `product_id` (snake_case)

Both tools operate on the same entity. The inconsistency causes failed calls when switching between the two in the same workflow — hit today when swapping an out-of-stock chicken product. The remove call failed with "Provide exactly one of cart_line_id or product_id" when passing `productId`, then had to re-send with `product_id`.

Same inconsistency likely applies to any other add/remove-type tool pairs.

## Fix

Standardize on one case convention across the whole Oda MCP tool surface. `snake_case` matches:

- The rest of the MCP ecosystem (most servers use snake_case)
- The Oda API response shapes: `is_available`, `cart.items[].product.id`, `front_url`, etc.

So snake_case is probably the right pick. Either direction is fine as long as it's consistent.

## Secondary issue — silent add of unavailable items

`add_to_cart` success response includes `product.availability.is_available: false` with `code: "sold_out_supplier"` for items that are "Utsolgt fra leverandør", but the add still succeeds silently.

Would be more useful if the add either:

1. Refuses to add the item when `is_available: false`, or
2. Returns a visible warning in the response envelope (not just inside `product.availability`) so callers don't have to post-check every add

Hit this today: `oda_add_to_cart` for product 66896 (Ytterøy Lårbiff av kylling naturell) returned success, but `product.availability.is_available: false`. The item IS in the cart now, but will be removed on delivery day. Users will only discover this at delivery time without a post-check.

## Third issue — `oda_get_orders` returns "Invalid Oda API response"

Reported 2026-10-11.

`oda_get_orders` fails on both `{}` and `{"page": 1}` with:

```
Invalid Oda API response for /orders/?page=1
```

Response envelope is being rejected by the MCP's schema validation. The underlying endpoint `/orders/` presumably works (the Oda web app shows the order list) but the MCP can't parse it.

Hit when a user wanted to inspect a recently-placed order to verify what went through.

Fix: look at what shape `/orders/` actually returns, loosen the schema or map the fields the MCP expects. Possibly a shape change on Oda's side since the MCP was written.
