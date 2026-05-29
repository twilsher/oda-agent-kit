import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type {
  OdaCart,
  OdaCartItem,
  OdaDeliverySlot,
  OdaHttpMethod,
  OdaOrder,
  OdaPage,
  OdaProduct,
  OdaRawQueryValue,
  OdaSearchResponse,
  OdaShoppingList,
} from '@oda-agent/core';
import { version } from './version.js';

export const ZERO_ARGUMENT_TOOL_NAMES = [
  'oda_auth_status',
  'oda_get_cart',
  'oda_get_shopping_lists',
  'oda_get_delivery_slots',
] as const;

const PARAMETERIZED_TOOL_NAMES = [
  'oda_search_products',
  'oda_get_product',
  'oda_get_product_image',
  'oda_get_orders',
  'oda_get_order_details',
] as const;

export const MUTATION_TOOL_NAMES = [
  'oda_add_to_cart',
  'oda_remove_from_cart',
  'oda_add_shopping_list_to_cart',
  'oda_set_delivery_slot',
  'oda_http_request',
] as const;

export const READ_ONLY_TOOL_NAMES = [...ZERO_ARGUMENT_TOOL_NAMES, ...PARAMETERIZED_TOOL_NAMES] as const;
export const ODA_TOOL_NAMES = [...READ_ONLY_TOOL_NAMES, ...MUTATION_TOOL_NAMES] as const;

export interface OdaMcpServerOptions {
  authStatus?: {
    configured: boolean;
    authenticated: boolean;
  };
}

interface OdaMcpClient {
  searchProducts(query: string): Promise<OdaSearchResponse>;
  getProduct(productId: number): Promise<OdaProduct>;
  getCart(): Promise<OdaCart>;
  addToCart(productId: number, quantity: number): Promise<OdaCartItem>;
  removeFromCart(productId: number): Promise<OdaCart>;
  removeCartLine(cartLineId: number): Promise<OdaCart>;
  applyShoppingListToCart(shoppingListId: number): Promise<OdaCart>;
  setDeliverySlot(slotId: string): Promise<OdaDeliverySlot>;
  rawRequest(
    method: OdaHttpMethod,
    path: string,
    body?: unknown,
    query?: Record<string, OdaRawQueryValue>,
  ): Promise<unknown>;
  getOrders(page?: number): Promise<OdaPage<OdaOrder>>;
  getOrder(orderId: number): Promise<OdaOrder>;
  getShoppingLists(): Promise<OdaShoppingList[]>;
  getDeliverySlots(): Promise<OdaDeliverySlot[]>;
}

const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
} as const;

const MUTATION_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
} as const;

const RAW_QUERY_VALUE_SCHEMA = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
  z.null(),
]);

export const EMPTY_INPUT_SCHEMA = z.object({}).strict();
export const EMPTY_INPUT_SCHEMA_JSON = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  additionalProperties: false,
  properties: {},
  type: 'object',
} as const;

function createJsonResult(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function requireConfirmed(confirmed: boolean): void {
  if (confirmed !== true) {
    throw new Error('This Oda mutation tool requires confirmed=true after explicit user approval.');
  }
}

/**
 * Build and configure an MCP server with Oda tools.
 *
 * @param client - An Oda client instance for read and confirmed mutation operations.
 */
export function createOdaMcpServer(client: OdaMcpClient, options: OdaMcpServerOptions = {}): McpServer {
  const server = new McpServer({
    name: 'oda-agent',
    version,
  });

  server.registerTool(
    'oda_auth_status',
    {
      description: 'Report whether the MCP server has Oda credentials configured and authenticated.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async () =>
      createJsonResult(
        options.authStatus ?? {
          configured: false,
          authenticated: false,
        },
      ),
  );

  server.registerTool(
    'oda_search_products',
    {
      description: 'Search Oda grocery for products matching a query string.',
      inputSchema: z.object({
        query: z.string().min(1).describe('The search term, e.g. "oat milk"'),
      }),
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ query }) => createJsonResult(await client.searchProducts(query)),
  );

  server.registerTool(
    'oda_get_product',
    {
      description: 'Retrieve a single Oda product by product ID.',
      inputSchema: z.object({
        productId: z.number().int().positive().describe('The Oda product ID'),
      }),
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ productId }) => createJsonResult(await client.getProduct(productId)),
  );

  server.registerTool(
    'oda_get_product_image',
    {
      description: 'Retrieve the image metadata for a single Oda product.',
      inputSchema: z.object({
        productId: z.number().int().positive().describe('The Oda product ID'),
      }),
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ productId }) => {
      const product = await client.getProduct(productId);
      return createJsonResult({
        productId: product.id,
        front_url: product.front_url,
        images: product.images,
      });
    },
  );

  server.registerTool(
    'oda_get_cart',
    {
      description: 'Retrieve the current Oda shopping cart, including subtotal and fee breakdown lines.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async () => createJsonResult(await client.getCart()),
  );

  server.registerTool(
    'oda_get_orders',
    {
      description: 'Retrieve a page of past Oda orders.',
      inputSchema: z.object({
        page: z.number().int().positive().default(1).describe('Page number (default: 1)'),
      }),
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ page }) => createJsonResult(await client.getOrders(page)),
  );

  server.registerTool(
    'oda_get_order_details',
    {
      description: 'Retrieve a single Oda order by order ID.',
      inputSchema: z.object({
        orderId: z.number().int().positive().describe('The Oda order ID'),
      }),
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ orderId }) => createJsonResult(await client.getOrder(orderId)),
  );

  server.registerTool(
    'oda_get_shopping_lists',
    {
      description: 'Retrieve saved Oda shopping lists.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async () => createJsonResult(await client.getShoppingLists()),
  );

  server.registerTool(
    'oda_get_delivery_slots',
    {
      description: 'Retrieve Oda delivery slot availability.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async () => createJsonResult(await client.getDeliverySlots()),
  );

  server.registerTool(
    'oda_add_to_cart',
    {
      description: 'Add a product to the Oda cart after explicit user confirmation. Does not place an order.',
      inputSchema: z.object({
        productId: z.number().int().positive().describe('The Oda product ID to add'),
        quantity: z.number().int().nonnegative().describe('Quantity to set/add for this product. Use 0 to remove it.'),
        confirmed: z.boolean().describe('Must be true only after the user explicitly approved this cart change'),
      }),
      annotations: MUTATION_TOOL_ANNOTATIONS,
    },
    async ({ productId, quantity, confirmed }) => {
      requireConfirmed(confirmed);
      if (quantity === 0) {
        return createJsonResult(await client.removeFromCart(productId));
      }

      return createJsonResult(await client.addToCart(productId, quantity));
    },
  );

  const removeFromCartInputSchema = z.object({
    cart_line_id: z.number().int().positive().optional().describe('The Oda cart line item ID, e.g. cart.items[].id'),
    product_id: z.number().int().positive().optional().describe('The Oda product ID, e.g. cart.items[].product.id'),
    confirmed: z.boolean().describe('Must be true only after the user explicitly approved this cart removal'),
  });

  server.registerTool(
    'oda_remove_from_cart',
    {
      description: 'Remove a single product or cart line from the Oda cart after explicit user confirmation. Does not place an order.',
      inputSchema: removeFromCartInputSchema,
      annotations: MUTATION_TOOL_ANNOTATIONS,
    },
    async ({ cart_line_id, product_id, confirmed }) => {
      requireConfirmed(confirmed);
      if ((cart_line_id === undefined) === (product_id === undefined)) {
        throw new Error('Provide exactly one of cart_line_id or product_id.');
      }

      if (cart_line_id !== undefined) {
        return createJsonResult(await client.removeCartLine(cart_line_id));
      }

      if (product_id === undefined) {
        throw new Error('Provide exactly one of cart_line_id or product_id.');
      }

      return createJsonResult(await client.removeFromCart(product_id));
    },
  );

  server.registerTool(
    'oda_add_shopping_list_to_cart',
    {
      description: 'Add all non-zero-quantity items from a saved Oda shopping list to the cart after explicit user confirmation. Does not place an order.',
      inputSchema: z.object({
        shopping_list_id: z.number().int().positive().describe('The Oda saved shopping list ID to add to the cart'),
        confirmed: z.boolean().describe('Must be true only after the user explicitly approved this cart change'),
      }),
      annotations: MUTATION_TOOL_ANNOTATIONS,
    },
    async ({ shopping_list_id, confirmed }) => {
      requireConfirmed(confirmed);
      return createJsonResult(await client.applyShoppingListToCart(shopping_list_id));
    },
  );

  server.registerTool(
    'oda_set_delivery_slot',
    {
      description: 'Set the Oda delivery slot for the current cart after explicit user confirmation. Does not place an order or touch payment.',
      inputSchema: z.object({
        slot_id: z.string().min(1).describe('The Oda delivery slot identifier returned by oda_get_delivery_slots'),
        confirmed: z.boolean().describe('Must be true only after the user explicitly approved this delivery-slot change'),
      }),
      annotations: MUTATION_TOOL_ANNOTATIONS,
    },
    async ({ slot_id, confirmed }) => {
      requireConfirmed(confirmed);
      return createJsonResult(await client.setDeliverySlot(slot_id));
    },
  );

  server.registerTool(
    'oda_http_request',
    {
      description: 'Execute a raw Oda API request with the stored Oda session. Non-GET requests require confirmed=true. Checkout, payment, and submitted-order mutations are out of scope for v0.',
      inputSchema: z.object({
        method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']).describe('HTTP method to use'),
        path: z.string().min(1).describe('Relative Oda API path, e.g. "/cart/items/"'),
        body: z.record(z.unknown()).optional().describe('Optional JSON object body for non-GET requests'),
        query: z.record(RAW_QUERY_VALUE_SCHEMA).optional().describe('Optional flat query parameters'),
        confirmed: z.boolean().default(false).describe('Required true for non-GET methods after explicit user approval'),
      }),
      annotations: MUTATION_TOOL_ANNOTATIONS,
    },
    async ({ method, path, body, query, confirmed }) => {
      if (method !== 'GET') {
        requireConfirmed(confirmed ?? false);
      }

      return createJsonResult(await client.rawRequest(method, path, body, query));
    },
  );

  return server;
}
