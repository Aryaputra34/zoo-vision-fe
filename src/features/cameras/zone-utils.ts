export type Point = [number, number];

/**
 * Clamps coordinates to [0, 1] range
 */
export function clampPoint(pt: [number, number]): [number, number] {
  const x = Math.max(0, Math.min(1, Number(pt[0].toFixed(4))));
  const y = Math.max(0, Math.min(1, Number(pt[1].toFixed(4))));
  return [x, y];
}

/**
 * Verifies that a polygon has at least 3 valid points
 */
export function isValidPolygon(points: [number, number][] | undefined | null): boolean {
  if (!Array.isArray(points)) return false;
  if (points.length < 3) return false;
  return points.every(
    (p) =>
      Array.isArray(p) &&
      p.length === 2 &&
      typeof p[0] === "number" &&
      !isNaN(p[0]) &&
      typeof p[1] === "number" &&
      !isNaN(p[1])
  );
}

/**
 * Generates an ID matching ^[A-Za-z0-9_-]{1,32}$ unique among existing IDs
 */
export function generateZoneId(prefix = "zone", existingIds: string[] = []): string {
  const cleaned = prefix.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 15) || "zone";
  let count = existingIds.length + 1;
  let id = `${cleaned}_${count}`;
  while (existingIds.includes(id)) {
    count++;
    id = `${cleaned}_${count}`;
  }
  return id;
}

export interface GeometryNode {
  path: string[];
  type: "polygon" | "line" | "polygon-list";
  title?: string;
  minRole?: string;
}

/**
 * Recursively find properties with x-geometry in JSON schema
 */
export function findGeometryNodes(
  schema: Record<string, unknown>,
  currentPath: string[] = []
): GeometryNode[] {
  const nodes: GeometryNode[] = [];
  if (!schema || typeof schema !== "object") return nodes;

  if (schema["x-geometry"]) {
    nodes.push({
      path: currentPath,
      type: schema["x-geometry"] as "polygon" | "line" | "polygon-list",
      title: (schema["title"] as string) || currentPath[currentPath.length - 1] || "Geometri",
      minRole: schema["x-minRole"] as string | undefined,
    });
    return nodes;
  }

  if (schema["properties"] && typeof schema["properties"] === "object") {
    const props = schema["properties"] as Record<string, Record<string, unknown>>;
    for (const [key, propSchema] of Object.entries(props)) {
      nodes.push(...findGeometryNodes(propSchema, [...currentPath, key]));
    }
  }

  if (schema["items"] && typeof schema["items"] === "object") {
    nodes.push(...findGeometryNodes(schema["items"] as Record<string, unknown>, currentPath));
  }

  return nodes;
}
