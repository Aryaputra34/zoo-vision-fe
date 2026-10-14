import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Rebuilding } from "./Rebuilding";

describe("Rebuilding", () => {
  it("renders the title and rebuilding notice with task code", () => {
    render(<Rebuilding title="Gerbang Kendaraan" task="T5" />);

    expect(screen.getByRole("heading", { name: "Gerbang Kendaraan" })).toBeDefined();
    expect(
      screen.getByText("Halaman ini sedang dipindahkan ke API baru (T5).")
    ).toBeDefined();
  });
});
