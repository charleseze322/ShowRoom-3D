import { resolveSelectedFinishes } from "./config";
import type { PriceableProduct } from "./types";

export function calculatePrice(product: PriceableProduct, selectedFinishIds: readonly string[]): number {
  if (!Number.isSafeInteger(product.basePrice) || product.basePrice <= 0) {
    throw new RangeError("Base price must be a positive integer.");
  }
  let total = product.basePrice;
  for (const finish of resolveSelectedFinishes(product, selectedFinishIds)) {
    if (!Number.isSafeInteger(finish.priceModifier) || finish.priceModifier < 0) {
      throw new RangeError("Finish price modifier must be a non-negative integer.");
    }
    total += finish.priceModifier;
  }
  if (!Number.isSafeInteger(total)) throw new RangeError("Calculated price is too large.");
  return total;
}

export function formatPrice(price: number, currency = "NGN"): string {
  if (!Number.isSafeInteger(price) || price <= 0) throw new RangeError("Price must be a positive integer.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError("Currency must be a three-letter code.");
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency, currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(price);
}
