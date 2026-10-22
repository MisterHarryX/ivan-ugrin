import type { Price } from '../config/types.ts';

const number = new Intl.NumberFormat('ru-RU');

/** A zero price reads as a gift, not as «0 ₽». */
export function formatPrice(price: Price): string {
  if (!price.amount && !price.prefix) return 'Бесплатно';
  return [price.prefix, `${number.format(price.amount)} ${price.currency}`].filter(Boolean).join(' ');
}
