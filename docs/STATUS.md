# Status

Validation levels use the L0–L5 scale from REF-ENG §15 (confirmed).

## Section view caps extended to hands; keyless-works parts don't fit this approach

Asked to close the keyless-works parts (stem, crown, pinions) next.
Investigated before writing code and found they're a different
geometric category from everything capped so far: every part covered
up to now (frames, arbors, gears, jewels, dial, escape wheel, balance,
fork) is a Z-extrusion — its axis runs vertically, along the shaft
axis, which is exactly what makes the line/circle/polygon intersection
in `sectionCap.ts` apply cleanly. The stem (and the rod, crown and
pinions rigidly attached to it) lies flat in a plane parallel to the
mainplate (ASM-0019) — a *horizontal* axis. Cutting a horizontal
cylinder or disc with a vertical plane generally produces an ellipse
or a skewed polygon, not a circle or polygon in the simple sense this
codebase's capping math handles; closing it properly needs real
conic-section (plane/quadric) intersection, a materially different and
harder-to-verify piece of geometry than anything built so far.

Flagged this to the user rather than either quietly doing the bigger,
riskier math or quietly picking something else instead of what was
asked. Given the choice between the full ellipse treatment, a
scoped/approximate version, or closing hands instead (the one
remaining part that *is* a straightforward Z-extrusion), chose hands.

- Hands (`createHandGeometry`) are a tapered quadrilateral with a
  small circular hub hole — extruded along Z, same shape family as a
  gear. Refactored out a pure `generateHandOutline`/`handHubRadius`
  pair (mirroring the gear/escape-wheel split) and registered the
  `polygonWithHole` footprint right where the hand mesh is built,
  reusing the same `rotationGroup`-tracks-the-shaft pattern as
  everything else.
- Verified against the live app as usual: read cap coordinates back
  out and confirmed the hours/minutes/seconds hands each land on a
  distinct, exactly-matching z-band (minutes sits 0.3mm lower than
  hours/seconds, matching their different `gapBelowMovementMetres`;
  every cap's z-span is exactly the hand thickness, 0.08mm), checked
  across four different cut angles, and confirmed cap data changes
  within 1s of simulated time (hands sweep continuously). All 387
  tests pass; `tsc --noEmit` and `eslint` are clean.
- Keyless-works parts remain the one documented gap — now with the
  reason recorded, not just "not done yet".

## Section view caps extended to the escapement

The biggest remaining "section view has no caps" gap: the escape
wheel, balance (rim + arms) and pallet fork (lever, two arms, two
stones) — the most geometrically varied parts yet, several pieces
built from multiple `BoxGeometry`s rather than one extruded profile.

- **Escape wheel**: same shape as a gear (tooth polygon minus a hub
  hole), so it reused the `polygonWithHole` footprint already built
  for gears. Refactored `createEscapeWheelGeometry` to extract a pure
  `generateEscapeWheelOutline` (mirroring the `generateGearOutline`
  split) plus `escapeWheelHubRadius`, so the cap and the real mesh
  can't drift apart.
- **Balance**: the rim is an annulus (circle minus a smaller circle),
  which needed a new footprint kind, `circleWithHole` — the same
  interval-subtraction math as `polygonWithHole`, just with a circle
  for the outer boundary instead of a polygon. The two arms are an
  axis-aligned box, extracted as `balanceArmHalfExtents` and expressed
  as a 4-point rectangle (the existing `polygon` kind, no new
  machinery needed).
- **Pallet fork**: the lever and its two arms are boxes translated
  then rotated around the pallet axis (not axis-aligned); the two
  pallet stones are boxes translated but not rotated. Added two small
  pure helpers to `sectionCap.ts`, `barFootprint` (a rectangle
  extending from the local origin along a given angle — covers the
  lever and both arms) and `squareFootprint` (an axis-aligned square
  at a given centre — covers the stones), fed by the exact same
  `(angle, length)` values already flowing into `createForkGeometry`,
  so there's no separate formula to keep in sync.
- Found and fixed a real bug from the first pass while working in this
  code: the gear cap's z-range applied `displayZ` (the exploded-view
  stretch) to `zCentre ± thickness/2` as a whole, which incorrectly
  stretches the gear's thickness during explode — every other part's
  cap (correctly) applies `displayZ` only to the centre position and
  adds the raw, unstretched thickness on top, matching how the real
  mesh is built (`mesh.position.z = displayZ(zCentre)` with a fixed
  local thickness baked into the geometry). Only visible with explode
  and section view on at once, which is why it wasn't caught the first
  time; fixed and now matches the established pattern.
- Verified the same way as the previous two passes: read live cap
  coordinates back out of the running app (temporary debug hook,
  removed before committing) and confirmed exact matches against the
  teaching movement's own escapement parameters — e.g. the escape
  wheel's z-range (2.325–2.475mm, from zCentre 2.4mm ± thickness
  0.15mm/2), the balance rim's z-range (2.85–3.15mm) versus its arms'
  narrower one (2.88–3.12mm, thickness × 0.8), and the pallet stones'
  z-range (2.2875–2.5125mm, thickness × 1.5) all matched to four
  decimal places. Also confirmed the cap data changes within 400ms of
  simulated time (the balance oscillates fast), so the live
  rotation-tracking still holds for the fastest-moving parts in the
  model.
- Added `assemblyGeometry3d.test.ts` for the new pure outline/extent
  functions, plus tests for `barFootprint`/`squareFootprint` in
  `sectionCap.test.ts`. All 384 tests pass; `tsc --noEmit` and
  `eslint` are clean.

## Section view caps extended to the dial

Picked the next "section view has no caps" gap to close: the dial.
Its disc is a `createZCylinder` circle positioned at its centre
shaft's solved axis, the same shape as an arbor or jewel, so this was
a small, well-contained addition on top of the existing cap
infrastructure (`src/geometry/sectionCap.ts`, `CappableSolid` in
`viewport.ts`) rather than new machinery: registered the dial's circle
footprint (radius = diameter/2, z = faceHeight to faceHeight +
thickness, no rotation group since the dial never spins) right where
its mesh is already built, next to the existing frame/arbor/gear/jewel
registrations.

The hour markers (small boxes, ASM-0020, cosmetic) are explicitly not
covered — scoped out deliberately, noted in a code comment, same as
hands/escapement/keyless parts remaining open.

Verified the same way as the first pass, not just by screenshot: read
the generated cap's coordinates back out of the live app (a temporary
debug hook, removed before committing) and confirmed they exactly
match the teaching movement's own dial parameters (±14mm chord for a
28mm-diameter dial centred on the origin, z = −1.8 to −1.4mm for a
0.4mm-thick dial at faceHeight −1.8mm). All 375 tests still pass;
`tsc --noEmit` and `eslint` are clean.

## Section view: filled cut faces for frames, arbors, gears and jewels

Closed the "section view has no caps" known limitation for the most
common parts: cutting through a solid used to show its hollow inside
(the clip plane discards geometry with nothing filling the hole); now
the cut face is filled.

- Every solid this app draws is a Z-extrusion of a 2D footprint, and
  the section plane is always vertical (`SectionState`), so a cap is
  exactly that footprint intersected with the cutting line, turned
  into a flat quad spanning the solid's Z range. Added a small, pure,
  unit-tested geometry module (`src/geometry/sectionCap.ts`:
  `lineCircleInterval`, `linePolygonIntervals`, `subtractIntervals`)
  rather than a GPU stencil-buffer trick — considered the standard
  Three.js stencil-capping technique first, but it relies on a
  precise, unfamiliar GPU state machine (depth-fail stencil ops) with
  no way to unit test it; the analytic approach is fully covered by
  `sectionCap.test.ts` and reuses this project's existing testable,
  pure-function style (`generateGearOutline`, `pointInPolygon`, …).
- Covers frames (circle or polygon outline), arbors (circle), gears
  (tooth polygon minus the bore hole — refactored the bore-radius
  formula into a shared `visualBoreRadius` so `createGearGeometry` and
  the new cap code can't drift apart) and jewels (circle, matching
  their existing "proud" z-offset). Hands, the dial, the escapement
  and keyless-works parts aren't covered yet — still show the old
  hollow clip (recorded in "Known limitations").
- A spinning gear's cut face has to track its rotation the same way
  the GPU clip already does, so caps are recomputed every frame while
  the section is on (cheap: a few dozen solids, simple 2D intersection
  math) rather than only on rebuild or when the section controls
  change.
- Verified by running the app (Playwright against the Vite dev
  server) rather than trusting the math alone: checked that the
  generated cap geometry's coordinates exactly match the domain
  model's own values (e.g. a gear cap's bore-edge x matches
  `visualBoreRadius` to the micrometre, a jewel cap's z-range matches
  its frame's "proud" offset, a frame cap's x-extent matches its
  circle outline's centre ± radius) rather than just eyeballing a
  screenshot, and that the cap data changes as the simulation runs
  (confirming the per-frame rotation tracking actually works, not just
  compiles). All temporary debug hooks used for this were removed
  before committing.
- All 375 tests pass (15 new); `tsc --noEmit` and `eslint` are clean.

## Dug further for the 6497-1's actual tooth counts; confirmed why they're not findable on the free web

Continued from the previous pass: asked to keep digging for a verified
tooth-count table specifically for the 2.5Hz/18,000bph ETA 6497-1
(as opposed to SRC-0022's table, already established to describe the
3Hz/21,600bph execution instead).

- Found independent confirmation of the 2.5Hz/3Hz split: a search
  result stated outright "the original ETA 6497 runs at 18,000 beats
  per hour, while the version that the [Seagull] ST36 is cloned after
  (the 6497-2) runs at 21,600" — the ST36 being the common Chinese
  clone that shares SRC-0022's exact tooth-count table. This lines up
  with, rather than just repeats, the arithmetic check from the last
  pass.
- Found a second, more specific confirmation that the escapement end
  genuinely differs between executions: a watchuseek thread
  specifically about ETA part 705 (the escape wheel ETA ships under
  one part number for both 6497 and 6498) states there are "at least"
  two tooth-count variants of that single part, "15 vs 20" teeth, with
  a possible pinion difference too. Couldn't read the thread directly
  (watchuseek now paywalls fetches via "tollbit"; a Wayback Machine
  fallback isn't reachable from this environment either) so recorded
  it unread (SRC-0023, Tier 7, not cited as settled) — but it
  independently corroborates that "the" 6497 escape wheel isn't one
  fixed number.
- Checked two parts catalogs directly (tztoolshop.com, a dedicated
  6497-1/6498-1 parts page; passionchrono.com, an individual
  fourth-wheel listing) to see whether a retailer catalog would state
  tooth counts for ordering purposes. Neither does — every wheel is
  listed by ETA's own part number only (e.g. "4th Wheel ... For ETA
  6497-1" #224/620), never by tooth count. That's a plausible
  explanation for why this number doesn't surface in web search at
  all: it's not published outside trade-only wheel-cutting references,
  or without directly measuring a real movement.
- One inference, not elevated to a citation: sources describing the
  2.5→3Hz upgrade path only mention swapping the escape wheel, escape
  pinion, fourth wheel, balance and mainspring — which would mean the
  centre wheel (80t) and third wheel (60t/10-leaf pinion) are shared
  between the 6497-1 and 6497-2. Plausible, but no source states this
  for the 6497-1 directly, so it wasn't applied to the code either.
- Net result: the real-caliber match for frequency/architecture
  (SRC-0021, from the previous pass) stands, now with a clearer
  picture of exactly where the gap is (the escapement-end tooth counts
  specifically) and why it's hard to close for free. Short of
  purchasing trade reference material or measuring a real 6497-1
  movement, I don't have a further free-web avenue to try — said so
  rather than stretching the evidence already found.

## Looked for a real caliber matching the teaching movement: found one for frequency, not tooth counts

Asked specifically to try matching the teaching movement
(`src/app/teachingMovement.ts`) to a real caliber, rather than leaving
its tooth counts illustrative (ASM-0009) by default.

- The teaching movement's architecture (barrel → centre → third →
  fourth (seconds) → escape going train; motion works; keyless works;
  18,000 bph / 2.5Hz escapement) is textbook-standard, and its
  frequency happens to match a real, specific, famous caliber: the
  ETA/Unitas 6497-1 — a large hand-wound pocket-watch movement
  explicitly known in the trade as a watchmaker *training* movement
  (per a secondary source), which fits the "teaching movement" framing
  rather well. Confirmed via ETA's own official technical
  communication PDF (SRC-0021, Tier 3, manufacturer documentation):
  18,000 A/h, 44° lift angle, 17 jewels, 46h reserve.
- That document is an assembly/lubrication manual, not a dimensional
  spec sheet — it has no gear tooth-count table at all. Found one
  candidate elsewhere (SRC-0022, a watchmaking-course site's "Unitas/
  ETA 6497" page): centre wheel 80t, third wheel 60t/pinion 10, fourth
  wheel 120t/pinion 8, escape wheel 15t/pinion 10.
- Before using those numbers, checked them with this codebase's own
  gear-train math (REF-ENG §5.3, ASM-0021) rather than taking them on
  faith: at 1 rpm on the fourth (seconds) arbor, a 120-tooth fourth
  wheel driving a 10-leaf escape pinion gives 12 rpm on the escape
  arbor; at 15 escape-wheel teeth that's 21,600 beats/hour (3Hz) — not
  the 18,000 bph (2.5Hz) the official 6497-1 document confirms and the
  teaching movement already uses. The source's own page agrees with
  this (it states 21,600 bph/3Hz itself), so it's internally
  consistent — just evidently describing a 3Hz execution (6497-2, or
  unmodified Unitas 6497), not the specific 18,000bph 6497-1 that
  matches our frequency. Also checked: the teaching movement's lift
  angle (50°) doesn't match the real 6497-1's 44° either.
- Per the rule to preserve conflicting evidence and its scope rather
  than silently resolve it (CLAUDE_REFERENCE_INSTRUCTIONS.md rule 12),
  recorded both sources but did **not** change any tooth counts in
  `teachingMovement.ts` — applying SRC-0022's numbers would claim a
  real-caliber match this project's own math says doesn't hold at the
  6497-1's actual frequency, which is exactly the kind of invented
  specification CLAUDE.md prohibits. The teaching movement's gears
  stay illustrative, satisfying the dial ratios by construction
  (ASM-0009), same as before.
- Net result: closer than before (a real, verified, well-matched
  caliber identified for the escapement frequency and the "teaching
  movement" framing itself) but not fully closed — an actual verified
  tooth-count table for the 18,000bph 6497-1 specifically (ideally an
  ETA parts/dimension sheet rather than a secondary site) would still
  be needed before the gear train itself could honestly claim to match
  a real caliber.

## Checked a recognized watchmaking textbook for bearing-clearance figures; none found

Went looking for a Tier 4 ("recognized watchmaking textbook", per
REF-ENG §1's source hierarchy) source for side-shake/endshake clearance
numbers, to see whether BRG-006/BRG-007 could move past their current
Tier 6/7 forum-testimony advisories.

- Found and read Moritz Grossmann's 1880 "Prize Essay on the
  Construction of a Simple and Mechanically Perfect Watch" (SRC-0020,
  same translator/host, watkinsr.id.au, as SRC-0019). Searched its
  "Jewelling" chapter and pivot-sizing discussion specifically.
- No numeric side-shake or endshake clearance figure appears anywhere
  in the text. What it does say (article 60) is that ordinary
  machine-design pivot-sizing rules don't apply to watch pivots, and
  that accepted sizes come from experience, not a stated formula — an
  authoritative 19th-century source explicitly declining to give the
  kind of number this project has been looking for. That's useful
  context (it helps explain why only forum testimony turns up this
  kind of figure) but doesn't change BRG-006/BRG-007's status.
- Registered as SRC-0020. No code or TRACEABILITY.md changes needed:
  the "acceptability UNKNOWN" / informational-only framing was already
  accurate and remains so.

## Searched for a horological source for the stem-mesh ratio; found one, doesn't close the gap

Went back to the one open gap SRC-0010 left on ASM-0019 (the right-angle
winding-pinion/crown-wheel mesh): the citation is closed for the
kinematic relation itself, but only against generic machine bevel-gear
sources, never a horological one. Searched specifically for a
watchmaking source about this exact mechanism.

- Found Bruno Hillmann's "The Keyless Mechanism: A Practical Treatise
  on its Design and Repair" (1910, English translation by Richard
  Watkins, 2004, hosted at watkinsr.id.au). Its first chapter is
  specifically "Gearing of the winding pinion with the crown wheel" —
  the exact mechanism ASM-0019 models, described in period repairman's
  terms (T the winding pinion, A the transmission wheel, gearing "at a
  right angle[s]").
- Read the available excerpt (26 pages, pdftotext — it has a real text
  layer). It discusses correct engagement at length (depthing, tooth
  shape, jamming defects) and explicitly ties bad engagement to "the
  ratio of the sizes of the mobiles" and mismatched tooth counts/pitch
  — consistent with the rolling-pitch-circle assumption this codebase
  makes — but never states a speed-ratio or turn-count formula in
  terms of tooth counts. So it's a genuine horological source about
  the right mechanism, but doesn't supply the relation itself.
  Registered as SRC-0019 anyway, per the instruction to keep evidence
  found rather than drop it for not fully closing the gap.
- Net effect: ASM-0019's citation status is unchanged (still generic
  machine-gear only for the actual formula) but the open decision in
  this file now reflects that a horological source for the mechanism
  exists and was checked, not just that none was looked for.

## Side-shake diametral convention (ASM-0013): supported by a source already on file

Re-read SRC-0011 (the NAWCC "Watchmaking tolerances" thread, already
registered for the BRG-006 endshake advisory) specifically for the
open "convention unconfirmed" note on ASM-0013: does "side shake" in
the horological community mean a diametral clearance (bore Ø − pivot
Ø, what `sideShake` computes) or a radial one (half that)?

- Dave Coatsworth's post gives a worked example: "the convention is
  one hundredth of a millimeter difference [between a balance pivot
  and its jewel hole]... a .12mm balance pivot would require a .13mm
  balance hole jewel." Both .12mm and .13mm are diameters, so their
  .01mm difference is arithmetically a diametral clearance by
  construction — supporting (not proving) that community "side shake"
  figures are already diametral, the same convention this codebase
  uses.
- No source actually says the word "diametral" or "radial" —
  re-checked SRC-0012's thread too, same absence. So this closes the
  question by inference from a worked example, not an explicit
  statement; recorded as such rather than overclaiming. Still Tier 6
  (forum testimony).
- Also cleaned up two stale notes found while re-reading: ASM-0028's
  description and `assemblyGeometry.ts`'s `sideShake` comment still
  said side shake "has no usable sourced range" / "acceptability is
  not judged", left over from before BRG-007/ASM-0029 (SRC-0012,
  SRC-0013) added the informal side-shake advisory. Updated both to
  point at BRG-007 instead of claiming nothing exists.

## Remaining REF-ENG §5 gear equations cited: centre distance, speed ratio, compound ratio, torque, pitch-line velocity

Continued from the pitch-diameter/balance-frequency/beats-per-tooth pass
below: went back through SRC-0014 (Wikipedia "Gear") more thoroughly and
through SRC-0009 (Wikipedia "Gear train", already registered for the
stem-mesh citation) to close the rest of REF-ENG §5.

- **Centre distance (a = m(z1+z2)/2).** SRC-0014's own "Pitch diameter"
  subsection states it directly: "the distance between the two axis
  becomes: a = m/2 (z1 + z2)".
- **Speed ratio, with direction (ω2/ω1 = −z1/z2).** SRC-0014's
  introduction states the magnitude (ω2/ω1 = N1/N2) as a direct
  consequence of the "ideal lever" mechanical advantage; its "Relative
  axis position > Parallel" subsection separately states "the two gears
  turn in opposite senses", closing the sign. SRC-0009 independently
  states the same magnitude relation (already registered for the
  stem-mesh citation).
- **Compound ratio (product of stage ratios).** SRC-0009's idler-gear
  derivation (R_final = R_AI · R_IB, the NI term canceling) is the same
  stage-product rule this project generalizes to an arbitrary train.
- **Torque, lossless case (T2 = T1·z2/z1).** SRC-0014's introduction
  states T2/T1 = r = N2/N1 for the ideal-lever case. The η < 1 real-mesh
  extension (ASM-0002) is not addressed by this source and stays an
  assumption/configured value, not externally verified.
- **Pitch-line velocity (v = ωr).** Not in SRC-0014; found a dedicated
  source instead — Wikipedia's "Tangential speed" article (SRC-0018),
  general circular-motion kinematics, applied here at the pitch radius.
- All of these are the pure kinematic/geometric relationships, not
  manufacturability claims, so CLAUDE_REFERENCE_INSTRUCTIONS.md rule 10
  (a generic machine-gear equation doesn't prove a horological gear is
  manufacturable) doesn't block citing a generic-gear encyclopedia
  source for them. None of REF-ENG §5 now rests solely on REF-ENG's own
  say-so; none of it is a primary standard either (still open, see
  below). All 360 tests still pass.

## Three more citation gaps closed: pitch diameter, balance frequency, two beats per tooth

Went back through the "External citations pending" open decisions and
closed three of them.

- **Pitch diameter (d = m z).** Wikipedia's "Gear" article (SRC-0014)
  states the general helical form d = N mₙ / cos ψ; the spur case used
  here (ψ = 0) is the same formula. This is the pure geometric
  definition of module, not a manufacturability claim, so a generic-gear
  encyclopedia source is fine for it (CLAUDE_REFERENCE_INSTRUCTIONS.md
  rule 10 is about manufacturing proof, not definitions).
- **Balance natural frequency (f = √(k/I)/2π).** Wikipedia's "Torsion
  spring" article (SRC-0015) states the same formula for a torsional
  harmonic oscillator. This closes the citation for the oscillator math
  itself; it is not evidence that a real balance/hairspring behaves as
  an ideal linear undamped oscillator — that physical-modeling
  assumption stays ASM-0024, unproven.
- **Two beats per escape tooth (ASM-0021).** Found a specialist
  horology page (SRC-0016, vintagewatchstraps.com) giving the actual
  watch/clock gear-train beats-per-hour design formula, which multiplies
  the escape wheel's tooth count by 2 and explains why: each tooth is
  released once at the entrance pallet and once at the exit pallet per
  revolution. Corroborated independently by a 2008 NAWCC forum post
  (SRC-0017) making the same claim for a pendulum clock escapement.
  Both are Tier 6/7 (informal), so ASM-0021 stays an accepted assumption
  rather than a verified fact — just no longer "source pending".
  **Conflict found and preserved, not hidden (rule 12):** Wikipedia's
  "Lever escapement" article has one sentence that reads, literally, as
  one tooth per beat rather than two. Recorded in SRC-0017's notes with
  the reasoning for not treating it as overriding: "drop" is a specific
  horological term (the small free rotation between release and the
  next locking), not a synonym for "advance"; the standard, widely-taught
  gear-train design formula and this codebase's own pallet geometry
  (ASM-0025, alternating entrance/exit pallets spanning k + ½ teeth)
  both mechanically require two releases per tooth pitch of travel.
- All 360 existing tests still pass; `registers.test.ts` (which checks
  `ASSUMPTION_REGISTER.md` against `src/reference/assumptions.ts`) is
  unaffected since only descriptive text changed, not IDs or status.

## Side-shake advisory (BRG-007): closing the gap BRG-006 left open

BRG-006 (endshake) shipped with side shake explicitly still unjudged —
the only figure found then (SRC-0011) was a single poster's
balance-staff-specific value, too thin to turn into a range. Went back
for side shake specifically.

- Found a better source: a NAWCC thread ("Jewel hole dimensions") where
  a poster gives a two-band rule — 0.01mm diametral side shake for a
  pivot up to 0.30mm, 0.02mm above that — credited to **Hans
  Jendritzki**, a real, named, WOSTEP-connected watchmaking instructor
  and author of "Watch Adjustment" (1961/1963), not an anonymous
  guess. Confirmed Jendritzki's book is real and well-regarded via an
  unrelated document (Dewey Clark's "Watch Adjustment" article, hosted
  on the same site as SRC-0011, independently: "the most complete work
  on watch adjustment"). A second, unconnected thread (a different
  forum, a different poster, watchrepairtalk.com) gives 0.01mm side
  shake for a 0.15mm pivot — agrees with the Jendritzki rule without
  either poster referencing the other.
- Still forum testimony, not the book itself — Jendritzki's book
  wasn't read directly, only a forum paraphrase of it. Registered as
  SRC-0012 (the rule) and SRC-0013 (the corroborating data point, not
  independently citable on its own). Same treatment as SRC-0011/
  BRG-006: a **low-confidence informational advisory**, never a
  pass/fail limit, following the precedent already set for endshake
  rather than re-litigating it.
- New rule **BRG-007** (info, `src/validation/rules/bearingRules.ts`):
  compares a shaft's computed side shake to the Jendritzki figure for
  its own pivot diameter (not a component-type split like BRG-006's
  escapement/train — this rule is keyed to the pivot size itself).
  New assumption ASM-0029. BRG-005's summary message and both
  inspector tooltips (side shake, endshake) were also corrected: they
  still said "no sourced range" / "not judged" for values that, since
  BRG-006, were already being informally advised — an inconsistency
  from when BRG-006 shipped, fixed now alongside BRG-007 rather than
  left for later.
- Updated SOURCES.yml, SOURCE_INDEX.md, TRACEABILITY.md,
  ASSUMPTION_REGISTER.md, RULE_IDS.md and their `src/reference/`
  mirrors. Three new tests in `assemblyRules.test.ts` (no advisory
  under the small-pivot figure; fires over it; a larger pivot compared
  to the looser figure, not the small one). Checked in a running
  browser too, not just asserted: the exact message text, citation and
  computed side-shake value all render correctly in the inspector and
  validation panel.
- 360 unit tests pass (357 before); browser/e2e suite unaffected (no UI
  structure changed, only text and a new info-level issue).

## The tutorial now builds the whole teaching movement, preloaded

Replaces the first cut of the guided tutorial (previous section below):
that one covered a two-arbor "opening workflow" stub with every field left
empty, same as normal part creation. Requested instead: walk through the
*real* teaching movement, with every part's fields already filled in from
it, so the walkthrough teaches the assembly process without also being a
data-entry exercise.

- **Scope: everything `createTeachingMovement()` builds.** 48 steps —
  3 frames, 13 arbors, 15 gears, 8 meshes, bearings on the 7 pivoted
  arbors, the friction clutch, the mainspring, keyless works, dial,
  escapement, and setting the drive to balance-governed. Rebuilt
  entirely from `src/app/tutorial/tutorialSteps.ts`.
- **Where values come from:** `tutorialSteps.ts` calls
  `createTeachingMovement()` once at module load and reads every part
  back out of it *by name* (frames/shafts/gears are looked up in their
  own typed collection, so the handful of names a shaft happens to
  share with one of its own gears — "Cannon pinion", "Crown wheel", …
  — are never ambiguous). Nothing is retyped or re-derived by hand;
  every preloaded number is the teaching movement's own.
- **How "preloaded" actually works:** a step's `createOverride` runs
  in place of the UI control's normal "create an empty part" action —
  same button, same click, but it builds the part with real values
  (and reuses the reference object's own id) instead of leaving every
  field blank. Wired into the three places that create parts: the
  component tree's "+ Mainplate/Bridge/Arbor/Keyless works/Dial/
  Escapement" buttons, the inspector's "Add gear" button, and the "This
  arbor winds" mainspring select — all three fall back to their
  ordinary empty-part behavior outside a matching tutorial step, so
  nothing changed for normal use.
- **A structural simplification, stated as one:** 7 arbors are placed
  by MESH_POLAR in the real design, which needs their mesh to exist
  first. The tutorial gives them FIXED coordinates instead — the same
  real, solved numbers (via `solvePlacement` on the reference), just
  not the same constraint mechanism — so "add the arbor" stays one
  action instead of "add it, then come back once it's meshed."
- **Meshes, the clutch and bearings still need a real choice, not just
  a click**, since selecting from a dropdown or filling a bore isn't
  something to preload: for meshes and the clutch there's exactly one
  valid candidate at each point in the build order, so the action is
  quick without being automatic; bearings stay genuinely unfilled
  (bore, pivot, shoulder span), because they're genuinely unset in the
  real teaching movement too — "preloaded" only ever means "matches
  what's actually there," never "invented to look complete."
- **New: `selectFromStep` and `deselect`.** With 48 steps spanning 15
  gears across 13 arbors, later steps routinely need a *different*
  part selected than whatever the previous action left selected (e.g.
  meshing "Barrel drum" right after creating "Centre pinion" stole the
  selection to the pinion). `TutorialStep.selectFromStep` names an
  earlier step whose created part should be reselected first;
  `AppStore` tracks each step's created id in `tutorialCreatedIds` and
  resolves the resulting selection once, after any auto-advance has
  already happened, to avoid a later step's resolution clobbering an
  earlier one's (or vice versa). `deselect` does the same for the one
  step that needs the movement-level section instead of any part
  (setting the drive).
- **Verified two ways:** a store-level test drives all 48 steps for
  real (via each step's actual override, or the same domain calls its
  UI control would make) and checks the result against
  `createTeachingMovement()` — not just entity counts, but the *same
  validation issues*, compared by rule/severity/message rather than
  raw id (meshes/jewels/the clutch get fresh ids from the ordinary,
  non-preloaded path, same as a real user would produce); e2e tests
  click through the real UI and check the actual preloaded field
  values and the mesh-step reselection. Screenshotted by hand too, not
  just asserted.
- 357 unit tests and 31 browser tests pass (was 357/30 — one net new
  e2e test; the unit-test count is unchanged because the old
  multi-test tutorial suite collapsed into one exhaustive walkthrough
  test replacing several narrower ones).

## Guided tutorial, and reusable part presets

Two workflow features, requested together: a walkthrough for building a
movement from scratch, and a way to stop retyping the same dimensions on
every part.

- **Guided tutorial (`src/app/tutorial/tutorialSteps.ts`,
  `src/app/panels/tutorialBanner.ts`).** A "Tutorial…" toolbar action
  starts a 10-step walkthrough: empty movement → mainplate → bridge →
  first arbor → its gear → second arbor → its gear → mesh them → bearings
  on both → check validation. Each step (but the last) is checked against
  the **domain model**, not a UI event — `isComplete(movement)` — so it
  advances whether the user clicks the highlighted control or does the
  same thing another way, and doesn't advance on a click that didn't
  actually change the design. Every step can also be skipped manually.
  Covers the opening workflow only, not a full caliber (no escapement,
  keyless works or dial steps yet) — stated in the module's own comment,
  not just here, and extending it is just appending to
  `TUTORIAL_STEPS`.
  - The pulsing glow on the current step's target control
    (`.tutorial-target`, `@keyframes tutorial-pulse`) is an explicit,
    confirmed exception to this app's usual "avoid decorative UI"
    (CLAUDE.md): everywhere else in the UI stays static; this is the one
    place asked for, and agreed, to draw the eye with motion.
  - Target elements are marked with a `data-tutorial="…"` attribute (new
    optional parameter on `actionButton`/`actionRow` and the component
    tree's own `addButton`) or reuse an existing `data-field`/
    `data-testid`. Only looked up in the main document — a control popped
    out into its own window (`layout/panelWindows.ts`) won't be
    highlighted there; stated as a limitation, not hidden.
- **Reusable part presets (`src/persistence/presets.ts`,
  `src/app/panels/inspector/presetsSection.ts`).** Every Shaft, Gear,
  Jewel and Frame inspector now has a "Presets" section: name the part's
  *current* values and save them, then apply that name's values to any
  other part of the same kind. Deliberately **not** built-in "reasonable
  defaults" — CLAUDE.md forbids inventing an engineering constant, and a
  typical pivot diameter or module is exactly that. Every preset value
  traces back to something a user typed into some part, at some point;
  applying one only overwrites the fields the preset actually set,
  leaving the rest of the part alone. Stored in the browser, independent
  of any design (like the project library, `persistence/library.ts`),
  with the same unreadable-store handling (set aside, never overwritten).
- New tests: `persistence/presets.test.ts` (6, the storage layer),
  `app/store.test.ts` (+6, the tutorial's auto-advance and manual-skip
  logic against real edits), `e2e/tutorial.spec.ts` and
  `e2e/presets.spec.ts` (3, the actual UI — highlight classes, banner
  text, preset save/apply/remove, survives a reload). 357 unit tests and
  30 browser tests pass (351 / 27 before).

## Endshake advisory (BRG-006): a low-confidence source, used carefully

- Bearing clearances (side shake, endshake) have been computed since the
  tolerance model shipped but never judged (BRG-005): no sourced
  acceptable range existed. Went looking for one.
- Found a NAWCC (National Association of Watch and Clock Collectors)
  forum thread, "Watchmaking tolerances," with concrete figures from two
  posters: escapement parts held to ~0.05mm endshake, train wheels to
  ~0.10mm (DeweyC, citing unnamed access to Hamilton factory production
  sheets), and a balance-staff-specific side-shake figure of ~0.01mm
  (Dave Coatsworth). `watchrepairtutorials.com`'s two directly relevant
  articles were found but returned a bot-challenge page to `curl`, not
  read.
- This is forum testimony, not a published standard — same tier as the
  existing Watchmaking.com source (SRC-0003). Decided explicitly (with
  the user) to use it as a **low-confidence informational advisory**
  rather than either inventing a harder rule from it or holding out for
  a better source: registered as SRC-0011, with the caveat quoted
  directly (one poster: *"manufacturing tolerances are very different
  from desired clearances like end shake — these often get confused"*).
- Implemented **only the endshake half**: the two component-linked
  figures (escapement vs. train) are concrete enough to compare against.
  The side-shake figure is a single point value from one poster for one
  component (balance staff) — not a range, and not enough to turn into a
  band without inventing one, so side shake still isn't judged (ASM-0013
  unchanged).
- New: `escapementShaftIds` (`src/domain/escapement.ts`) — like the
  existing `oscillatingShaftIds` but also includes the escape arbor, to
  tell "escapement parts" from train wheels for this purpose. New rule
  **BRG-006** (info, `src/validation/rules/bearingRules.ts`): fires when
  a shaft's computed endshake exceeds the informal figure for its kind
  (~0.05mm escapement, ~0.10mm train), quoting SRC-0011 and labeled
  "informational only" in the message itself, never blocking. BRG-005's
  message now distinguishes "side shake is not judged at all" from
  "endshake is only compared to an informal, unconfirmed reference
  figure." New assumption ASM-0028 records the whole thing, including
  that it's never a pass/fail limit. No UI changes needed: the
  validation panel already renders any issue generically by severity.
- Updated SOURCES.yml, SOURCE_INDEX.md, TRACEABILITY.md,
  ASSUMPTION_REGISTER.md, RULE_IDS.md and their `src/reference/`
  mirrors. Three new tests in `assemblyRules.test.ts` (no advisory
  under the train figure; fires over it; escapement shafts use the
  tighter figure via the teaching movement's balance staff).

345 unit tests and 27 browser tests pass (342 unit tests previously; the
new BRG-006 tests account for the difference — browser tests unaffected).

## Stem mesh ratio citation closed (SRC-0010)

- The user supplied two candidate papers directly and widened this
  environment's network policy further so they could be fetched.
  `rjwave.org/ijedr/papers/IJEDR1802006.pdf` (Hadani & Machhar 2018,
  IJEDR) was read and rejected: an FEM/AGMA tooth-bending-stress
  analysis, unrelated to the velocity-ratio claim and a weak source
  generally — its only relevant line asserts a "constant velocity ratio"
  between intersecting shafts without a formula.
- `jstage.jst.go.jp/.../jamdsm/20/2/20_2026jamdsm0019` (Nie, Jiang, Han &
  Geng 2026, Bulletin of the JSME / JAMDSM, peer-reviewed, DOI
  10.1299/jamdsm.2026jamdsm0019) was read and does close the citation:
  §4 states, for a pinion/gear pair in line-conjugate (bevel) mesh, i₁₂ =
  ψ2/ψ1 = z1/z2 — the transmission ratio is the inverse tooth-count
  ratio, the same relation as for spur gears, but stated here for an
  intersecting-axis pair. Recorded as SRC-0010.
- This closes the ASM-0019 citation that SRC-0007 (ISO 23509) and
  SRC-0008 (SDP/SI) were recorded for; both are superseded and remain
  unread. SRC-0009 (Wikipedia's Gear train, read previously) still only
  supports the general spur-gear case, now superseded for this purpose
  too. Updated TRACEABILITY.md, SOURCES.yml, SOURCE_INDEX.md and the
  code comment on `crossedMeshSpeedRatio` (`src/math/gearMath.ts`)
  accordingly. Per CLAUDE_REFERENCE_INSTRUCTIONS.md rule 10, SRC-0010 is
  still a generic-machine-gear source, not a horological one — the
  keyless-works winding/contrate tooth forms in this codebase remain
  unvalidated against any horological reference, unchanged from before.
  No equation, test, or validation rule changed.

342 unit tests and 27 browser tests pass (unchanged).

## Wikipedia added as a source: partial citation for the stem mesh ratio

- This environment's network policy was updated to allow wikipedia.org
  (previously all three candidate-citation sites for ASM-0019 were
  blocked or paid). Re-checked sdp-si.com: still blocked. ISO 23509 is
  still paid, so it wasn't fetched either way.
- Read Wikipedia's Gear train and Bevel gear articles for the pending
  right-angle (stem) mesh citation (`crossedMeshSpeedRatio` in
  `src/math/gearMath.ts`, ASM-0019). Gear train gives the general
  tooth-count speed ratio for meshing gears (from the ratio of
  pitch-circle radii) but scopes its derivation to spur/parallel-axis
  gears; Bevel gear is descriptive and has no quantitative ratio formula
  at all. Neither states the relation extends to a crossed-axis mesh.
- Recorded Wikipedia's Gear train article as SRC-0009 (read), supporting
  the general kinematic principle behind `crossedMeshSpeedRatio` — equal
  contact-point velocity implies a tooth-count ratio — without closing
  the citation for applying it to a crossed-axis mesh specifically. Per
  CLAUDE_REFERENCE_INSTRUCTIONS.md rule 12, both the supported claim and
  its scope limit are recorded rather than treating this as a full
  citation. SRC-0007 (ISO 23509) and SRC-0008 (SDP/SI) remain the
  candidate citations for the crossed-axis extension, both still unread.
  TRACEABILITY.md, SOURCES.yml, SOURCE_INDEX.md and the code comment on
  `crossedMeshSpeedRatio` are updated accordingly. No equation, test, or
  validation rule changed.

342 unit tests and 27 browser tests pass (unchanged).

## Elevation drawing, and tolerances on gear/placement dimensions

- **Elevation drawing (`src/outputs/drawing/elevationDrawing.ts`).** A
  second technical drawing alongside the plan: an orthographic
  projection onto the X-Z plane (horizontal X, vertical Z, the shaft-axis
  direction, ASM-0006), viewed along Y. It draws frame bodies across
  their outline's X-extent at their Z-range, each arbor's centreline over
  the axial span it actually occupies, gear and escapement bodies at
  pitch/tip diameter and thickness (REF-ENG §6 defines no tooth profile),
  bearing markers flush with their frame's inner face (ASM-0011), the
  dial as a hidden band, and an overall-height dimension. Parts at
  different Y overlap in this single-direction view, and the keyless
  works, stem and dial hand pipes aren't shown (the stem has no single
  faithful elevation here) — both stated limitations, not silent gaps.
  Exported as SVG and DXF (`elevation-svg`, `elevation-dxf`), from the
  Outputs dialog and in the engineering report (new §4, renumbering the
  sections after it).
- **The plan and elevation renderers are now generic** (`viewLabel` on
  the shared drawing type, plus two new layers, `GEAR` and `JEWEL`, for
  the elevation's gear/escapement bodies and bearing markers); the plan
  builder is unchanged in what it draws.
- **New toleranceable dimensions:** `GEAR_MODULE` (per gear) and, only
  for a **FIXED**-placement shaft, `SHAFT_POSITION_X` / `SHAFT_POSITION_Y`
  (a solved MESH_POLAR or COAXIAL position stays untoleranced — its
  variation isn't chained through here, ASM-0027). Both appear in the
  existing generic tolerance UI (gear and shaft inspectors) with no new
  UI code.
- **Mesh centre-distance stack (`meshCentreDistanceStack`,
  `src/assembly/toleranceAnalysis.ts`).** A first-order (Taylor)
  expansion around the placement solver's own distance: exact for the
  module term (distance scales linearly with it; only the driving gear's
  declared module tolerance is read, since GEAR-003 requires one shared
  module) and a linear approximation for a FIXED shaft's position term (a
  direction cosine along the mesh's centre line, matching the same
  one-directional worst-case approach already used for side shake and
  endshake). Registered as ASM-0027. `evaluateStack`'s `StackTerm` gained
  an optional `scale` (a signed coefficient, not just ±1), used here and
  left at its default (1) everywhere else.
- **Where it shows up:** the gear inspector (a "Centre distance (tol.,
  with …)" row per mesh); the movement report's Meshes table (a "Worst
  case (tol., ASM-0027)" column, only once something is toleranced) and
  each gear's component report; the plan drawing's centre-distance
  dimension (appends "· tol min…max"); TOL-002 now also warns if a
  mesh's worst-case centre distance could reach zero; MFG-001's summary
  now mentions it.
- **On the elevation drawing:** an arbor with a toleranced endshake gets
  a dimension beside its centreline, from its lower bearing's face to its
  upper's, reusing the existing `endshakeStack` (no new derivation).
- The design file decoder's tolerance-dimension enum gained the three
  new values (a real fix: without it, saving a design with one of these
  tolerances and reloading it would fail to decode). No schema bump: the
  `Tolerance` record's shape is unchanged, only which dimension strings
  it accepts.

342 unit tests and 27 browser tests pass.

## Workspace: panel windows and focus view

- Each side panel (Components, Inspector, Validation) has a title bar
  with controls: dock, float over the movement, open in its own browser
  window (e.g. on a second screen), or hide.
- Floating panels are dragged by the title bar and resized from the
  corner, and always keep their title bar on screen.
- A separate window shares the page's styles and stays live. Selecting in
  the main window updates it, edits made in it change the design, and
  undo/redo shortcuts work there too. Closing it docks the panel back. If
  the browser blocks the window, the panel floats instead and says why.
- The header has a button per panel (hide, or reopen where it was) and
  **Focus**, which hides the docked panels so the movement fills the
  window. Panels opened in focus view float.
- The simulation readouts (time, dial reading, spring wind and reserve)
  moved from the toolbar onto the viewport, so the toolbar no longer
  overflows at 1400 px and the readouts stay visible in focus view.
- Docked panels resize by dragging their inner edge (the one facing the
  movement). The handle also takes the arrow keys (Shift for bigger
  steps, Home/End for the limits); double-click restores the default
  size. Each panel has a minimum size, and the movement view never
  shrinks below 320 × 200 px. When the browser window gets smaller the
  panels give way, and they return to the chosen sizes when it grows.
- The layout is remembered per browser. A separate window reopens in the
  page after a reload, since browsers only open windows on a click.
- SIM-003's wording no longer says no power reserve is modeled; it now
  points to the separate simplified energy model.

319 unit tests and 25 browser tests pass.

## Pallet geometry (L1) and the energy chain (L3)

- **Pallet geometry (ASM-0025).** Optional per escapement: span in
  teeth, lock, draw and run angles. The pallets lock on the escape
  wheel's tip circle at two points (k + ½) pitches apart, and the pallet
  arbor must sit where the tangents at those points meet, R / cos(span/2).
  ESC-104 flags a whole-tooth span, a span of 180° or more and a pallet
  arbor off that distance. ESC-105 flags lock and run that leave no
  impulse within the lever angle, and warns about a draw angle that isn't
  positive. Whether the draw overcomes friction is not checked. The
  viewport puts the pallet stones on the locking points.
- **Mainspring data (ASM-0026).** Optional on the mainspring link:
  usable turns, torque fully wound and let down (linear between them),
  and an optional train efficiency (ASM-0002, now Active). Without an
  efficiency, torques are the lossless upper bound, and are labelled so.
- **Energy chain.** Power reserve from the drum's running speed; escape
  wheel torque by power balance through the train; energy per beat =
  torque × π/z × escapement efficiency; steady amplitude where the energy
  in per period balances the loss 2πE/Q, A = √(2 Q E_beat / (π k)). The
  balance stops once the amplitude falls to half the lift angle, which
  gives a stop wind and a running reserve. SPR-001 checks the spring
  data, SPR-002 reports the chain and names what the amplitude still
  needs, SPR-003 warns when the balance stops before let-down (error when
  it cannot start even fully wound).
- **No invented losses.** Q and the escapement efficiency can only come
  from measurement or a source, so the teaching movement leaves both
  unknown. It shows the reserve (39 h) and the lossless escape torque,
  and keeps its declared amplitude.
- **Simulation.** The mainspring's state of wind is simulation state,
  starting fully wound. The running drum unwinds it; winding at the crown
  winds it, clamped at let-down and fully wound. A balance-governed
  movement stops at the stop wind (or at let-down when the amplitude
  can't be predicted): the balance rests and the fork lies on a banking.
  Winding above the stop restarts it (the model assumes it self-starts).
  The stop is checked before every fixed step, so it happens at the same
  step however frame time is split (SIM-002). An imposed drive (nominal
  time, prescribed) keeps turning when let down. The toolbar shows the
  wind and the running time left; when predicted, the displayed amplitude
  follows the wind (A ∝ √T).
- **Outputs.** The escapement's component report and the movement
  report add the pallet values (L1) and the energy chain (L3) with their
  equations. The BOM lists the pallet angles and the spring data.
- Design files move to schema 7.
- The movement's declared level stays capped at L2.

303 unit tests and 20 browser tests passed at that point.

## Balance dynamics: simplified dynamic model (L3)

- **Inputs.** The balance takes an optional moment of inertia (mg·cm²)
  and hairspring stiffness (µN·mm/rad), stored in SI. Empty means
  unknown, and the model stays kinematic. They are entered directly;
  nothing is derived from material or hairspring geometry.
- **Model.** A linear, undamped torsional oscillator: f = √(k/I)/2π
  (ASM-0024). It is isochronous by construction. Amplitude, escapement
  disturbance, position, temperature and damping are not modeled, so it
  is not a complete regulator model.
- **The balance governs.** A new drive, "Governed by the balance", sets
  the escape arbor to one tooth per balance period (ASM-0021), turning
  the way that runs the hands forward. The train follows, so the hands
  run fast or slow by however much the balance differs from what nominal
  time needs.
- **Derived.** Free frequency, the frequency nominal time needs, the
  hairspring stiffness that would give it for the entered inertia, and
  the predicted daily rate (s/day). BAL-002 reports them at L3, with the
  limits stated. BAL-001 checks the inputs and that a balance-governed
  drive can run.
- **Teaching movement.** Now governed by its balance: 10 mg·cm² and
  246.7 µN·mm/rad (illustrative, ASM-0009) give 2.4998 Hz against the
  2.5 Hz nominal needs, so the model predicts about −7 s/day. The
  stiffness is deliberately a rounded entered value, not solved from the
  train. Tests of exact nominal speeds use an explicit nominal-time
  variant.
- The movement's declared level stays capped at L2. Only the balance
  model is L3; the train still has no torque or energy model.
- Design files move to schema 6.

272 unit tests and 16 browser tests pass.

## Phase 5 — Escapement: simplified kinematic model

A Swiss lever escapement labelled SIMPLIFIED ESCAPEMENT MODEL (ESC-001),
at the kinematic level (L2):
- **Rate.** Two beats per escape tooth (ASM-0021, a declared assumption
  with the source pending, accepted). The beat rate and the balance
  frequency the train requires come from the escape arbor's speed. The
  teaching movement gives 18 000 beats/h and 2.5 Hz (escape arbor at
  10 rev/min, 15 teeth).
- **Balance.** A sinusoidal swing at a declared amplitude (ASM-0022). No
  inertia, hairspring or damping is modeled, so the amplitude is an
  input, and the balance does not set the rate: the drive does.
- **Ticking.** The going train is shown locked between beats and released
  in an impulse window. The window is the share of each swing spent
  within half the lift angle of the dead point, so it follows from lift
  angle and amplitude. The pallet fork crosses between its bankings in
  the window (ASM-0023). The simulation keeps the average motion; the
  ticking is a derived display, so hand readings and measurements are
  unaffected. While the crown sets the hands, they move freely and the
  going train keeps ticking.
- **Validation.** ESC-001/002 state the model level and what it does not
  claim. ESC-101 checks references and inputs (amplitude above half the
  lift angle). ESC-102 flags a gear-driven pallet arbor or balance.
  ESC-103 checks clearances. The oscillating arbors are no longer
  reported as unpowered.
- **UI and outputs.** An inspector section with the derived beat rate,
  balance frequency and impulse window, "+ Escapement", and a viewport
  label. The escape wheel, fork and balance are drawn with visual
  shapes. The report, BOM and plan drawing include the escapement; the
  hairspring, roller and stones are listed as not modeled.
- **Teaching movement.** Adds a balance cock, pallet arbor and balance
  staff with jewels, and a 15-tooth escape wheel (tip Ø 4.6 mm). The
  amplitude (270°), lift (50°) and lever angle (10°) are illustrative
  inputs (ASM-0009), not sourced values.

258 unit tests and 15 browser tests pass.

## Browser test suite: added

`npm run test:e2e` runs 12 Playwright tests against the production build
(see docs/ARCHITECTURE.md, Testing). Writing them exposed one bug, now
fixed: a field that commits its unchanged value again on blur added a
second, identical undo step, so one edit could need two undos. Edits
that change nothing are no longer recorded.

## Dial and keyless works: complete

- **Model.** Keyless works (stem direction and height, winding pinion,
  sliding pinion, crown wheel, setting wheel, ratchet wheel), a dial (a
  disc on the dial side, centred on an arbor), and a mainspring link from
  the barrel arbor to its drum. The mainspring carries no energy; it
  fixes which way winding turns the arbor (ASM-0018). Schema 4.
- **Right-angle meshes (ASM-0019).** The stem lies flat. Its pinions
  engage their wheels at right angles, modeled as rolling pitch circles:
  the ratio comes from tooth counts, the direction from the layout (stem
  above or below the wheel). Derived and checked against an independent
  3D velocity test. KEY-002 checks each engagement geometrically: the
  wheel's axis on the stem line, and the stem one pitch radius from the
  wheel.
- **Setting through the crown.** Crown out: the sliding pinion drives
  the setting wheel → minute wheel → cannon pinion, the friction clutch
  slips, and the going train keeps time. The hands' speed follows from
  the ratios (teaching movement: 2 minute-hand turns per crown turn).
- **Winding.** Crown in: turned the winding way, the ratchet teeth drive
  the winding pinion → crown wheel → ratchet wheel → barrel arbor. The
  winding way is derived: the one that turns the arbor the way the drum
  runs. Turned the other way, the teeth slip and nothing is wound. The
  click holds the ratchet otherwise, and a running train that turns the
  ratchet is reported (KEY-003).
- **UI.** The toolbar modes are Running, crown out (set forward or
  backward), and crown in (wind, or turn backward). The crown turns at
  1 rev/s. The inspector shows the stem, pinions, wheel choices,
  engagement errors, winding direction and crown ratios, and there is a
  mainspring editor on arbors. The viewport draws the dial with hour
  markers (it can be hidden), hands below the dial face, and the stem,
  crown and pinions turning; the crown moves out when pulled. Without
  keyless works, setting still turns the minutes hand directly.
- **Validation.** KEY-001…004 and DIAL-001…003 (dial dimensions, clear
  of everything it covers, every hand over it).
- **Outputs.** The report has a crown section and component reports for
  the keyless works and dial. The BOM lists the stem, crown, pinions,
  lever/yoke and click (unmodeled parts marked so) and the dial. The plan
  drawing shows the dial as a hidden outline and the stem with its
  pinions edge-on. The STL includes the dial.
- **Teaching movement.** It gains a barrel arbor with a 40-tooth ratchet
  wheel and mainspring, a 20-tooth crown wheel, a 16-tooth setting wheel
  meshing the minute wheel, a stem at 3 o'clock (winding pinion 14,
  sliding pinion 20, module 0.1) and a 28 mm dial. All values are
  illustrative (ASM-0009). The ratchet and crown wheel sit just above the
  mainplate, with the crown wheel above the stem, so the winding pinion
  (14 teeth) engages it from below. The derived winding direction is
  clockwise seen from the crown.

233 tests pass. Checked in a browser:
- setting through the crown (3 h of hand motion in 1.5 s);
- winding, and the slipping notice when turned backward;
- the dial view with the crown at 3 o'clock, and the dial hidden;
- the stem, crown and pinions turning.

## Phase 6 — Engineering outputs: complete (Phase 5 not started)

Phase 6 was done before Phase 5 because it needs no new engineering
data. Phase 5 is waiting on a source for the escape-wheel/beat
relationship.

- **Tolerance model (REF-ENG §14).** Pivot and bore diameters, shoulder
  span, and frame position and thickness can carry a tolerance: signed
  lower/upper deviations from the model's own nominal, plus distribution,
  source and "checked against". A new tolerance starts with empty limits;
  no default band is assumed. Side shake and endshake get worst-case
  stacks (min … max), and each stack says whether all, some or none of
  its inputs are toleranced (ASM-0017). New rules:
  - TOL-001: a tolerance must be well formed;
  - TOL-002: warns when a nominally positive clearance can close within
    the declared tolerances;
  - MFG-001: a reminder that tolerances are declared intent and
    everything else is nominal.

  Design files move to schema 3, with a v2 migration.
- **Outputs… (toolbar)** lists each format with the model level it
  represents:
  - **Engineering report** (HTML, open or download, printable). It opens
    with a claims box: declared level and whether it is met, issue
    counts, tolerance status, and "manufacturing readiness: not
    validated (MFG-002)". Then validation, the gear train (ratios, ideal
    and placed centre distances), arbor speeds and directions, the plan
    drawing, BOM, tolerances, per-part component reports (entered
    parameters, then derived values with equation, level and basis) and
    the assumption register, with cited entries marked.
  - **Bill of materials** (CSV): one row per modeled part, with gears
    nested under their arbor. Material is "not specified", and a clutch
    is a note, not a part.
  - **Plan drawing** (SVG and DXF R12): frame outlines, axes (coaxial
    arbors share one mark), pitch circles, and centre-distance
    dimensions (the ideal distance is added when the placed one
    differs), plus a gear table. It is nominal and labelled "not a
    manufacturing drawing". The scale is chosen to fit a page; the DXF
    is 1:1 in mm.
  - **Visual mesh** (STL, mm): frames and gears as drawn, labelled L0,
    because tooth shapes are visual (ASM-0005).
  - **Solid model** (STEP): listed as unavailable. It would need a
    B-rep kernel and real tooth profiles; a pitch model has no flank to
    export.
- Every output is a pure function of the design model and its analysis.
  None reads the viewport.

203 tests pass. Checked in a browser:
- entering pivot and bore dimensions and their tolerances (TOL-001 while
  a limit is empty, TOL-002 when the worst case closes the side shake);
- downloading every format, and opening the report and drawing;
- STEP disabled with its reason.

## Phase 4 — Watchmaker workspace: complete

- **Measurement tool.** Measure, then pick two parts (viewport or tree).
  The values come from the design model and solved placement, never
  from rendered meshes. Each row states its model level and basis
  (hover):
  - axis distance;
  - axial gap or overlap;
  - pitch-circle clearance (L1);
  - drawn tip clearance for unmeshed gears (L0, ASM-0005);
  - for meshed pairs, ideal centre distance and deviation.
  A line marks the measured pair.
- **Exploded view.** A slider spreads parts along the shaft axes,
  stretching positions but not thicknesses.
- **Section view.** A vertical cutting plane set by angle and offset, or
  placed through the selected part's axis.
- Both views are **display only**. They never change the design,
  validation or measurements (checked: measured values are identical
  when exploded).
- **Project library.** Projects… lists designs saved in this browser,
  with save, open (undoable) and delete. Entries that can't be opened
  stay listed with the reason, and a damaged library is set aside, not
  overwritten. Downloaded files remain the durable copy.
- The assembly tree and validation console from earlier phases complete
  the workspace. The toolbar now fits down to 1280 px without scrolling
  the page.

159 tests pass. Checked in a browser: measuring meshed gears and
frames, explode and section (including through a selected arbor), and
saving, switching, reloading and deleting library projects.

## Phase 3 — Kinematic movement: complete

- **Time display as the requirement.** Arbors can carry the hours,
  minutes or seconds hand. TIME-002 checks the train's ratios against a
  12-hour dial (1 : 12 : 720, all clockwise from the dial) and reports
  the period a wrong hand would actually have. These rates are
  definitions of reading a dial (ASM-0014), not watch specifications.
- **Nominal-time drive.** Besides a prescribed arbor speed, the train
  can run "at nominal time": the minutes hand is prescribed at 1 rev/h
  and every other arbor's rotation (barrel, escape arbor…) is derived
  and shown in its inspector. A prescribed drive reports how far from
  nominal the hands run (TIME-004).
- **Motion works as a separate subsystem (REF-ENG §8).** Coaxial
  placement, parts carried on another arbor or on a stud, and friction
  clutches. Running: the clutch turns with its arbor. Setting the hands:
  the clutch slips, the hands move at 1 h per second, and the going
  train keeps its running speed (ASM-0015). SET-001 warns when the hands
  can't be set without turning the train, and CPL-001 requires a
  clutch's two parts to be coaxial.
- **Teaching movement (new default).** Barrel 72 → centre pinion 12;
  centre wheel 80 → third 10; third 75 → fourth 10; fourth 80 → escape
  pinion 8. Motion works: cannon pinion 10 → minute wheel 30, minute
  pinion 8 → hour wheel 32 (10 + 30 = 8 + 32, so the coaxial cannon
  pinion and hour wheel share one centre distance). At nominal time the
  barrel turns once per 6 h, the fourth arbor once per minute and the
  escape arbor once per 6 s. It validates with no errors or warnings.
  All values are illustrative (ASM-0009). The escape wheel itself is
  not modeled (not a gear; Phase 5).
- **UI.** Mode switch (running / set hands forward / backward), dial
  reading from the simulated hand angles, hands drawn on the dial side
  (visual only, ASM-0016), bridge-side and dial-side views, inspector
  controls for hand, support, coaxial placement, clutches and drive.
- **Save format v2**, with a migration that opens v1 files unchanged in
  meaning.

145 tests pass. Checked in a browser: 60× playback, hand setting
forward and backward (hands advance hours while the seconds hand keeps
time), removing the clutch (SET-001, setting refused), undo, the dial
view, and opening a schema-1 file saved in an earlier session.

## Working tool: save/load, simulation controls, building from scratch — complete

- **Save / Open / autosave.** Versioned JSON (schema 1). Invalid
  entries survive a round trip unchanged. Foreign files, newer versions
  and malformed files are rejected with the exact path of the problem.
  Every change autosaves to the browser, and an unreadable autosave is
  set aside, not overwritten.
- **Simulation controls.** Play/pause, single step, reset, playback
  speed 0.1× to 60×, and a simulated-time readout. The simulation still
  advances in fixed steps.
- **Drive editing.** Make any arbor the drive, set its speed in rev/min,
  or remove it (SIM-001 when the speed is missing; KIN-001 info when
  there is no drive).
- **Build from scratch.** New → Empty movement or Demo template. Add a
  mainplate, bridge or arbor from the component list, and add gears,
  meshes and bearings from the inspector. New parts start empty and
  validation lists what is missing.
- **Editing.** Rename anything. Edit frame outlines (circle or polygon
  points), kind, height and thickness. Switch an arbor between fixed
  coordinates and mesh-centre-distance placement, and choose its mesh.
  Change bearing type. Set the movement's name and declared level (L0–L2;
  higher levels are disabled because no model supports them).
- **Delete and undo.** Deleting removes owned parts; other shafts'
  constraints are left and reported, never re-placed silently. Undo/redo
  (toolbar, Ctrl+Z / Ctrl+Shift+Z) covers every edit, delete, New and
  Open.

121 tests pass, including one that builds a valid two-arbor movement from
an empty one. Checked in a browser by building a complete movement from
scratch through the UI to zero errors, then deleting, undoing and
redoing.

## Phase 2 — Movement assembly: complete

- **Placement constraints.** A shaft is either FIXED or placed at a
  mesh's ideal centre distance from a reference shaft (MESH_POLAR).
  Positions are solved in dependency order. Changing tooth counts or
  module moves dependent shafts because the user declared the
  constraint. Cycles, dangling references and invalid meshes are
  reported (ASSY-001), never guessed.
- **Frames.** Mainplate and bridges are flat slabs (ASM-0010) with
  circle or polygon outlines, a height and a thickness.
- **Bearings.** Jewels (or plain holes) support each shaft end in a
  frame. They sit on the shaft's solved axis, so a shaft's two bearings
  are always coaxial. Pivot diameters, bores and shoulder span are
  optional: unknown stays null, and side shake and endshake are computed
  only from values actually given. They are never judged against a
  range, because no range has a source (BRG-005).
- **Wheel placement in 3D.** Every gear has an axial position. Meshing
  requires axial overlap (GEAR-101).
- **Interference (ASSY-002) in 3D.** It covers:
  - unmeshed gears at the same height;
  - two gears on one arbor;
  - a gear inside a frame slab;
  - a wheel crossing another shaft's arbor.
- **Viewport.** Frames, arbors, jewels and gears drawn at their solved
  positions and heights. Click any part to select it. Parts with unknown
  sizes are drawn at placeholder sizes (ASM-0012).
- **Inspector.** Sections for gears, arbors (placement, pivots,
  clearances), bearings and frames. The tree groups parts under their
  arbors, and clicking an issue selects the part it concerns.
- **Demo.** A three-arbor compound train (60/10, 48/8, plus an output
  wheel) in a mainplate and one bridge. All dimensions are illustrative
  (ASM-0009), bearing dimensions are unknown, and it validates with no
  errors or warnings.

89 unit tests pass, typecheck, lint and build are clean, and it was
checked in a browser: edits propagate through placement, unknown
dimensions round-trip, and picking and issue selection work.

## Earlier work

- Milestone 1 / Phase 1: gear math, gear-train solver, viewport,
  inspector, validation console.
- Reference-pack alignment: rule IDs, severities, cited bases, no
  invented constants, deterministic simulation, assumption register,
  traceability (`reference/TRACEABILITY.md`).

## Open decisions

- **Sources for the teaching movement's tooth counts — real-caliber
  match confirmed for the frequency, the gear train stays open after a
  thorough search.** The teaching movement's escapement frequency
  (18,000 bph / 2.5Hz) matches a real, specific, well-documented
  caliber: the ETA/Unitas 6497-1, confirmed via its own official
  manufacturer technical communication (SRC-0021, Tier 3) — itself
  independently a famous "watchmaker training movement" (large
  pocket-watch architecture, easy to see and work on). Its lift angle
  (our 50° vs. the real 44°) doesn't match, though. The one tooth-count
  table found for "Unitas/ETA 6497" (SRC-0022) checks out, by this
  codebase's own gear-train math, as describing the 21,600 bph (3Hz)
  execution (6497-2/its clones), not the 2.5Hz 6497-1 — confirmed by a
  second, independent source too (a forum thread on ETA's escape-wheel
  part 705, SRC-0023, which documents at least two tooth-count variants
  of that one part number). Checked ETA's own and third-party parts
  catalogs directly (tztoolshop.com, passionchrono.com): they sell
  every wheel by ETA's part number only, never by tooth count, which is
  presumably why this number doesn't surface in ordinary web search —
  it likely lives only in trade wheel-cutting references or requires
  measuring a real movement. The centre wheel (80t) and third wheel
  (60t/10-leaf pinion) are *probably* shared between the 6497-1 and
  6497-2 — sources describing the 2.5→3Hz upgrade only mention swapping
  the escape wheel, escape pinion, fourth wheel, balance and
  mainspring — but that's an inference, not a citation, so it wasn't
  applied either. The counts still satisfy the dial ratios by
  construction, aren't taken from any verified caliber, and stay
  illustrative (ASM-0009).
- **External citations for gear equations.** All of REF-ENG §5 (pitch
  diameter, centre distance, speed ratio with direction, compound
  ratio, the lossless torque case, pitch-line velocity) is now cited to
  SRC-0009/SRC-0014/SRC-0018, all Tier: encyclopedia. What's still
  open: none of these is a primary standard (e.g. ISO/AGMA gear
  geometry), and the η < 1 lossy-mesh torque extension (ASM-0002) is
  still uncited and likely stays an assumption — a real mesh's
  efficiency depends on lubrication, surface finish and load, not a
  single citable constant.
- **Side-shake convention (ASM-0013) — now supported, not confirmed.**
  SRC-0011's worked example (a .12mm pivot paired with a .13mm jewel
  hole, both diameters, called "the convention" for the pivot/hole
  difference) is inherently a diametral figure, supporting
  `sideShake`'s bore Ø − pivot Ø convention. Still Tier 6 forum
  testimony, and no source (checked again in SRC-0012's thread too)
  states "diametral" or "radial" outright — read from the arithmetic
  of the worked example, not an explicit statement. A published source
  stating the convention directly would still be better.
- **Right-angle (stem) mesh relationship — citation closed, scope
  caveat remains; a horological source was found but doesn't close it
  either.** Derived here from rolling pitch circles and tested; now
  also cited to SRC-0010 (Nie et al. 2026, JSME, peer-reviewed), which
  states the same tooth-count ratio for a bevel gear pair, plus
  SRC-0009 (Wikipedia) for the general spur-gear principle. SRC-0007
  (ISO 23509:2016) and SRC-0008 (SDP/SI) are superseded and remain
  unread. Went looking specifically for a horological source and found
  one — Hillmann's "The Keyless Mechanism" (1910, SRC-0019), a repair
  manual with a chapter specifically on the winding-pinion/
  transmission-wheel right-angle gearing this mechanism models. But it
  only discusses "the ratio of the sizes of the mobiles" and matched
  tooth counts/pitch qualitatively (as a cause of jamming defects, not
  as a derived speed-ratio formula), so it doesn't itself close the
  "generic machine gear, not horological" gap. Recorded anyway per the
  rule to keep partial evidence rather than drop it for falling short.
- **Two beats per escape tooth (ASM-0021).** Now supported by SRC-0016
  (corroborated by SRC-0017), both Tier 6/7 informal sources, not a
  published standard — still an accepted assumption, not
  VERIFIED_STANDARD. A published source (e.g. SRC-0004, not yet read)
  would still raise its confidence. See SRC-0017's notes for a
  one-sentence conflict found in Wikipedia's Lever escapement article
  and why it isn't treated as overriding.
- **Oscillator equation (ASM-0024).** The f = √(k/I)/2π formula itself is
  now cited (SRC-0015, Wikipedia "Torsion spring" — standard
  linear-oscillator physics). This closes the citation for the math;
  it is not evidence that a real balance/hairspring is one (ASM-0024's
  physical-modeling claim remains unproven, as declared).
- **Acceptable bearing clearances — both endshake and side shake now
  have a low-confidence advisory.** SRC-0011 gave the escapement-vs-
  train endshake figures (BRG-006, ASM-0028); SRC-0012 (corroborated
  by SRC-0013) gives the pivot-diameter-keyed side-shake figures
  credited to Hans Jendritzki (BRG-007, ASM-0029). Both are
  informational only, explicitly not validated limits, since both rest
  on forum testimony rather than a source read directly. A published
  source (Jendritzki's own "Watch Adjustment", a NIHS/DIN/AFNOR
  standard) would still let either become a real pass/fail rule instead
  of an advisory. Checked one candidate Tier 4 textbook already on file
  for this purpose — Grossmann's 1880 prize essay (SRC-0020, read in
  full for its "Jewelling" chapter and pivot-sizing discussion) — and
  it gives no numeric clearance figure at all; it explicitly says
  machine-design pivot-sizing rules don't transfer to watch pivots and
  leaves sizing to accepted practice. Doesn't raise either advisory's
  tier, but explains why only forum testimony has been found so far.

## Known limitations

- Arbor diameters aren't modeled. The wheel/arbor check treats the
  arbor as its axis line, a lower bound.
- The selected-arbor highlight is hard to see behind large wheels.
- The section view fills cut faces for frames, arbors, gears, jewels,
  the dial, the escapement (escape wheel, balance rim and arms,
  pallet fork and stones) and hands, but not keyless-works parts
  (stem, crown, pinions) — those still show the pre-existing hollow
  clip, and can't use the same approach: the stem lies flat in the
  mainplate plane (ASM-0019), so a vertical section plane generally
  cuts its parts into an ellipse, not a circle or polygon.
- Measurements are between whole parts. There is no point-to-point
  picking on surfaces yet.
- Long dropdown labels are truncated in the narrow inspector.
- Resizing the viewport (docking, floating or closing panels, focus
  view) keeps the camera where it is; it does not re-fit the movement.
- The camera is framed once per loaded design or view change. A design
  built up from empty keeps the default view until you orbit or switch
  view.
- Keyless works: the setting lever, yoke, springs, click geometry and
  the ratchet teeth' form are not modeled. The stem's two positions stand
  for them. The stem passes through the mainplate slab (grooves are not
  modeled, ASM-0010), and stem parts aren't checked for interference.
  There is no stop-seconds (hacking) and no third crown position (date).
  Winding moves the spring's state of wind, but winding torque, the
  slipping bridle and a spring's hysteresis are not modeled.
- Escapement: no drop, impact or sliding contact, and no tooth or
  pallet faces; locking is checked only as tangential locking points
  (ASM-0025); the balance is a sinusoid at a declared or predicted
  amplitude, and amplitude does not change its rate (isochronous,
  ASM-0024); the escape
  wheel's tooth form, the fork and the balance's arms are visual. The STL
  omits the escapement parts. The toolbar's dial reading follows the
  average motion, not the ticks.
- The dial has no feet or holes. The hand pipes that pass through it are
  not checked.
- Only worst-case stacks exist; distributions are recorded, not used. A
  mesh's centre-distance stack is a first-order approximation for a
  FIXED shaft's position term (exact for module, ASM-0027), and only a
  FIXED shaft's own position can be toleranced — a solved (MESH_POLAR,
  COAXIAL) position can't be, so its variation isn't chained through.
- The plan drawing is a single view; the elevation is a single
  projection direction (X-Z, along Y) with no hidden-line removal, so
  parts at different Y overlap. Neither has a detail drawing per part,
  and only the centre-distance (plan) and endshake (elevation)
  dimensions carry a tolerance annotation. Dimensions can crowd where
  several axes are close.
- The STL leaves out arbors and jewels (placeholder sizes, ASM-0012), and
  frames are solid slabs without bearing holes.

## Next (see `docs/ROADMAP.md`)

- Elevation/plan follow-ups, if useful: a section (cut) drawing with
  filled faces, tolerances on gear placement other than a FIXED shaft's
  own coordinates (chaining through MESH_POLAR/COAXIAL), a chosen or
  auto-fit elevation projection direction instead of the fixed X-Z one.
- Escapement beyond the simplified models: sourced or measured values
  for Q and escapement efficiency; tooth and pallet faces (drop, impulse
  geometry); amplitude-dependent rate; sources for ASM-0021, ASM-0024,
  ASM-0025 and ASM-0026.
