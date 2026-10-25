import type * as THREE from "three";

/**
 * A wheel's printed face (the label ring, the moon phases, the season wedges, the year digits) is a texture that
 * the material's colour multiplies. When a body colour has been chosen (Colours flyout, ASM-0090) it is painted into
 * the texture itself and the material must stay white, or the printing is tinted by it, and a black body turns
 * everything printed on it black. Selection highlighting resets every material's colour to its part's base colour,
 * so a face whose colour must be kept is marked, and `restingColour` hands back the marked colour instead.
 */
const KEEP_COLOUR = "keepColour";

export function markKeepColour(face: THREE.Material, colour: number): void {
  face.userData[KEEP_COLOUR] = colour;
}

/** The colour a material shows when not selected: its marked colour if it has one, else its part's base colour. */
export function restingColour(face: THREE.Material, baseColour: number): number {
  const kept: unknown = face.userData[KEEP_COLOUR];
  return typeof kept === "number" ? kept : baseColour;
}
