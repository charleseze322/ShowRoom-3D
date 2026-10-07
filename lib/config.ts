import type { ConfigurableProduct, Finish, Slot } from "./types";

const SLOT_ORDER: Slot[] = ["primary", "secondary", "accent"];

export function getUsedSlots(product: ConfigurableProduct): Slot[] {
  const used = new Set(product.parts.map(part => part.slot));
  if (used.size === 0 && product.modelUrl) used.add("primary");
  return SLOT_ORDER.filter(slot => used.has(slot));
}

// One selection per used slot. First valid requested ID in each slot wins.
// Incomplete drafts may have no default yet; published validation forbids that.
export function resolveSelectedFinishes(product: ConfigurableProduct, ids: readonly string[]): Finish[] {
  const known = new Map(product.finishes.map(finish => [finish.id, finish]));
  const requested = ids.map(id => known.get(id)).filter((finish): finish is Finish => Boolean(finish));
  return getUsedSlots(product).flatMap(slot => {
    const selected = requested.find(finish => finish.slot === slot)
      ?? product.finishes.find(finish => finish.slot === slot && finish.isDefault);
    return selected ? [selected] : [];
  });
}

export function encodeConfig(selectedFinishIds: readonly string[]): string {
  const ids = [...new Set(selectedFinishIds.filter(Boolean))];
  return ids.length ? "?f=" + ids.map(id => encodeURIComponent(id)).join(",") : "";
}

export function decodeConfig(query: string | URLSearchParams | null | undefined, product: ConfigurableProduct): string[] {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query ?? "");
  const ids = (params.get("f") ?? "").split(",").filter(Boolean);
  return resolveSelectedFinishes(product, ids).map(finish => finish.id);
}
