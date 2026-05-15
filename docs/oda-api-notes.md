# Oda API Notes

This file is intentionally a placeholder.

Use the existing public `mcp-oda` project as inspiration, but do not blindly copy code without review.

Initial notes to investigate:

- authentication flow
- session/cookie persistence
- CSRF handling for mutation requests
- product search endpoint: current web frontend uses `GET /api/v1/search/mixed/?q=<query>&type=product`, which returns a mixed-search envelope with product rows under `items[].attributes`
- product image fields
- current cart endpoint
- order history endpoint
- saved lists endpoint
- delivery slot endpoint

Rules:

- Add sanitized fixtures only.
- Never commit real cookies, user IDs, addresses, payment info, or order details.
- Prefer stable typed models over leaking raw Oda API response shapes throughout the project.
