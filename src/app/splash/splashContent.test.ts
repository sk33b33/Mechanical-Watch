import { describe, expect, it } from "vitest";
import { createTeachingMovement } from "@/app/teachingMovement";
import { createMovement } from "@/domain/movement";
import { DESIGN_SCHEMA_VERSION } from "@/persistence/designFile";
import { splashChips, splashNote } from "./splashContent";

describe("splash content", () => {
  it("states the schema version, the design's own declared level and the physical-validation caveat", () => {
    const m = createTeachingMovement();
    expect(splashChips(m)).toEqual([`Design schema v${String(DESIGN_SCHEMA_VERSION)}`, "Declares L2 Kinematic", "Physical validation pending"]);
  });

  it("calls the teaching movement a teaching demo and never claims physical validation", () => {
    const note = splashNote(createTeachingMovement());
    expect(note).toContain("Teaching demo, not a production calibre.");
    expect(note).toContain("nothing here is physically validated");
    expect(splashNote(createMovement("Empty", false))).not.toContain("Teaching demo");
  });
});
