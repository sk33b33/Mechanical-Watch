import type { Movement } from "@/domain/movement";
import { DESIGN_SCHEMA_VERSION } from "@/persistence/designFile";
import { VALIDATION_LEVEL_LABELS } from "@/reference/validationLevels";

/**
 * What the splash screen states about the design, derived from it (never hard-coded levels): the
 * declared validation level is the one the design itself declares (CLAUDE.md "Validation levels"),
 * and the physical-validation caveat is always shown (CLAUDE.md "Safety of claims").
 */
export function splashChips(movement: Movement): string[] {
  return [
    `Design schema v${String(DESIGN_SCHEMA_VERSION)}`,
    `Declares ${VALIDATION_LEVEL_LABELS[movement.declaredValidationLevel]}`,
    "Physical validation pending",
  ];
}

export function splashNote(movement: Movement): string {
  const demo = movement.isTeachingDemo ? "Teaching demo, not a production calibre. " : "";
  return `${demo}Geometry and kinematics only: the simulation is an approximation and nothing here is physically validated.`;
}
