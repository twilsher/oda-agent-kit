# Tool Contracts

Tools are grouped by risk level (see [Safety Model](safety-model.md)).

---

## Read-only tools (Level 0)

These tools never modify state and require no confirmation.

### `oda_search_products`

Input:

```json
{
  "query": "milk",
  "limit": 10
}
```

Output:

```json
{
  "products": [
    {
      "id": "string",
      "name": "string",
      "brand": "string | null",
      "price": {
        "amount": 0,
        "currency": "NOK"
      },
      "availability": "available | unavailable | unknown",
      "images": [
        {
          "url": "string",
          "kind": "thumbnail | large | unknown"
        }
      ]
    }
  ]
}
```

### `oda_get_orders`

Input:

```json
{
  "limit": 10
}
```

Output:

```json
{
  "orders": [
    {
      "id": "string",
      "createdAt": "ISO datetime",
      "deliveredAt": "ISO datetime | null",
      "total": {
        "amount": 0,
        "currency": "NOK"
      }
    }
  ]
}
```

### `oda_get_cart`

Input:

```json
{}
```

Output:

```json
{
  "id": 123,
  "items": [
    {
      "id": 456,
      "product": {
        "id": 789,
        "full_name": "string",
        "name": "string",
        "brand": "string | null",
        "gross_price": "string",
        "currency": "NOK",
        "is_available": true
      },
      "quantity": 2,
      "line_price": "string",
      "original_line_price": "string | null",
      "unit_price": "string",
      "label": "string | null"
    }
  ],
  "label": "string | null",
  "display_price": "string | null",
  "subtotal_price": "string",
  "summary_lines": [
    {
      "label": "string",
      "price": "string",
      "kind": "item | discount | subtotal | fee | total | other",
      "details": "string | null"
    }
  ],
  "fee_lines": [
    {
      "label": "string",
      "price": "string",
      "kind": "fee",
      "details": "string | null"
    }
  ],
  "total_price": "string",
  "currency": "NOK",
  "item_count": 2
}
```

`line_price` is the effective user-facing line total, so discounted carts may have
`line_price` values that are lower than `original_line_price`. `label` and
`display_price` preserve Oda's top-level visible-item summary, `summary_lines`
preserves the detailed subtotal/discount/fee/total breakdown, `fee_lines`
contains just the non-item fee rows, and `total_price` remains the authoritative
final cart total returned by Oda.

### `oda_get_delivery_slots`

Input:

```json
{}
```

Output:

```json
{
  "slots": [
    {
      "id": 123,
      "start": "ISO datetime",
      "end": "ISO datetime",
      "price": "string",
      "currency": "NOK",
      "is_available": true
    }
  ]
}
```

### `oda_get_shopping_lists`

Input:

```json
{}
```

Output:

```json
[
  {
    "id": 123,
    "name": "string",
    "items": [
      {
        "product": {
          "id": 789,
          "full_name": "string",
          "name": "string",
          "brand": "string | null",
          "gross_price": "string",
          "currency": "NOK",
          "is_available": true
        },
        "quantity": 1
      }
    ]
  }
]
```

### `oda_get_household_staples`

Input:

```json
{
  "lookbackOrders": 20
}
```

Output:

```json
{
  "staples": [
    {
      "productId": "string",
      "name": "string",
      "averageQuantity": 1,
      "frequency": "weekly | biweekly | monthly | occasional",
      "confidence": 0.8,
      "reason": "Bought in 8 of last 10 orders"
    }
  ]
}
```

---

## Mutation tools (Level 1 — cart)

> **Current MCP status:** `oda_add_to_cart`, `oda_remove_from_cart`,
> `oda_add_shopping_list_to_cart`, and the raw fallback tool `oda_http_request`
> are implemented. The remaining typed mutation tools in this section are
> planned follow-ups.

Mutation tools require explicit user confirmation before execution.

Each mutation input includes `confirmed: true`, which must only be set after the
user has approved the specific change. Tools fail before touching Oda state when
`confirmed` is not true.

Allowed `status` values: `proposed`, `committed`.

### `oda_add_to_cart`

Input:

```json
{
  "productId": 123,
  "quantity": 2,
  "confirmed": true
}
```

`quantity: 0` is accepted as a remove-by-product alias and uses the same Oda
cart update endpoint as `oda_remove_from_cart`.

Output (proposed — not yet committed):

```json
{
  "status": "proposed",
  "item": {
    "productId": "string",
    "name": "string",
    "quantity": 2,
    "unitPrice": {
      "amount": 0,
      "currency": "NOK"
    }
  },
  "cartDelta": {
    "itemsAdded": 1,
    "newTotal": {
      "amount": 0,
      "currency": "NOK"
    }
  }
}
```

### `oda_remove_from_cart`

Input:

```json
{
  "product_id": 123,
  "confirmed": true
}
```

or:

```json
{
  "cart_line_id": 683630902,
  "confirmed": true
}
```

Exactly one of `product_id` or `cart_line_id` must be provided. Removal first
reads the cart, then sends negative quantity deltas for the current row. For
items sourced from a product list, the decrement preserves `from_list_id` so
Oda removes the list-sourced contribution rather than only agent-added quantity.

Oda endpoint shape:

```http
POST /api/v1/cart/items/?group_by=recipes
Content-Type: application/json
```

```json
{
  "items": [
    {
      "product_id": 25257,
      "quantity": -1,
      "from_list_id": 618123
    }
  ]
}
```

Output:

```json
{
  "status": "proposed",
  "removedItem": {
    "productId": "string",
    "name": "string",
    "quantity": 2
  },
  "cartDelta": {
    "itemsRemoved": 1,
    "newTotal": {
      "amount": 0,
      "currency": "NOK"
    }
  }
}
```

### `oda_update_quantity`

Input:

```json
{
  "productId": 123,
  "quantity": 3,
  "confirmed": true
}
```

Output:

```json
{
  "status": "proposed",
  "item": {
    "productId": "string",
    "name": "string",
    "previousQuantity": 1,
    "newQuantity": 3
  },
  "cartDelta": {
    "newTotal": {
      "amount": 0,
      "currency": "NOK"
    }
  }
}
```

### `oda_add_shopping_list_to_cart`

Input:

```json
{
  "shopping_list_id": 123,
  "confirmed": true
}
```

Output:

```json
{
  "status": "proposed",
  "listName": "string",
  "itemsAdded": [
    {
      "productId": "string",
      "name": "string",
      "quantity": 1
    }
  ],
  "cartDelta": {
    "itemsAdded": 5,
    "newTotal": {
      "amount": 0,
      "currency": "NOK"
    }
  }
}
```

### `oda_http_request`

Raw Oda API fallback for endpoints that are not yet covered by typed tools or
that have changed shape upstream. The tool authenticates with the stored Oda
session like the typed tools.

GET requests do not require confirmation. POST, PATCH, and DELETE require
`confirmed: true` and are annotated as destructive and non-idempotent. Raw
mutations for checkout, payment, and submitted-order endpoints are blocked for
v0.

Input:

```json
{
  "method": "GET | POST | PATCH | DELETE",
  "path": "/cart/items/",
  "body": {
    "items": [
      {
        "product_id": 123,
        "quantity": 2
      }
    ]
  },
  "query": {
    "group_by": "recipes"
  },
  "confirmed": true
}
```

Output:

```json
{
  "raw": "Oda JSON response, or null for 204/no JSON responses"
}
```

---

## Mutation tools (Level 2 — delivery slot)

> **Current MCP status:** `oda_set_delivery_slot` is implemented. Additional
> delivery-slot mutation tools are planned follow-ups.

These tools require stronger confirmation.  The confirmation message must include the date, time window, fee, and any reservation expiry information.

Allowed `status` values: `proposed`, `committed`.

### `oda_set_delivery_slot`

Input:

```json
{
  "slot_id": "123",
  "confirmed": true
}
```

Output:

```json
{
  "status": "proposed",
  "slot": {
    "id": "string",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "fee": {
      "amount": 0,
      "currency": "NOK"
    },
    "reservationExpiresAt": "ISO datetime | null"
  }
}
```

The tool currently selects a slot through Oda's slot-picker flow:
`POST /api/v1/slot-picker/info/` with `{ "deliverySlotId": 123, "inModal": false }`,
then re-reads available slots. Selecting a delivery slot must not place an order
or perform payment.

### `oda_change_delivery_slot`

Input:

```json
{
  "slotId": 123,
  "confirmed": true
}
```

Output:

```json
{
  "status": "proposed",
  "previousSlot": {
    "id": "string",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM"
  },
  "newSlot": {
    "id": "string",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "fee": {
      "amount": 0,
      "currency": "NOK"
    }
  }
}
```

---

## High-risk tools (Level 3 — final order)

These tools are **out of scope for v0** and must not be implemented.

| Tool | Reason |
|------|--------|
| `oda_place_order` | Final order placement — v1+ only |
| `oda_change_submitted_order` | Modifies a confirmed order — v1+ only |
| `oda_add_to_existing_order` | Appends to a confirmed order — v1+ only |
