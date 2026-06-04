/**
 * Order number formatting helpers.
 *
 * Database stores raw sequential order_number (1, 2, 3, ...).
 * Display adds a trust-building offset so customers see established-looking numbers.
 *
 * Example: order_number = 47 → "QF-2026-12047"
 */

export const ORDER_NUMBER_OFFSET = 12000;

/**
 * Format an order_number into the customer-facing string.
 * Returns 'QF-{year}-{number + offset}' or '' if no number provided.
 *
 * @param orderNumber - The raw sequential number from donations.order_number
 * @param createdAt   - ISO timestamp string (uses year for the prefix)
 */
export function formatOrderNumber(
  orderNumber: number | null | undefined,
  createdAt?: string | Date | null
): string {
  if (orderNumber == null || isNaN(Number(orderNumber))) return '';
  const year = createdAt
    ? new Date(createdAt).getFullYear()
    : new Date().getFullYear();
  const displayed = Number(orderNumber) + ORDER_NUMBER_OFFSET;
  return `QF-${year}-${displayed}`;
}

/**
 * Parse a displayed order number back to its raw DB order_number.
 * Returns null if it does not parse.
 */
export function parseOrderNumber(displayed: string): number | null {
  const match = String(displayed || '').match(/QF-\d{4}-(\d+)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (isNaN(num)) return null;
  const raw = num - ORDER_NUMBER_OFFSET;
  return raw > 0 ? raw : null;
}
