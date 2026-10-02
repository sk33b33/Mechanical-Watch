import { describe, expect, it } from "vitest";
import { degrees } from "@/units/angle";
import { cutterCornerCenter } from "./trochoidFillet";

describe("cutterCornerCenter (SRC-0025 eq. 19-20)", () => {
  it("matches a hand-worked example (m=1, z=10, 20°, standard dedendum/fillet)", () => {
    // v = h_d - r_f = 1.25 - 0.38 = 0.87
    // xi = pi/4 - 0.87*tan(20deg) - 0.38/cos(20deg)
    const corner = cutterCornerCenter(1.25, 0.38, degrees(20), Math.PI / 4);
    expect(corner.v).toBeCloseTo(0.87, 12);
    expect(corner.xi).toBeCloseTo(Math.PI / 4 - 0.87 * Math.tan(degrees(20)) - 0.38 / Math.cos(degrees(20)), 12);
    expect(corner.xi).toBeCloseTo(0.064357, 5);
  });

  it("the corner moves closer to the tooth centerline (smaller xi) as the fillet radius grows", () => {
    const small = cutterCornerCenter(1.25, 0.2, degrees(20), Math.PI / 4);
    const large = cutterCornerCenter(1.25, 0.5, degrees(20), Math.PI / 4);
    expect(large.xi).toBeLessThan(small.xi);
  });

  it("v is exactly dedendum minus fillet radius, independent of pressure angle", () => {
    const corner = cutterCornerCenter(1.3, 0.3, degrees(14.5), Math.PI / 6);
    expect(corner.v).toBeCloseTo(1.0, 12);
  });
});
