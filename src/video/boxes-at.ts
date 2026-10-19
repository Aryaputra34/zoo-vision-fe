import type { Box } from '@/contract/web';

export type BoxSet = { t: number; boxes: Box[] };

/**
 * Returns the boxes corresponding to time t from sets (sorted by t).
 * - If sets is empty -> []
 * - If t is before the first set -> first set's boxes
 * - If t is more than 2000ms after the last set -> []
 * - If t is after the last set (within 2s) -> last set's boxes
 * - Between sets A and B:
 *   - Each box of A whose trackId is in B moves linearly by (t - A.t) / (B.t - A.t)
 *   - Boxes of A not in B, and trackId: null boxes, come from whichever of A/B is nearer in time
 */
export function boxesAt(sets: BoxSet[], t: number): Box[] {
  if (!sets || sets.length === 0) {
    return [];
  }

  const first = sets[0];
  const last = sets[sets.length - 1];

  if (t < first.t) {
    return first.boxes;
  }

  if (t > last.t) {
    if (t - last.t > 2000) {
      return [];
    }
    return last.boxes;
  }

  // Find interval [A, B] containing t
  let aIdx = 0;
  for (let i = 0; i < sets.length - 1; i++) {
    if (sets[i].t <= t && t <= sets[i + 1].t) {
      aIdx = i;
      break;
    }
  }

  const A = sets[aIdx];
  const B = sets[aIdx + 1];

  if (A.t === B.t) {
    return A.boxes;
  }

  const ratio = (t - A.t) / (B.t - A.t);
  const nearer = (t - A.t) <= (B.t - t) ? A : B;

  const bMapB = new Map<number, Box>();
  for (const b of B.boxes) {
    if (b.trackId !== null && b.trackId !== undefined) {
      bMapB.set(b.trackId, b);
    }
  }

  const result: Box[] = [];
  const matchedTrackIds = new Set<number>();

  // Gliding tracked boxes that exist in both A and B
  for (const bA of A.boxes) {
    if (bA.trackId !== null && bA.trackId !== undefined && bMapB.has(bA.trackId)) {
      const bB = bMapB.get(bA.trackId)!;
      matchedTrackIds.add(bA.trackId);
      result.push({
        ...bA,
        x1: bA.x1 + (bB.x1 - bA.x1) * ratio,
        y1: bA.y1 + (bB.y1 - bA.y1) * ratio,
        x2: bA.x2 + (bB.x2 - bA.x2) * ratio,
        y2: bA.y2 + (bB.y2 - bA.y2) * ratio,
      });
    }
  }

  // Untracked or non-paired boxes come from the nearer set
  if (nearer === A) {
    for (const b of A.boxes) {
      if (b.trackId === null || b.trackId === undefined || !matchedTrackIds.has(b.trackId)) {
        result.push(b);
      }
    }
  } else {
    for (const b of B.boxes) {
      if (b.trackId === null || b.trackId === undefined || !matchedTrackIds.has(b.trackId)) {
        result.push(b);
      }
    }
  }

  return result;
}

/**
 * Prune sets older than keepMs before newest.
 */
export function prune(sets: BoxSet[], newest: number, keepMs = 2000): BoxSet[] {
  const threshold = newest - keepMs;
  return sets.filter((s) => s.t >= threshold);
}
