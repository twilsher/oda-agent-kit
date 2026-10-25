import type { OdaCartItem } from './types.js';

/** Surface availability without preventing an explicitly requested cart add. */
export function getCartItemWarnings(item: OdaCartItem): Array<{
  code: string;
  product_id: number;
  message: string;
}> {
  const product = item.product;
  if (product.availability.is_available && product.is_available) return [];
  const reason = product.availability.description?.trim();
  return [{
    code: 'product_unavailable',
    product_id: product.id,
    message: `${product.full_name} is unavailable${reason ? `: ${reason}` : '.'} The item is in the cart, but delivery is not guaranteed.`,
  }];
}
