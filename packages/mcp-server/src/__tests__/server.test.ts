import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { version } from '../version';
import {
  createOdaMcpServer,
  EMPTY_INPUT_SCHEMA_JSON,
  MUTATION_TOOL_NAMES,
  ODA_TOOL_NAMES,
  READ_ONLY_TOOL_NAMES,
  ZERO_ARGUMENT_TOOL_NAMES,
} from '../server';

function getTextResult(result: unknown): string {
  const content = (result as { content?: unknown }).content as Array<{ type: string; text?: string }> | undefined;
  const firstBlock = content?.[0];
  if (!firstBlock || firstBlock.type !== 'text' || typeof firstBlock.text !== 'string') {
    throw new Error('Expected a text content block.');
  }

  return firstBlock.text;
}

function createMockOdaClient(): Parameters<typeof createOdaMcpServer>[0] {
  return {
    searchProducts: jest.fn().mockResolvedValue({
      query: 'milk',
      count: 1,
      results: [],
    }),
    getProduct: jest.fn().mockResolvedValue({
      id: 123,
      full_name: 'Whole Milk 1L',
      brand: 'Oda',
      name: 'Whole Milk',
      front_url: 'https://example.com/product/123',
      gross_price: '29.90',
      gross_unit_price: '29.90',
      unit_price_quantity_abbreviation: 'l',
      unit_price_quantity_name: 'liter',
      currency: 'NOK',
      is_available: true,
      is_sponsored: false,
      promoted_product: false,
      images: [
        {
          thumbnail: { url: 'https://example.com/images/123-thumb.jpg' },
          small_thumbnail: { url: 'https://example.com/images/123-small.jpg' },
          large_thumbnail: { url: 'https://example.com/images/123-large.jpg' },
        },
      ],
      discount: null,
      availability: {
        is_available: true,
        description: null,
      },
    }),
    getCart: jest.fn().mockResolvedValue({
      id: 1,
      items: [],
      label: null,
      display_price: null,
      subtotal_price: '0.00',
      summary_lines: [],
      fee_lines: [],
      total_price: '0.00',
      currency: 'NOK',
      item_count: 0,
    }),
    addToCart: jest.fn().mockResolvedValue({
      id: 10,
      product: {
        id: 123,
        full_name: 'Whole Milk 1L',
        brand: 'Oda',
        name: 'Whole Milk',
        front_url: 'https://example.com/product/123',
        gross_price: '29.90',
        gross_unit_price: '29.90',
        unit_price_quantity_abbreviation: 'l',
        unit_price_quantity_name: 'liter',
        currency: 'NOK',
        is_available: true,
        is_sponsored: false,
        promoted_product: false,
        images: [],
        discount: null,
        availability: {
          is_available: true,
          description: null,
        },
      },
      quantity: 2,
      line_price: '59.80',
      original_line_price: null,
      unit_price: '29.90',
      label: null,
    }),
    removeFromCart: jest.fn().mockResolvedValue({
      id: 1,
      items: [],
      label: null,
      display_price: null,
      subtotal_price: '0.00',
      summary_lines: [],
      fee_lines: [],
      total_price: '0.00',
      currency: 'NOK',
      item_count: 0,
    }),
    removeCartLine: jest.fn().mockResolvedValue({
      id: 1,
      items: [],
      label: null,
      display_price: null,
      subtotal_price: '0.00',
      summary_lines: [],
      fee_lines: [],
      total_price: '0.00',
      currency: 'NOK',
      item_count: 0,
    }),
    applyShoppingListToCart: jest.fn().mockResolvedValue({
      id: 1,
      items: [
        {
          id: 10,
          product: {
            id: 123,
            full_name: 'Whole Milk 1L',
            brand: 'Oda',
            name: 'Whole Milk',
            front_url: 'https://example.com/product/123',
            gross_price: '29.90',
            gross_unit_price: '29.90',
            unit_price_quantity_abbreviation: 'l',
            unit_price_quantity_name: 'liter',
            currency: 'NOK',
            is_available: true,
            is_sponsored: false,
            promoted_product: false,
            images: [],
            discount: null,
            availability: {
              is_available: true,
              description: null,
            },
          },
          quantity: 2,
          line_price: '59.80',
          original_line_price: null,
          unit_price: '29.90',
          label: null,
        },
      ],
      label: '2 varer',
      display_price: '59.80',
      subtotal_price: '59.80',
      summary_lines: [],
      fee_lines: [],
      total_price: '59.80',
      currency: 'NOK',
      item_count: 2,
    }),
    setDeliverySlot: jest.fn().mockResolvedValue({
      id: 101,
      start: '2026-05-15T08:00:00+02:00',
      end: '2026-05-15T10:00:00+02:00',
      price: '0.00',
      currency: 'NOK',
      is_available: true,
    }),
    rawRequest: jest.fn().mockResolvedValue({
      raw: true,
    }),
    getOrders: jest.fn().mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    }),
    getOrder: jest.fn().mockResolvedValue({
      id: 99,
      status: 'delivered',
      delivery_date: '2026-04-24',
      total_price: '399.00',
      currency: 'NOK',
      items: [],
    }),
    getShoppingLists: jest.fn().mockResolvedValue([]),
    getDeliverySlots: jest.fn().mockResolvedValue([]),
  };
}

async function connectTestClient(client: Parameters<typeof createOdaMcpServer>[0]) {
  const server = createOdaMcpServer(client, {
    authStatus: {
      configured: false,
      authenticated: false,
    },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({
    name: 'test-client',
    version,
  });

  await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);

  return {
    server,
    mcpClient,
  };
}

describe('createOdaMcpServer', () => {
  it('registers the expected Oda tools with correct safety annotations', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const { tools } = await mcpClient.listTools();
      const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

      expect(tools.map((tool) => tool.name).sort()).toEqual([...ODA_TOOL_NAMES].sort());
      expect(tools).toHaveLength(ODA_TOOL_NAMES.length);

      for (const tool of tools.filter((tool) => (READ_ONLY_TOOL_NAMES as readonly string[]).includes(tool.name))) {
        expect(tool.annotations?.readOnlyHint).toBe(true);
        expect(tool.annotations?.destructiveHint).toBe(false);
        expect(tool.annotations?.idempotentHint).toBe(true);
      }

      for (const tool of tools.filter((tool) => (MUTATION_TOOL_NAMES as readonly string[]).includes(tool.name))) {
        expect(tool.annotations?.readOnlyHint).toBe(false);
        expect(tool.annotations?.destructiveHint).toBe(true);
        expect(tool.annotations?.idempotentHint).toBe(false);
      }

      for (const toolName of ZERO_ARGUMENT_TOOL_NAMES) {
        expect(toolsByName.get(toolName)?.inputSchema).toEqual(EMPTY_INPUT_SCHEMA_JSON);
      }

      expect(toolsByName.get('oda_remove_from_cart')?.inputSchema).toMatchObject({
        properties: {
          cart_line_id: expect.objectContaining({ type: 'integer' }),
          product_id: expect.objectContaining({ type: 'integer' }),
          confirmed: expect.objectContaining({ type: 'boolean' }),
        },
        type: 'object',
      });
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('returns auth status and product image payloads as text results', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const authResult = await mcpClient.callTool({
        name: 'oda_auth_status',
        arguments: {},
      });
      const productImageResult = await mcpClient.callTool({
        name: 'oda_get_product_image',
        arguments: { productId: 123 },
      });

      expect(JSON.parse(getTextResult(authResult))).toEqual({
        configured: false,
        authenticated: false,
      });
      expect(odaClient.getProduct).toHaveBeenCalledWith(123);
      expect(JSON.parse(getTextResult(productImageResult))).toEqual({
        productId: 123,
        front_url: 'https://example.com/product/123',
        images: [
          {
            thumbnail: { url: 'https://example.com/images/123-thumb.jpg' },
            small_thumbnail: { url: 'https://example.com/images/123-small.jpg' },
            large_thumbnail: { url: 'https://example.com/images/123-large.jpg' },
          },
        ],
      });
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('returns enriched cart pricing breakdowns for oda_get_cart', async () => {
    const odaClient = createMockOdaClient();
    odaClient.getCart = jest.fn().mockResolvedValue({
      id: 1,
      items: [
        {
          id: 10,
          quantity: 1,
          line_price: '30.00',
          original_line_price: '51.90',
          unit_price: '51.90',
          label: 'Member discount',
          product: {
            id: 42,
            full_name: 'Organic Avocados 2 pcs',
            brand: 'Oda',
            name: 'Organic Avocados',
            front_url: 'https://example.com/product/42',
            gross_price: '51.90',
            gross_unit_price: '51.90',
            unit_price_quantity_abbreviation: 'pk',
            unit_price_quantity_name: 'pack',
            currency: 'NOK',
            is_available: true,
            is_sponsored: false,
            promoted_product: false,
            images: [],
            discount: null,
            availability: {
              is_available: true,
              description: null,
            },
          },
        },
      ],
      label: '1 vare',
      display_price: '51.90',
      subtotal_price: '30.00',
      summary_lines: [
        { label: '1 vare', price: '51.90', kind: 'item', details: null },
        { label: 'Du sparer', price: '-21.90', kind: 'discount', details: null },
        { label: 'Delsum', price: '30.00', kind: 'subtotal', details: null },
        { label: 'Tillegg for mindre bestilling', price: '199.00', kind: 'fee', details: 'Under threshold fee' },
        { label: 'Leveringsemballasje', price: '11.70', kind: 'fee', details: 'Packaging fee' },
        { label: 'Total inkl. MVA', price: '240.70', kind: 'total', details: null },
      ],
      fee_lines: [
        { label: 'Tillegg for mindre bestilling', price: '199.00', kind: 'fee', details: 'Under threshold fee' },
        { label: 'Leveringsemballasje', price: '11.70', kind: 'fee', details: 'Packaging fee' },
      ],
      total_price: '240.70',
      currency: 'NOK',
      item_count: 1,
    });
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const cartResult = await mcpClient.callTool({
        name: 'oda_get_cart',
        arguments: {},
      });

      expect(JSON.parse(getTextResult(cartResult))).toEqual({
        id: 1,
        items: [
          expect.objectContaining({
            id: 10,
            line_price: '30.00',
            original_line_price: '51.90',
            unit_price: '51.90',
            label: 'Member discount',
          }),
        ],
        label: '1 vare',
        display_price: '51.90',
        subtotal_price: '30.00',
        summary_lines: [
          { label: '1 vare', price: '51.90', kind: 'item', details: null },
          { label: 'Du sparer', price: '-21.90', kind: 'discount', details: null },
          { label: 'Delsum', price: '30.00', kind: 'subtotal', details: null },
          { label: 'Tillegg for mindre bestilling', price: '199.00', kind: 'fee', details: 'Under threshold fee' },
          { label: 'Leveringsemballasje', price: '11.70', kind: 'fee', details: 'Packaging fee' },
          { label: 'Total inkl. MVA', price: '240.70', kind: 'total', details: null },
        ],
        fee_lines: [
          { label: 'Tillegg for mindre bestilling', price: '199.00', kind: 'fee', details: 'Under threshold fee' },
          { label: 'Leveringsemballasje', price: '11.70', kind: 'fee', details: 'Packaging fee' },
        ],
        total_price: '240.70',
        currency: 'NOK',
        item_count: 1,
      });
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('requires explicit confirmation before mutating Oda state', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_add_to_cart',
        arguments: { productId: 123, quantity: 2, confirmed: false },
      });

      expect((result as { isError?: boolean }).isError).toBe(true);
      expect(getTextResult(result)).toContain('confirmed=true');
      expect(odaClient.addToCart).not.toHaveBeenCalled();
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('executes confirmed add-to-cart mutations through the Oda client', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const addResult = await mcpClient.callTool({
        name: 'oda_add_to_cart',
        arguments: { productId: 123, quantity: 2, confirmed: true },
      });

      expect(odaClient.addToCart).toHaveBeenCalledWith(123, 2);
      expect(JSON.parse(getTextResult(addResult))).toEqual(expect.objectContaining({
        quantity: 2,
      }));
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('treats add-to-cart quantity zero as a remove-by-product request', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_add_to_cart',
        arguments: { productId: 123, quantity: 0, confirmed: true },
      });

      expect(odaClient.addToCart).not.toHaveBeenCalled();
      expect(odaClient.removeFromCart).toHaveBeenCalledWith(123);
      expect(JSON.parse(getTextResult(result))).toEqual(expect.objectContaining({
        item_count: 0,
      }));
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('requires explicit confirmation before removing from the cart', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_remove_from_cart',
        arguments: { product_id: 123, confirmed: false },
      });

      expect((result as { isError?: boolean }).isError).toBe(true);
      expect(getTextResult(result)).toContain('confirmed=true');
      expect(odaClient.removeFromCart).not.toHaveBeenCalled();
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('executes confirmed remove-from-cart mutations by product id', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_remove_from_cart',
        arguments: { product_id: 123, confirmed: true },
      });

      expect(odaClient.removeFromCart).toHaveBeenCalledWith(123);
      expect(odaClient.removeCartLine).not.toHaveBeenCalled();
      expect(JSON.parse(getTextResult(result))).toEqual(expect.objectContaining({
        item_count: 0,
      }));
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('executes confirmed remove-from-cart mutations by cart line id', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_remove_from_cart',
        arguments: { cart_line_id: 683630902, confirmed: true },
      });

      expect(odaClient.removeCartLine).toHaveBeenCalledWith(683630902);
      expect(odaClient.removeFromCart).not.toHaveBeenCalled();
      expect(JSON.parse(getTextResult(result))).toEqual(expect.objectContaining({
        item_count: 0,
      }));
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('requires explicit confirmation before adding a shopping list to the cart', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_add_shopping_list_to_cart',
        arguments: { shopping_list_id: 430128, confirmed: false },
      });

      expect((result as { isError?: boolean }).isError).toBe(true);
      expect(getTextResult(result)).toContain('confirmed=true');
      expect(odaClient.applyShoppingListToCart).not.toHaveBeenCalled();
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('executes confirmed shopping-list bulk cart mutations through the Oda client', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const addResult = await mcpClient.callTool({
        name: 'oda_add_shopping_list_to_cart',
        arguments: { shopping_list_id: 430128, confirmed: true },
      });

      expect(odaClient.applyShoppingListToCart).toHaveBeenCalledWith(430128);
      expect(JSON.parse(getTextResult(addResult))).toEqual(expect.objectContaining({
        id: 1,
        item_count: 2,
      }));
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('requires explicit confirmation before setting a delivery slot', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_set_delivery_slot',
        arguments: { slot_id: '101', confirmed: false },
      });

      expect((result as { isError?: boolean }).isError).toBe(true);
      expect(getTextResult(result)).toContain('confirmed=true');
      expect(odaClient.setDeliverySlot).not.toHaveBeenCalled();
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('executes confirmed delivery-slot mutations through the Oda client', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_set_delivery_slot',
        arguments: { slot_id: '101', confirmed: true },
      });

      expect(odaClient.setDeliverySlot).toHaveBeenCalledWith('101');
      expect(JSON.parse(getTextResult(result))).toEqual(expect.objectContaining({
        id: 101,
        start: '2026-05-15T08:00:00+02:00',
        end: '2026-05-15T10:00:00+02:00',
      }));
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('executes raw GET Oda API requests without confirmation', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_http_request',
        arguments: {
          method: 'GET',
          path: '/cart/',
          query: { group_by: 'recipes' },
        },
      });

      expect(odaClient.rawRequest).toHaveBeenCalledWith('GET', '/cart/', undefined, {
        group_by: 'recipes',
      });
      expect(JSON.parse(getTextResult(result))).toEqual({ raw: true });
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('requires explicit confirmation before raw non-GET Oda API requests', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_http_request',
        arguments: {
          method: 'POST',
          path: '/cart/items/',
          body: { items: [{ product_id: 123, quantity: 2 }] },
          confirmed: false,
        },
      });

      expect((result as { isError?: boolean }).isError).toBe(true);
      expect(getTextResult(result)).toContain('confirmed=true');
      expect(odaClient.rawRequest).not.toHaveBeenCalled();
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });

  it('executes confirmed raw non-GET Oda API requests through the Oda client', async () => {
    const odaClient = createMockOdaClient();
    const { server, mcpClient } = await connectTestClient(odaClient);

    try {
      const result = await mcpClient.callTool({
        name: 'oda_http_request',
        arguments: {
          method: 'PATCH',
          path: '/product-lists/430128/',
          body: { title: 'Weekdays' },
          query: { source: 'mcp' },
          confirmed: true,
        },
      });

      expect(odaClient.rawRequest).toHaveBeenCalledWith('PATCH', '/product-lists/430128/', { title: 'Weekdays' }, {
        source: 'mcp',
      });
      expect(JSON.parse(getTextResult(result))).toEqual({ raw: true });
    } finally {
      await Promise.all([mcpClient.close(), server.close()]);
    }
  });
});
