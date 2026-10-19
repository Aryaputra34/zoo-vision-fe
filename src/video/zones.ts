export type Point = [number, number];

function isPoint(val: unknown): val is Point {
  return (
    Array.isArray(val) &&
    val.length === 2 &&
    typeof val[0] === 'number' &&
    typeof val[1] === 'number' &&
    !Number.isNaN(val[0]) &&
    !Number.isNaN(val[1]) &&
    val[0] >= 0 &&
    val[0] <= 1 &&
    val[1] >= 0 &&
    val[1] <= 1
  );
}

function isPointArray(val: unknown): val is Point[] {
  return Array.isArray(val) && val.length >= 2 && val.every(isPoint);
}

/**
 * Zones are found generically: any array of [x, y] pairs (numbers 0-1) in the active config's settings
 * is a line (2 points) or a polygon (3 or more).
 */
export function geometryOf(settings: unknown): { lines: Point[][]; polygons: Point[][] } {
  const lines: Point[][] = [];
  const polygons: Point[][] = [];

  function traverse(node: unknown): void {
    if (!node || typeof node !== 'object') return;

    if (isPointArray(node)) {
      if (node.length === 2) {
        lines.push(node);
      } else {
        polygons.push(node);
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        traverse(item);
      }
    } else {
      for (const key of Object.keys(node)) {
        traverse((node as Record<string, unknown>)[key]);
      }
    }
  }

  traverse(settings);

  return { lines, polygons };
}
