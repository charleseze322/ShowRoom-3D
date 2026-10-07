import type { Part } from "./types";

export function calculateDimensions(parts: readonly Part[]): string | null {
  if (!parts.length) return null;
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    const extent = part.shape === "box" ? part.size
      : part.shape === "cylinder" ? [part.size[0] * 2, part.size[1], part.size[0] * 2]
      : [part.size[0] * 2, part.size[0] * 2, part.size[0] * 2];
    for (let axis = 0; axis < 3; axis++) {
      low[axis] = Math.min(low[axis], part.position[axis] - extent[axis] / 2);
      high[axis] = Math.max(high[axis], part.position[axis] + extent[axis] / 2);
    }
  }
  const lengths = high.map((max, axis) => Math.round((max - low[axis]) * 10) / 10);
  return `${lengths[0]}cm x ${lengths[2]}cm x ${lengths[1]}cm`;
}
