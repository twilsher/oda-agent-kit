import { z } from 'zod';
import {
  createOdaPageSchema,
  normalizeCart,
  OdaDeliverySlotSchema,
  OdaProductListDetailSchema,
  OdaProductListSummaryPageSchema,
  OdaRawCartSchema,
  OdaSearchResponseSchema,
  OdaSlotPickerDeliverySlotsSchema,
  OdaShoppingListSchema,
} from '../schemas';
import { OdaOrderSchema } from '../schemas';
import cartFixture from './fixtures/cart.json';
import cartFlatItemsFixture from './fixtures/cart-flat-items.json';
import cartWithFeesFixture from './fixtures/cart-with-fees.json';
import deliverySlotsFixture from './fixtures/delivery-slots.json';
import ordersPageFixture from './fixtures/orders-page.json';
import productListDetailFixture from './fixtures/product-list-detail.json';
import productListsPageFixture from './fixtures/product-lists-page.json';
import searchMixedResponseFixture from './fixtures/search-mixed-response.json';
import searchResponseFixture from './fixtures/search-response.json';
import shoppingListsFixture from './fixtures/shopping-lists.json';
import slotPickerSlotsFixture from './fixtures/slot-picker-slots.json';

describe('core schemas', () => {
  it('parses search fixtures', () => {
    const parsed = OdaSearchResponseSchema.parse(searchResponseFixture);

    expect(parsed.query).toBe('oat milk');
    expect(parsed.results[0]?.full_name).toBe('Oatly Oat Drink 1L');
  });

  it('normalizes live mixed search responses into product search results', () => {
    const parsed = OdaSearchResponseSchema.parse(searchMixedResponseFixture);

    expect(parsed).toEqual({
      query: 'kylling',
      count: 2,
      results: [
        expect.objectContaining({
          id: 66895,
          full_name: 'Ytteroy Chicken Breast',
          front_url: '/no/products/66895-y-chicken-breast/',
          is_available: true,
          is_sponsored: false,
          promoted_product: false,
          images: [
            {
              thumbnail: { url: 'https://images.oda.com/local_products/chicken-thumb.jpg' },
              small_thumbnail: { url: 'https://images.oda.com/local_products/chicken-thumb.jpg' },
              large_thumbnail: { url: 'https://images.oda.com/local_products/chicken-large.jpg' },
            },
          ],
        }),
        expect.objectContaining({
          id: 66896,
          is_available: false,
          is_sponsored: true,
          promoted_product: true,
          availability: {
            is_available: false,
            description: 'Sold out',
          },
        }),
      ],
    });
  });

  it('parses cart fixtures and normalises groups into items', () => {
    const raw = OdaRawCartSchema.parse(cartFixture);
    const parsed = normalizeCart(raw);

    expect(parsed.item_count).toBe(2);
    expect(parsed.items[0]?.product.id).toBe(123);
    expect(parsed.items[0]?.quantity).toBe(2);
    expect(parsed.items[0]?.line_price).toBe('39.80');
    expect(parsed.items[0]?.original_line_price).toBeNull();
    expect(parsed.items[0]?.unit_price).toBe('19.90');
    expect(parsed.items[0]?.label).toBeNull();
    expect(parsed.label).toBeNull();
    expect(parsed.display_price).toBeNull();
    expect(parsed.subtotal_price).toBe('39.80');
    expect(parsed.summary_lines).toEqual([]);
    expect(parsed.fee_lines).toEqual([]);
    expect(parsed.total_price).toBe('39.80');
    expect(parsed.currency).toBe('NOK');
  });

  it('normalises flat cart item responses when Oda omits groups', () => {
    const raw = OdaRawCartSchema.parse(cartFlatItemsFixture);
    const parsed = normalizeCart(raw);

    expect(parsed).toEqual(expect.objectContaining({
      id: 0,
      item_count: 1,
      label: '1 vare',
      display_price: '29.90',
      subtotal_price: '29.90',
      total_price: '29.90',
      currency: 'NOK',
    }));
    expect(parsed.items).toEqual([
      expect.objectContaining({
        id: 9001,
        quantity: 1,
        line_price: '29.90',
        unit_price: '29.90',
        product: expect.objectContaining({
          id: 12079,
          full_name: 'Tine Lettmelk 0,5% fett',
          unit_price_quantity_name: '',
          currency: 'NOK',
        }),
      }),
    ]);
  });

  it('preserves discounted cart subtotal and fee summary lines', () => {
    const raw = OdaRawCartSchema.parse(cartWithFeesFixture);
    const parsed = normalizeCart(raw);

    expect(parsed.items).toEqual([
      expect.objectContaining({
        id: 675765245,
        quantity: 1,
        line_price: '30.00',
        original_line_price: '51.90',
        unit_price: '30.00',
        label: null,
      }),
    ]);
    expect(parsed.label).toBe('1 vare');
    expect(parsed.display_price).toBe('51.90');
    expect(parsed.subtotal_price).toBe('30.00');
    expect(parsed.summary_lines).toEqual([
      { label: '1 vare', price: '51.90', kind: 'item', details: null },
      { label: 'Du sparer', price: '-21.90', kind: 'discount', details: null },
      { label: 'Delsum', price: '30.00', kind: 'subtotal', details: null },
      {
        label: 'Tillegg for mindre bestilling',
        price: '199.00',
        kind: 'fee',
        details: 'På bestillinger under 1100 kr kommer det et pakketillegg i prisen, som reduseres trinnvis. Neste trinn er ved 700 kr.',
      },
      {
        label: 'Leveringsemballasje',
        price: '11.70',
        kind: 'fee',
        details: 'Vi tar en liten avgift for eskene vi leverer varene dine i.',
      },
      { label: 'Total inkl. MVA', price: '240.70', kind: 'total', details: null },
    ]);
    expect(parsed.fee_lines).toEqual([
      {
        label: 'Tillegg for mindre bestilling',
        price: '199.00',
        kind: 'fee',
        details: 'På bestillinger under 1100 kr kommer det et pakketillegg i prisen, som reduseres trinnvis. Neste trinn er ved 700 kr.',
      },
      {
        label: 'Leveringsemballasje',
        price: '11.70',
        kind: 'fee',
        details: 'Vi tar en liten avgift for eskene vi leverer varene dine i.',
      },
    ]);
    expect(parsed.total_price).toBe('240.70');
  });

  it('parses order page fixtures', () => {
    const parsed = createOdaPageSchema(OdaOrderSchema).parse(ordersPageFixture);

    expect(parsed.count).toBe(1);
    expect(parsed.results[0]?.status).toBe('delivered');
  });

  it('parses delivery slot fixtures', () => {
    const parsed = z.array(OdaDeliverySlotSchema).parse(deliverySlotsFixture);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.is_available).toBe(true);
  });

  it('normalises live slot-picker delivery slot payloads', () => {
    const parsed = OdaSlotPickerDeliverySlotsSchema.parse(slotPickerSlotsFixture);

    expect(parsed).toEqual([
      {
        id: 101,
        start: '2026-05-15T08:00:00+02:00',
        end: '2026-05-15T10:00:00+02:00',
        price: '49.00',
        currency: 'NOK',
        is_available: true,
      },
      {
        id: 102,
        start: '2026-05-15T10:00:00+02:00',
        end: '2026-05-15T12:00:00+02:00',
        price: '79.00',
        currency: 'NOK',
        is_available: false,
      },
    ]);
  });

  it('parses shopping list fixtures', () => {
    const parsed = z.array(OdaShoppingListSchema).parse(shoppingListsFixture);

    expect(parsed[0]?.name).toBe('Weekly staples');
    expect(parsed[0]?.items[0]?.quantity).toBe(3);
  });

  it('parses live product-list overview fixtures', () => {
    const parsed = OdaProductListSummaryPageSchema.parse(productListsPageFixture);

    expect(parsed.results[0]?.name).toBe('Standard groceries');
    expect(parsed.results[0]?.number_of_items).toBe(14);
  });

  it('parses live product-list detail fixtures into shopping lists', () => {
    const parsed = OdaProductListDetailSchema.parse(productListDetailFixture);

    expect(parsed.name).toBe('Standard groceries');
    expect(parsed.items[0]?.product.full_name).toBe('Tine Lettmelk 0,5% fett');
    expect(parsed.items[0]?.product.images[0]?.small_thumbnail.url).toBe(
      'https://images.oda.com/local_products/milk-thumb.jpg',
    );
    expect(parsed.items[0]?.quantity).toBe(2);
  });
});
