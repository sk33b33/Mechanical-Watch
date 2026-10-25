import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { markKeepColour, restingColour } from "./printedFace";

describe("printed face colours (a black body must not blacken what is printed on it)", () => {
  it("an unmarked material shows its part's base colour when not selected", () => {
    expect(restingColour(new THREE.MeshStandardMaterial(), 0x336699)).toBe(0x336699);
  });

  it("a marked material keeps its own colour, even a white multiplier over a black body", () => {
    const face = new THREE.MeshStandardMaterial({ color: 0xffffff });
    markKeepColour(face, 0xffffff);
    expect(restingColour(face, 0x000000)).toBe(0xffffff);
  });

  it("a marked colour of 0 (black) is kept too, not mistaken for 'none'", () => {
    const face = new THREE.MeshStandardMaterial();
    markKeepColour(face, 0x000000);
    expect(restingColour(face, 0x123456)).toBe(0x000000);
  });
});
