import { OdaClient, OdaApiError } from '../client';
import type { OdaHttpClient, OdaHttpResponse, OdaSessionStore } from '../types';
import cartFixture from './fixtures/cart.json';
import productListDetailFixture from './fixtures/product-list-detail.json';
import productListsPageFixture from './fixtures/product-lists-page.json';
import searchMixedResponseFixture from './fixtures/search-mixed-response.json';
import slotPickerSlotsFixture from './fixtures/slot-picker-slots.json';

function createJsonResponse(body: unknown, status = 200, cookies: Record<string, string> = {}): OdaHttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(async () => body),
    getCookies: jest.fn(() => cookies),
  };
}

describe('OdaClient', () => {
  it('does not make network calls in the constructor', () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(),
    };

    new OdaClient({
      credentials: { email: 'test@example.com', password: 'secret' },
      httpClient,
    });

    expect(httpClient.request).not.toHaveBeenCalled();
  });

  it('stores the session token from login response cookies', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () =>
        createJsonResponse({}, 200, { sessionid: 'session-cookie-value', csrftoken: 'csrf-abc' }),
      ),
    };
    const sessionStore: OdaSessionStore = {
      getSessionToken: jest.fn(() => null),
      setSessionToken: jest.fn(),
      clearSessionToken: jest.fn(),
      getCsrfToken: jest.fn(() => null),
      setCsrfToken: jest.fn(),
      clearCsrfToken: jest.fn(),
    };
    const client = new OdaClient({
      credentials: { email: 'test@example.com', password: 'secret' },
      httpClient,
      sessionStore,
    });

    await client.login();

    // Login POSTs to /user/login/ (no prefetch call since httpClient has no prefetch method)
    expect(httpClient.request).toHaveBeenCalledTimes(1);
    expect((httpClient.request as jest.Mock).mock.calls[0][0]).toMatchObject({
      method: 'POST',
      path: '/user/login/',
    });
    expect(sessionStore.setSessionToken).toHaveBeenCalledWith('session-cookie-value');
    expect(sessionStore.setCsrfToken).toHaveBeenCalledWith('csrf-abc');
  });

  it('throws OdaApiError when login response lacks a sessionid cookie', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () =>
        // 200 OK but no sessionid in cookies
        createJsonResponse({}, 200, { csrftoken: 'csrf-only' }),
      ),
    };
    const client = new OdaClient({
      credentials: { email: 'test@example.com', password: 'secret' },
      httpClient,
    });

    await expect(client.login()).rejects.toThrow(OdaApiError);
    await expect(client.login()).rejects.toThrow('missing session cookie');
  });

  it('parses typed responses through the configured HTTP client', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async ({ path }) => {
        if (path === '/search/mixed/?q=kylling&type=product') {
          return createJsonResponse(searchMixedResponseFixture);
        }

        return createJsonResponse(cartFixture);
      }),
    };
    const client = new OdaClient({
      httpClient,
    });

    const searchResponse = await client.searchProducts('kylling');
    const cart = await client.getCart();

    expect(searchResponse.results[0]?.id).toBe(66895);
    expect(searchResponse.query).toBe('kylling');
    // cart fixture is in the real API format (groups[]); getCart() normalises it
    expect(cart.items[0]?.quantity).toBe(2);
    expect(httpClient.request).toHaveBeenCalledTimes(2);
    expect(httpClient.request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: 'GET',
      path: '/cart/?group-by=recipes',
    }));
  });

  it('uses the live mixed search endpoint for product searches', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse(searchMixedResponseFixture)),
    };
    const client = new OdaClient({ httpClient });

    await client.searchProducts('kyllinglår');

    expect(httpClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/search/mixed/?q=kyllingl%C3%A5r&type=product',
    }));
  });

  it('retrieves product-list summaries from the live saved-lists endpoint', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse(productListsPageFixture)),
    };
    const client = new OdaClient({ httpClient });

    const lists = await client.getProductLists();

    expect(lists).toEqual([
      expect.objectContaining({
        id: 430128,
        name: 'Standard groceries',
        number_of_products: 13,
      }),
    ]);
    expect(httpClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/product-lists/?filter=product_lists&sort=default&size=50&page=1',
    }));
  });

  it('hydrates saved shopping lists from product-list detail endpoints', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async ({ path }) => {
        if (path === '/product-lists/?filter=product_lists&sort=default&size=50&page=1') {
          return createJsonResponse(productListsPageFixture);
        }

        if (path === '/product-lists/430128/') {
          return createJsonResponse(productListDetailFixture);
        }

        throw new Error(`Unexpected path: ${path}`);
      }),
    };
    const client = new OdaClient({ httpClient });

    const lists = await client.getShoppingLists();

    expect(lists).toHaveLength(1);
    expect(lists[0]).toEqual(expect.objectContaining({
      id: 430128,
      name: 'Standard groceries',
    }));
    expect(lists[0]?.items[0]?.product.full_name).toBe('Tine Lettmelk 0,5% fett');
    expect(httpClient.request).toHaveBeenCalledTimes(2);
  });

  it('sends cart quantity mutations through the cart items endpoint', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse(cartFixture)),
    };
    const client = new OdaClient({ httpClient });

    await client.updateCartItemQuantity(123, 3);

    expect(httpClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: '/cart/items/?group_by=recipes',
      body: JSON.stringify({ items: [{ product_id: 123, quantity: 3 }] }),
    }));
  });

  it('sends bulk cart mutations with list provenance metadata in one request', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse(cartFixture)),
    };
    const client = new OdaClient({ httpClient });

    await client.bulkUpdateCartItems([
      {
        product_id: 12079,
        quantity: 2,
        from_list_id: 430128,
        tracking_list_name: 'Standard groceries',
        tracking_location: 'PRODUCT_LIST_DETAIL',
        product_list_token: 'shared-token',
      },
      {
        product_id: 28870,
        quantity: 1,
        from_list_id: 430128,
        tracking_list_name: 'Standard groceries',
        tracking_location: 'PRODUCT_LIST_DETAIL',
      },
    ]);

    expect(httpClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: '/cart/items/?group_by=recipes',
      body: JSON.stringify({
        items: [
          {
            product_id: 12079,
            quantity: 2,
            from_list_id: 430128,
            tracking_list_name: 'Standard groceries',
            tracking_location: 'PRODUCT_LIST_DETAIL',
            product_list_token: 'shared-token',
          },
          {
            product_id: 28870,
            quantity: 1,
            from_list_id: 430128,
            tracking_list_name: 'Standard groceries',
            tracking_location: 'PRODUCT_LIST_DETAIL',
          },
        ],
      }),
    }));
  });

  it('adds a shopping list to cart with one bulk request and skips zero-quantity items', async () => {
    const productListWithZeroQuantity = {
      ...productListDetailFixture,
      items: [
        ...productListDetailFixture.items,
        {
          ...productListDetailFixture.items[0],
          quantity: 0,
          product: {
            ...productListDetailFixture.items[0]?.product,
            id: 99999,
          },
        },
      ],
    };
    const httpClient: OdaHttpClient = {
      request: jest.fn(async ({ path }) => {
        if (path === '/product-lists/430128/') {
          return createJsonResponse(productListWithZeroQuantity);
        }

        if (path === '/cart/items/?group_by=recipes') {
          return createJsonResponse(cartFixture);
        }

        throw new Error(`Unexpected path: ${path}`);
      }),
    };
    const client = new OdaClient({ httpClient });

    await client.applyShoppingListToCart(430128);

    expect(httpClient.request).toHaveBeenCalledTimes(2);
    expect(httpClient.request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: 'POST',
      path: '/cart/items/?group_by=recipes',
      body: JSON.stringify({
        items: [
          {
            product_id: 12079,
            quantity: 2,
            from_list_id: 430128,
            tracking_list_name: 'Standard groceries',
            tracking_location: 'PRODUCT_LIST_DETAIL',
          },
          {
            product_id: 28870,
            quantity: 1,
            from_list_id: 430128,
            tracking_list_name: 'Standard groceries',
            tracking_location: 'PRODUCT_LIST_DETAIL',
          },
        ],
      }),
    }));
  });

  it('creates, renames, and edits shopping lists through product-list endpoints', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse(productListDetailFixture)),
    };
    const client = new OdaClient({ httpClient });

    await client.createShoppingList('Weekend');
    await client.renameShoppingList(430128, 'Weekdays');
    await client.updateShoppingListItem(430128, 123, 2);

    expect(httpClient.request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: 'POST',
      path: '/product-lists/',
      body: JSON.stringify({ title: 'Weekend' }),
    }));
    expect(httpClient.request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: 'PATCH',
      path: '/product-lists/430128/',
      body: JSON.stringify({ title: 'Weekdays' }),
    }));
    expect(httpClient.request).toHaveBeenNthCalledWith(3, expect.objectContaining({
      method: 'POST',
      path: '/product-lists/430128/items/',
      body: JSON.stringify({ items: [{ product_id: 123, quantity: 2 }] }),
    }));
  });

  it('deletes shopping lists without parsing a response body', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse(null, 204)),
    };
    const client = new OdaClient({ httpClient });

    await client.deleteShoppingList(430128);

    expect(httpClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'DELETE',
      path: '/product-lists/430128/',
      body: undefined,
    }));
  });

  it('retrieves delivery slots through the live slot-picker endpoint', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse(slotPickerSlotsFixture)),
    };
    const client = new OdaClient({ httpClient });

    const slots = await client.getDeliverySlots();

    expect(slots).toEqual([
      expect.objectContaining({
        id: 101,
        start: '2026-05-15T08:00:00+02:00',
        end: '2026-05-15T10:00:00+02:00',
        is_available: true,
      }),
      expect.objectContaining({
        id: 102,
        is_available: false,
      }),
    ]);
    expect(httpClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/slot-picker/slots/?num-days=3',
    }));
  });

  it('selects a delivery slot without placing an order', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async ({ path }) => {
        if (path === '/slot-picker/info/') {
          return createJsonResponse({}, 204);
        }

        if (path === '/slot-picker/slots/?num-days=3') {
          return createJsonResponse(slotPickerSlotsFixture);
        }

        throw new Error(`Unexpected path: ${path}`);
      }),
    };
    const client = new OdaClient({ httpClient });

    const slot = await client.selectDeliverySlot(101);

    expect(slot.id).toBe(101);
    expect(httpClient.request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: 'POST',
      path: '/slot-picker/info/',
      body: JSON.stringify({ deliverySlotId: 101, inModal: false }),
    }));
    expect(httpClient.request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: 'GET',
      path: '/slot-picker/slots/?num-days=3',
    }));
    expect(httpClient.request).not.toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringContaining('order'),
    }));
  });

  it('executes raw GET requests with appended query parameters', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse({ results: [{ id: 123 }], ok: true })),
    };
    const sessionStore: OdaSessionStore = {
      getSessionToken: jest.fn(() => 'session-123'),
      setSessionToken: jest.fn(),
      clearSessionToken: jest.fn(),
      getCsrfToken: jest.fn(() => 'csrf-123'),
      setCsrfToken: jest.fn(),
      clearCsrfToken: jest.fn(),
    };
    const client = new OdaClient({ httpClient, sessionStore });

    const result = await client.rawRequest('GET', '/search/mixed/?type=product', undefined, {
      q: 'kyllinglår',
      page: 2,
      include: ['products', 'recipes'],
      empty: null,
    });

    expect(result).toEqual({ results: [{ id: 123 }], ok: true });
    expect(httpClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/search/mixed/?type=product&q=kyllingl%C3%A5r&page=2&include=products&include=recipes',
      body: undefined,
      headers: expect.objectContaining({
        Cookie: 'sessionid=session-123; csrftoken=csrf-123',
      }),
    }));
  });

  it('executes raw mutation requests with JSON body and mutation headers', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse({ id: 1, items: [] })),
    };
    const sessionStore: OdaSessionStore = {
      getSessionToken: jest.fn(() => 'session-123'),
      setSessionToken: jest.fn(),
      clearSessionToken: jest.fn(),
      getCsrfToken: jest.fn(() => 'csrf-123'),
      setCsrfToken: jest.fn(),
      clearCsrfToken: jest.fn(),
    };
    const client = new OdaClient({ httpClient, sessionStore });

    const result = await client.rawRequest('POST', '/cart/items/', {
      items: [{ product_id: 123, quantity: 2 }],
    }, {
      group_by: 'recipes',
    });

    expect(result).toEqual({ id: 1, items: [] });
    expect(httpClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: '/cart/items/?group_by=recipes',
      body: JSON.stringify({ items: [{ product_id: 123, quantity: 2 }] }),
      headers: expect.objectContaining({
        Cookie: 'sessionid=session-123; csrftoken=csrf-123',
        'X-CSRFToken': 'csrf-123',
        Origin: 'https://oda.com',
        Referer: 'https://oda.com/no/',
      }),
    }));
  });

  it('returns null for raw 204 responses', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse(null, 204)),
    };
    const client = new OdaClient({ httpClient });

    await expect(client.rawRequest('DELETE', '/cart/items/10/')).resolves.toBeNull();
  });

  it('rejects absolute raw request paths', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse({})),
    };
    const client = new OdaClient({ httpClient });

    await expect(client.rawRequest('GET', 'https://oda.com/api/v1/cart/')).rejects.toThrow('relative path');
    expect(httpClient.request).not.toHaveBeenCalled();
  });

  it('blocks raw checkout, payment, and submitted-order mutations', async () => {
    const httpClient: OdaHttpClient = {
      request: jest.fn(async () => createJsonResponse({})),
    };
    const client = new OdaClient({ httpClient });

    await expect(client.rawRequest('POST', '/checkout/')).rejects.toThrow('out of scope for v0');
    await expect(client.rawRequest('PATCH', '/payment-methods/1/')).rejects.toThrow('out of scope for v0');
    await expect(client.rawRequest('DELETE', '/orders/123/')).rejects.toThrow('out of scope for v0');
    expect(httpClient.request).not.toHaveBeenCalled();
  });
});
