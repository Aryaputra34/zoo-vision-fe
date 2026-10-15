import { describe, it, expect } from "vitest";
import { clampPoint, isValidPolygon, generateZoneId } from "./zone-utils";

describe("zone-utils", () => {
  it("clamps coordinates to [0, 1] range", () => {
    expect(clampPoint([-0.5, 1.5])).toEqual([0, 1]);
    expect(clampPoint([0.34567, 0.89123])).toEqual([0.3457, 0.8912]);
    expect(clampPoint([0, 0])).toEqual([0, 0]);
    expect(clampPoint([1, 1])).toEqual([1, 1]);
  });

  it("enforces the 3-point rule for polygons", () => {
    expect(isValidPolygon(null)).toBe(false);
    expect(isValidPolygon([])).toBe(false);
    expect(isValidPolygon([[0.1, 0.1], [0.2, 0.2]])).toBe(false);
    expect(isValidPolygon([[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]])).toBe(true);
    expect(isValidPolygon([[0.1, 0.1], [0.2, 0.2], [0.3, 0.3], [0.4, 0.4]])).toBe(true);
    // Invalid point structure
    expect(isValidPolygon([[0.1, 0.1], [0.2, "bad" as unknown as number], [0.3, 0.3]])).toBe(false);
  });

  it("generates unique valid zone/table IDs matching ^[A-Za-z0-9_-]{1,32}$", () => {
    const idRegex = /^[A-Za-z0-9_-]{1,32}$/;

    const id1 = generateZoneId("table", []);
    expect(id1).toMatch(idRegex);
    expect(id1).toBe("table_1");

    const id2 = generateZoneId("table", ["table_1"]);
    expect(id2).toMatch(idRegex);
    expect(id2).toBe("table_2");

    const idWithSpecialChars = generateZoneId("Table #99!", ["table_1"]);
    expect(idWithSpecialChars).toMatch(idRegex);
  });
});
