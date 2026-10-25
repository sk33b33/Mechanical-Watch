# Status

Validation levels use the L0–L5 scale from REF-ENG §15 (confirmed).

## Phase 8.15 follow-up 40: Seconds hand colour

The Colours flyout has a **Seconds hand** button, directly above **Minute hand**. It recolours the seconds hand only
(the minute and hour hands keep their own choices; the seconds numerals follow the "Dial text, triangles and digits"
colour as before). It is stored with the other colours (`Appearance.secondsHand`); design schema v36, and v35 files
open with the seconds hand unchosen (built-in colour). Still presentation only (ASM-0090).

## Phase 8.15 follow-up 39: Colours flyout

A fourth flyout, **Colours**, slides out from a tab on the right edge (below the Inspector tab; it has no docked
place). It lists every wheel seen through a dial window (Moon phase, Date, Day of week, Month, Leap year, Season,
Year digits), each with a colour button and a **Text** button (the digits, names or icons printed on that wheel).
Below are buttons for the **Dial**, **Hour markers**, **Hour marker digits**, **Dial text, triangles and digits**,
**Minute hand** and **Hour hand**. Pressing a button opens a colour chart under it (saturation/brightness square,
hue slider, typed `#rrggbb`, and a "Built-in colour" button); clicking or dragging on it recolours live and is one
Undo step. "Reset all colours" returns everything to the built-in look.

How it is stored and applied (ASM-0090): choices live in `Movement.appearance` (schema v35; v34 designs load with
no choices), so they are saved with the design and Projects. They are presentation only: validation, kinematics
and exports never read them. A wheel's colour is painted into its face texture, so the exact picked colour shows
(not a tinted one). Season: one body colour for all wedges; Year digits: one colour set for the whole barrel; Moon
phase text colours the lit phase icons. The dial print colour also covers the captions, pointers, bezels, seconds
numerals and the RSA MOVT mark. Limits: no contrast or legibility check (a dark-on-dark choice is allowed), and
lighting makes the hands look somewhat darker than the chosen colour. Tests: appearance domain/persistence,
colour maths, layout, and `e2e/colours.spec.ts`.

## Phase 8.15 follow-up 38: seconds hand moved right and down

The seconds hand and its 60 / 15 / 30 / 45 numerals are now about **1.1 mm further right and 2.2 mm lower** on the
dial (pivot at 8.70, -4.90 mm, was 9.78, -2.70). Because the hand sits on a gear-meshed arbor, it can only move
along the exact centre distances: the third and fourth arbors swing round (tooth counts, ratios and every mesh
distance unchanged), and the escape arbor, pallet, balance, the balance cock outline and its screw are carried
with it; the train bridge's lower corner was extended to still hold it. Validation is the same: 23 info items,
no warnings. Seen on the dial and from the bridge side. The shift is limited by that geometry; a bigger move to
the right would swing the third arbor further. ASM-0089. **To revert:** set `SECONDS_PIVOT_MM` back to
`{ x: 9.7777, y: -2.7 }` in `teachingMovement.ts` and the bridge corner to (13, -6).

## Phase 8.15 follow-up 37: one tick, not tick-tock

At your request the escapement tick is now the same sound on every beat (it alternated a higher tick and a
lower tock). Rate and rules are unchanged: the model's 5 beats a second, muted above 1× and on clock jumps
(ASM-0084). **To revert:** restore the two pitches in `TICK_SOUND` and alternate them by beat number.

## Phase 8.15 follow-up 36: open my saved layout at startup

In **Projects…** each saved design now has **Open at startup** (and **Stop opening at startup** on the marked one,
shown with a ★). The marked design opens exactly as saved every time the app starts, then the usual startup
applies: the browser's date and time and the dial view. With none marked, the teaching movement opens as before.
If the marked design is gone or unreadable, the teaching movement opens and a notice says why. ASM-0088.

- **Your last session's design** is still never lost and now never overwrites something you saved on purpose:
  with no saved entry it is kept under its own name; identical to its saved entry, nothing is written; edited
  since you saved it, it goes to a separate "(unsaved edits)" entry (replaced by the next one), and your saved
  design stays as it was. A notice says which happened.
- Deleting the marked project clears the setting. `?start=plain` ignores it (the automated tests).
- Browser storage can be cleared by the browser; the toolbar's **Save** file is the durable backup.
- **To revert:** remove `getStartupProjectId` use in `startup.ts` and the button in `projectsDialog.ts`.

## Phase 8.15 follow-up 35: move calendar wheels on the dial, and Fix chain

Designed with you through questions (calendar wheels and windows only; meshed wheels swing round their
partner; a Fix chain button with a preview; overlaps warn but are allowed). ASM-0087.

- **Move wheels** (viewport bar): switches to the dial view; press and drag a calendar wheel (date, day of
  week, month, leap year, season, or the year display) by its window. The wheel and every window that shows it
  move together live, and stay where you release. One **undoable** step; Esc during a drag cancels. Nothing
  else moves, and no dimension or tooth count changes. The cam and jumper drawings follow by themselves,
  because they are drawn from the positions. The year display moves its four barrels and window as one. A
  wheel that is mesh-placed would swing round its partner at the unchanged centre distance (not used by the
  current teaching movement's calendar wheels); a coaxial wheel cannot be moved. On a slow device the drag
  shows fewer steps (each step rebuilds the scene) but always ends exactly where you let go.
- **Fix chain…** (viewport bar): shows, and only on **Apply** performs, a tidy-up: a whole-wheel window that
  has drifted off its wheel is re-centred; wheels whose discs overlap or are closer than 0.3 mm are pushed
  apart (the wheel you moved last gives way); wheels too near or beyond the dial's edge are pulled in. Each
  change is listed with the distance. It cannot move a coaxial wheel and says so. 0.3 mm and 20 passes are
  declared tidy-up choices (`CHAIN_FIX`), not a manufacturing clearance.
- **Not included (your answers):** moon disc and gear-train wheels are not draggable; overlaps are not blocked
  while dragging.
- Pure code and tests: `src/assembly/moveWheel.ts`, `src/assembly/fixChain.ts`; store: `beginInteractiveEdit`
  / `previewEdit` / `endInteractiveEdit`. e2e: `e2e/moveWheels.spec.ts`. **To revert:** remove the two buttons
  in `viewportControls.ts` and the drag handlers in `viewport.ts`.

## Phase 8.15 follow-up 34: the drive chain as a tutorial step

The guided tutorial has a new step, **See how it all connects**, after the balance drive is set and before the
validation check. It points at the toolbar's **Chain…** button and explains the diagram (what drives what, the
calendar's jump links, the "everything hangs off one mainspring" line, Print…), and repeats that it shows
connections and solved speeds only. It is a step about *looking*, so it has no completion check: it advances on
**Next** (the button now says Next instead of Skip this step for such a step, and Done on the last). The diagram
is a modal dialog, so close it before pressing Next. A tutorial test now expects exactly two steps without a
completion check (this one and the last). **To revert:** remove the `see-chain` step in `tutorialSteps.ts`.

## Phase 8.15 follow-up 33: printable drive chain

The Chain dialog gained **Print…** and **Download SVG**. Print builds a page from the same diagram, drawn
**top-down** (the steps from the mainspring read as rows, so the whole chain fits one portrait A4 sheet at
a readable size) in black on white, with the connection summary, the date it was generated, the legend and
the validation caveat. It prints through a hidden frame, so no pop-up can be blocked. Download SVG saves the
same drawing as a standalone file with a white background. Both come from the design model (ASM-0086). Seen
as a PDF of the print page: one A4 page, all 22 parts, readable. The browser's own print dialog was not
exercised here (it is stubbed in the automated test). **To revert:** remove the two buttons in `chainDiagramDialog.ts`.

## Phase 8.15 follow-up 32: drive-chain diagram

A **Chain…** button in the toolbar opens a diagram of how every part is connected, generated from the
design and the solved gear train (so it always matches the model; ASM-0086). Parts are boxes (arbors with
their gears and tooth counts, the solved speed, hand and moon-disc tags, the mainspring, the escapement
with its beat rate, the calendar stars); lines are gear meshes (labelled driving : driven teeth), the
friction clutch, the spring's drive and winding, the escape lock, and the calendar's dashed **jump links**.
Click a part to select it in the model. A summary line states whether everything hangs off the mainspring
("All 22 parts are connected…") or names the parts that nothing connects to (drawn dashed red). **Fit to
window** scales it; the default is full size with scrolling. It maps connections and speeds only (L2
kinematic): nothing about torque or friction. **To revert:** remove `mountChainDiagramDialog` in `bootstrap.ts`.

## Phase 8.15 follow-up 31: beat-rate tick, straight hands, startup state, smooth splash on phones, more gem facets

Five requests (ASM-0084 updated, ASM-0085):

- **Tick at the watch's real pace:** the tick now follows the escapement beat instead of once a second:
  the model's own rate (escape arbor speed × teeth × 2 beats per tooth, ASM-0021) is 5 beats a second
  (18,000 an hour) for the teaching movement, alternating tick and tock. Still a decorative synthesis,
  muted above 1× and on any jump of the clock; the balance's real beat-by-beat motion is not simulated.
  A movement with no driven escapement is silent.
- **Straight hour and minute hands:** plain tapered blades ending in a point (still the longer 7.5 / 11 mm);
  the thunderbolts are gone.
- **Startup:** on entering, the app opens the *current* teaching movement, sets the browser date and time
  (taken at the moment you tap, not at page load) and turns to the dial view with the dial's centre in the
  middle of the viewport and the whole dial in view (this also re-centres the "Dial side" button). A design
  autosaved by the previous session is not lost: it is saved in **Projects…** under its own name and a
  notice says so. `?start=plain` restores the old startup (autosave restored, t = 0, bridge view); the
  automated tests use it.
- **Splash smoothness on phones:** while the splash is up the 3D viewport no longer draws or simulates
  behind it; each glowing gear is drawn once to a sprite and each frame only rotates sprites (the glow's
  blur was the cost); on touch screens the glass plate is a plain translucent panel (no per-frame backdrop
  blur) and the sheen and scan lines are off; the viewport's pixel ratio is capped at 2. In a 4×-slowed,
  software-rendered phone emulation the splash went from about 0.7 to about 19 frames a second; real
  phone hardware was not available here.
- **Gems with more cut sides:** 24 outer facets (from 16), two stepped crown bevels, and a deeper inner
  pavilion (a kneed 12-facet cone with a nested, half-facet-turned 24-facet cone).
- **To revert:** `startup.ts`/`main.ts` (startup), `JEWEL_VISUALIZATION` (gems), `generateHandOutline`
  (hands), `modelBeatHertz` (tick).

## Phase 8.15 follow-up 30: splash glow and zoom, gold crown, cut-stone jewels, tick, thunderbolt hands, RSA MOVT

Eight requests in one batch (all visual or audio, none feeds a kinematic or clearance result; ASM-0083,
ASM-0084):

- **Splash gears glow brighter:** each outline is now a bright near-white core over a tight halo over a
  wide soft bloom, with a stronger fill.
- **Zoom on entry:** the splash and its gears rush past the viewer (scale ≈ 2.8, blur, fade) while the
  movement behind zooms in from slightly small to rest, about 1.1 s. Skipped under reduced motion.
- **Crown in the escapement's gold:** one shared viewport constant, so the crown, the escape wheel and any
  gear set to the Escapement colour stay in step.
- **Jewels look cut:** translucent, clear-coated stones with a second star bevel on each crown, 16 outer
  facets, and an inner faceted double-cone pavilion (8 facets, a point/culet for the solid impulse ruby)
  that glints through the stone. The refractive index in the shader is a display value, not optics.
- **Second-hand tick:** a synthesised tick/tock alternates once per dial second while the simulation runs
  at real time or slower; muted when paused, faster than real time, or when the hand jumps (setting,
  reset, set to browser time). A toolbar **Tick: on/off** toggle is remembered. It is **not** the
  escapement's beat: the hand sweeps continuously here, and a real balance beats several times a second.
  The sound unlocks on the splash tap (or the first click/key press if the splash is skipped).
- **Hands:** the hour and minute hands are longer (7.5 mm / 11 mm, from 5 / 8) and are thunderbolts (a
  zigzag polygon whose sharp end is the tip on the pivot axis, so the angle read is still the simulated
  one). The seconds hand is unchanged.
- **RSA MOVT:** small black text under the big 6 circle on the south axis, between the circle and the
  dial edge, 0.024 of the dial radius tall. It is a label you chose; it asserts nothing about provenance.
- **To revert:** `HAND_VISUALIZATION` / `HAND_BOLT_VISUALIZATION`, `DIAL_VISUALIZATION.brand`,
  `crown: ESCAPEMENT_GOLD` in `viewport.ts`, `JEWEL_VISUALIZATION`, `mountTickSound` in `bootstrap.ts`.

## Phase 8.15 follow-up 29: tap-to-enter start screen

A futuristic metal start screen now covers the app on every load until it is tapped, clicked or any key
is pressed (chosen with the user: animated gears, cyan glow, every load, with sound, parallax, version
and validation chips and an honesty line). Brushed-metal backdrop, a translucent frosted-glass plate with
a chrome title and a sweeping sheen, and a glowing outline gear train turning behind it. The pointer (or
device tilt) shifts the layers in parallax; entering plays a soft synthesised click (a **Sound on/off**
toggle, remembered) and fades the screen away. Reduced-motion settings skip the animation and fade.

- **Honest content:** the chips show the design schema version and the *design's own* declared
  validation level, plus "Physical validation pending"; the note says teaching demo (when it is one) and
  that the simulation is an approximation, nothing physically validated.
- **Gears:** meshing pairs sit at the ideal centre distance and turn at -z1/z2 with interlocking teeth
  (`src/app/splash/splashGears.ts`, tested), but the teeth are plain trapezoids and the speed is a
  display rate. Decorative only, ASM-0082.
- **While it is up** the application behind is inert (no tabbing or clicking through).
- **`?splash=off`** in the URL skips it (used by the e2e fixture, handy for screenshots/embedding);
  `e2e/splash.spec.ts` covers the real thing.
- **To revert:** remove the `mountSplash` call in `src/app/main.ts`.

## Phase 8.15 follow-up 28: day-of-week window

Researched the real day-of-week mechanism first (SRC-0048, Glashütte patent US8842500B2: a seven-arm
"days star" advanced 1/7 of a turn per day by a pin on a once-a-day wheel, held by an elastic indexing
element; SRC-0049, horopedia.org: 7 positions, semi-instantaneous versus instantaneous jumps) and added
a **Day of week** window to the dial. It sits at the 3 o'clock side of the cluster (plan position
declared at 6, 3.5 mm), with the same equilateral north pointer and printed frame as the other windows.
Behind it is a five-spoke open wheel in its own sky-blue (distinct from the date wheel's blue and the
month wheel's grey-blue) with the weekday names printed in a circle close to its edge, the current day
at north.

- **Model:** a `DateComplication` gains `display` (`DAY_OF_MONTH` default, or `DAY_OF_WEEK`). A weekday
  star is an ordinary date star with seven teeth and no month attached, so it reuses the ASM-0048 jump
  kinematics: one 2π/7 step per revolution of the 24-hour arbor, never backward. ASM-0081; persistence
  schema v33 → v34 backfills `DAY_OF_MONTH`; Inspector row "Display"; new rule **DATE-004** (a weekday
  star needs exactly seven teeth).
- **Names:** the dial prints the 3-letter forms (MON–SUN) because full names do not fit round a star
  this small; the window's "Currently shows" and the star's "Current position" give the full name.
  Position 0 is Monday.
- **Browser clock:** "Set to browser time" now also sets the weekday (`CalendarDate.weekday`).
- **Not modelled:** the pin/pawl contact geometry, the elastic indexing element, the correction pusher,
  and any link between weekday and date (they are independent stars). The jump is instantaneous (ASM-0048).
  Plan position and size are illustrative (ASM-0009); nothing here is validated against a real calibre.
- The tutorial gained an arbor, a complication and a window step for the weekday; the keyless-works and
  calendar tests were updated for the second date complication.
- **To revert:** drop the "Day star" arbor, "Day of week" complication and "Day of week window" from the
  teaching movement (and the matching tutorial steps).

## Phase 8.15 follow-up 27: Components, Inspector and Validation as flyouts

At the user's request the three side panels are now **flyouts**: each is tucked away until the tab that
hugs its screen edge is pressed, then slides out over the movement and slides back when the tab is pressed
again. Components slides from the left edge, Inspector from the right and Validation from the bottom; the
tab rides the panel's inner edge, so it sits at the screen edge when closed and moves out with the panel
when open. The Validation tab carries the live counts ("Validation: 22 info"). The header's Components /
Inspector / Validation buttons slide the flyouts out too, **Esc** slides every open one back, and
several can be out at once (they overlay the movement rather than squeezing it, so the viewport now has
the whole window). A closed flyout is hidden and inert, so it takes no keyboard focus. Each panel's title
bar has a new "flyout" control next to dock / float / pop-out / hide, so you can put a panel back as a
dock or a flyout at will; the layout (mode and size) is remembered, which panels are *open* is not.
Starting the tutorial slides out Components and Inspector, which it points at. **One-off reset:** the
saved-layout key is now `mw3d.layout.v2`, so layouts saved by earlier versions (all docked) are ignored
once and everyone gets the flyout default. This is per-viewer UI state only (no schema or design change).
Tests: flyout layout maths in `layoutState.test.ts`; four browser tests in `e2e/flyouts.spec.ts`; the
existing browser tests start from a docked layout seeded by the fixture (option `layout: "default"` runs
a test from the real default). **To revert:** change `defaultLayout()` to `dockedLayout()`.

## Phase 8.15 follow-up 26: Moon wheel 1 in the escapement colour

Moon wheel 1 is now drawn in the escapement's own gold. There was no way to colour one gear differently,
so a presentation-only `Gear.colour` was added (`DEFAULT` steel grey or `ESCAPEMENT` gold — the same
viewport constant the escape wheel uses, so they stay in step; ASM-0080; persistence schema v32 → v33
backfills `DEFAULT`; Inspector row "Colour"). Only Moon wheel 1 is set; nothing in the simulation,
validation or exports reads it. **To revert:** set Moon wheel 1's Colour back to Steel grey (Inspector), or
drop `colour:` from the teaching movement's `moonWheel1`.

## Phase 8.15 follow-up 25: spoked escape wheel

At the user's request the escape wheel is drawn as an open five-spoke wheel too, in the same style as the
spoked gears (follow-up 22): five straight spokes, a solid ring of 20% of the tooth root radius under
the teeth, gaps between. New field `EscapeWheel.spoked` (default false; ASM-0079; persistence schema
v31 → v32 backfills false; Inspector row "Wheel style" in the escapement section); the teaching
movement turns it on. Because this wheel is small (2.3mm tip radius) and its arbor bore is large, the
hub ring is 1.5 × the bore radius so the bore is never cut through — which leaves narrower gaps than
the larger gears have. Visual only: club tooth form, tip diameter, thickness, bore and every escapement
result are unchanged. **To revert:** set `spoked: false` on the escape wheel (Inspector, or the teaching
movement's `escapeWheel`).

## Phase 8.15 follow-up 24: faceted ruby jewels

At the user's request the red cylinders standing for bearing jewels are drawn as faceted ruby ring
jewels (`createJewelGeometry`, ASM-0078): flat table, bevelled crown, straight girdle and a funnel
into a through hole, mirrored at both ends so they read from either side of a plate; 12 flat-shaded
facets in a glossy, faintly self-lit ruby. The balance's impulse ruby pin gets the same faceted look
as a solid stone. Plain holes (no jewel) stay plain grey cylinders. Visual only: outer radius,
position, declared bore diameter and every bearing-clearance result are unchanged — the drawn funnel
hole is a visual choice, not the declared bore. **To revert:** use `createZCylinder` for the jewel
mesh in `viewport.ts` (git history).

## Phase 8.15 follow-up 23: Moon wheel 2 solid again

At the user's request the teaching movement's **Moon wheel 2** (87 teeth) is a solid disc again; it is
the one wheel of 30+ teeth that is not spoked (the other eight still are). It is an ordinary
`Gear.spoked = false`, so it can be switched back on from the Inspector's "Wheel style" row.

## Phase 8.15 follow-up 22: spoked gears on the bridge side

Asked first (four questions), then built: **large wheels only**, **five straight spokes** like the dial
wheels, a **solid ring of ≈20% of the radius** under the teeth, and a **per-gear setting** the teaching
movement turns on. New domain field `Gear.spoked` (default false; ASM-0077; persistence schema
v30 → v31 backfills false, so older designs are unchanged; Inspector row "Wheel style"). A flagged gear
with 24 or more teeth is extruded with five gaps between hub and ring (`gearSpokeOpenings`, the dial
wheels' own polar spoke geometry measured against the gear's root radius); below 24 teeth it is drawn
solid and **GEAR-105** (warning) says so rather than hiding it. In the teaching movement every wheel of
30+ teeth is spoked — barrel drum, ratchet, centre, third, fourth, minute, hour and the two moon wheels;
pinions and the 16- and 20-tooth wheels stay solid. Visual only: tooth form, pitch diameter, bore,
thickness and every kinematic and mesh result are unchanged; mass and inertia are not modelled from the
gaps; the section-view cap footprint stays the full disc. The STL export uses the same geometry, so a
spoked gear exports with its gaps (the model's own geometry, not a manufacturing claim). **To revert:**
set `Wheel style` back to solid per gear, or drop `spoked:` from the teaching movement's `gear()` helper.

## Phase 8.15 follow-up 21: window frames, equilateral pointers, hour numerals, knurled crown, arrowhead hands

Five visual changes at the user's request (ASM-0076; frames reuse ASM-0074). **Frames:** every dial
window in the teaching movement now has the thin dark printed bezel the year window got (a window's
north pointer clears the frame as well as the edge). **Pointers:** the triangles are equilateral — all
three sides 0.034 of the dial radius, height side·√3/2 — shorter than the old 0.03-wide, 0.04-tall
ones. **Hour numerals:** 12 (north), 3 (east), 6 (south) and 9 (west) are printed inside the four big
circles in the year digits' own text colour (white). **Crown:** now knurled — 36 rounded ridges, each
groove 0.09 of the radius deep — instead of a smooth cylinder; its size, position and spin are
unchanged (the small flat that shows its rotation is kept). **Hands:** the hour and minute hands end in
an arrowhead (shaft tapering to half width, barbs one width either side, point at the hand's declared
length); the seconds hand keeps its plain taper, and lengths, hubs and heights are unchanged. All are
visual choices, not a real watch's design, and feed no kinematic or clearance result. **To revert:** set
`bezel: false` on a window; the old pointer size, plain crown and four-point hands are in git history.

## Phase 8.15 follow-up 20: five-spoke moon wheel

The moon phase wheel is now an open five-spoke wheel too, matching the date and month wheels
(`createSpokedWheelGeometry` with the moon's own opening radius, ASM-0075). Its gaps stop at 0.62 of
the radius; the printed phase icons occupy 0.725–0.955 (ring 0.84, icon radius 0.115), so no gap meets an
icon (tested against the visualization constants, and checked live). Spokes, hub and spoke width are
the shared fractions (hub 0.2, spoke 0.13 of the radius). The stars painted in the middle of the sky
are now cut away with the gaps; through them you see what is behind the wheel. Visual only: size,
thickness, phase kinematics and the north pointer reading are unchanged. **To revert:** use
`createZCylinder` for the moon mesh in `viewport.ts` (git history).

## Phase 8.15 follow-up 19: labels toward the wheel edge; seconds numerals moved to the seconds hand

**Labels:** the date numbers and month names now sit at 0.86 of their wheel's radius instead of
0.72 (`DIAL_WINDOW_VISUALIZATION.edgeLabelRadiusFraction`, passed only for date and month; leap-year
and season rings are unchanged). The slot arc, and with it the auto-fitted font (ASM-0067), grows with
the ring radius, so the labels are a little larger too; checked live that the text clears the rim and the
spoke gaps (which still stop at 0.58, so the solid rim is now a little wider than the label band needs —
the gaps could be lengthened outward if wanted). **Seconds numerals (correction):** follow-up 18 had
put 60/15/30/45 on the big hour circles; they belong around the small gold seconds hand. They are now
printed around that hand's own pivot (the Fourth arbor, ≈(9.8, −2.7)mm), 60 north, 15 east (the dial's
right), 30 south, 45 west, at 0.95 of the hand's length so the tip reaches them; the hour circles carry
no numerals. **To revert the label move:** pass no radius to `discMaterials` for date/month.

## Phase 8.15 follow-up 18: round hour markers, seconds numerals, hand and date-wheel colours

Four dial/colour changes at the user's request. **Round markers:** the twelve rectangular hour bars
are now circles — big at 12, 3, 6 and 9, half the size at the other eight (`DIAL_VISUALIZATION`,
`dialMarkerPlacements`, ASM-0020). **Seconds numerals:** the four big circles carry **60** (north),
**15** (east), **30** (south) and **45** (west) in pale type; they sit inside the circles rather
than beside them because the moon wheel's window comes within ≈0.4mm of the 6 o'clock circle, and the
numerals are decoration for the seconds hand, not a calibrated scale. The big circles also clear the
moon window slightly more than the old bars did. **Hands:** the hour and minute hands now share the
seconds hand's amber (`COLORS.hand`). **Date wheel:** now a mid blue (`#5a8fd8`), distinct from the
month wheel's grey-blue; the date linkage's cam and rod, which share that colour constant, follow it.
**To revert:** bar markers and the old colours are in git history (`0xe6e9ec` hands, `0xc2a06a` date
wheel).

## Phase 8.15 follow-up 17: five-spoke date and month wheels

At the user's request the date and month star wheels are drawn as open five-spoke wheels — hub,
five constant-width spokes and the gaps between them — with the gaps stopping **below the printed
numbers and names** so nothing encroaches on them. The solid rim from 0.58 of the radius out to the
tip keeps the label ring (at 0.72) whole; checked live, no gap meets a date number or a month name
(`createSpokedWheelGeometry`, `SPOKED_WHEEL_VISUALIZATION`, ASM-0075). The wheel reuses the leap-year
wheel's extruded-geometry cap/UV reshaping, so the labels and their calibrated north reading are
unchanged (date still reads 20 and month October under their pointers). Visual only: tip radius,
thickness, positions and every kinematic result are as before, and the gaps do not feed any
clearance check. Through the gaps you now see what is behind the wheel (the mainplate, and the
month linkage's declutch wheel near the date wheel's rim). The Leap-year and Season wheels are
unchanged. **To revert:** use `createZCylinder` for the date and month meshes in `viewport.ts`
(the previous code is in git history) — or keep the geometry and set `openingOuterRadiusFraction`
small to shrink the gaps.

## Phase 8.15 follow-up 16: year window — contrast, bezel, tighter height, "YEAR" caption

At the user's request (suggestions 1-3 of four offered; the barrel and digit size are untouched,
the larger-barrel option 4 was left for later). **Contrast:** the numerals are pure white (was
cream) and the digit strip carries an emissive term that follows its own texture
(`YEAR_DIGIT_BARREL_VISUALIZATION.emissiveIntensity`), so the digits read through the dial window
instead of dimly while the roller body stays dark (tally-counter reference, ASM-0064); the strip
texture is now sRGB-tagged, which the emissive term needs (left as linear it washed the body grey —
found live). **Edges:** new `DialWindow.bezel` (a thin dark printed frame around the window) and
the window's height trimmed 0.4 → 0.34mm. The neighbour slivers shrank but are not entirely gone:
the digit sits a little low in the window as seen from the dial-side camera (parallax from the
off-axis position), so a trace of the next digit's top still peeks in above each numeral. **Caption:**
new `DialWindow.caption` (a short label printed centred just below the window; the teaching
movement prints "YEAR"). Both new fields are in the Inspector ("Bezel", "Caption"); persistence
schema v29 → v30 backfills `bezel: false`, `caption: null` (ASM-0074). **To revert:** `bezel:
false` and `caption: null` on the Year window, height back to 0.4mm, `textColor` back to
`#f2ece0` and `emissiveIntensity` to 0.

## Phase 8.15 follow-up 15: phases printed on the moon wheel itself

At the user's request the two plain moon discs on the dark moon wheel are gone, replaced by a ring
of moon-phase icons printed on the wheel (`createMoonPhaseTexture`, ASM-0073); the north pointer
stays and points at whichever printed phase is current. The dial ring of fixed icons from
follow-up 14 is switched off (`phaseMarks: false` on the teaching movement's Moon phase window; the
field and its schema v29 stay, available for other designs). **What is printed:** eight phases per
moon image — new, waxing crescent, first quarter, waxing gibbous, full, waning gibbous, last
quarter, waning crescent — repeated for each image, so the two-image wheel shows the series twice,
half a turn apart (16 icons). The lit part is the real illuminated fraction, lit on the left while
waxing and on the right while waning (Southern Hemisphere, as declared). **Verified live** by
setting the disc to 0, 12.5, 25, 37.5, 50 and 75 % of a lunation and reading the icon under the
pointer: empty ring, thin crescent, half, gibbous, full, half (waning). Placement reuses the
label-ring calibration (ASM-0071), so the icon under the pointer is the phase the model reports;
between two icons the pointer sits between two phases. The icon ring sits at 0.84 of the disc radius (first drawn at 0.66, then moved out to the wheel's edge at the user's request); the icons keep their size and stay fully inside the disc. **Layout:** with the dial icons gone, the
moon train's V is back at the follow-up 13 geometry (disc 8.6mm below the hour wheel, ≈0.45mm clear
of the 6 o'clock marker). **To revert:** restore the two-circle drawing in `createMoonPhaseTexture`
(git history, follow-up 14) and set `phaseMarks: true` for the dial ring.

## Phase 8.15 follow-up 14: lunar-phase marks around the moon window

At the user's request the whole-disc moon window now has fixed phase icons printed on the dial
around it: an unlit ring for new moon, a filled disc for full, and a ring with its lit half
filled for each quarter. New domain field `DialWindow.phaseMarks` (default false; ASM-0072;
persistence schema v28 → v29 backfills false; inspector "Phase marks" row; DIALWIN-001 rejects
it on a non-moon or non-circular window). **Placement is derived, not chosen:** at phase
fraction f a moon image sits at north + (2π/n)(f − 0.5), repeated every 2π/n
(`moonPhaseMarks`, tested against the real `moonPhaseFraction`/`moonImageLocalAngle`), so for the
two-image disc: full at north and south, new at east and west, the quarters on the diagonals. The
north pointer already stands for full moon, so no icon is drawn under it; the south icon is the
second image's full moon. Quarter icons are lit on the left (first quarter) and right (last
quarter) as seen from the dial side — the declared Southern Hemisphere convention. **Layout:** the
icon ring needs ≈0.7mm beyond the window, so the moon train's V (follow-up 13) was deepened from
a 4.3mm half-base to 4.0mm (disc 8.0mm below the hour wheel, polar angles 237.37° / 302.63°)
to stay clear of the 6 o'clock marker. **To revert:** set `phaseMarks: false` on the Moon phase
window (the code can stay), and the moon polar angles back as noted in follow-up 13.

## Phase 8.15 follow-up 13: moon phase window trial — whole-disc window with north pointer

A trial at the user's request (option A of the three proposed), kept or reverted after they
look. The Moon phase window changed from a 0.7mm-radius catch-one-moon circle to a CIRCLE
centred on the moon disc's own axis, radius 5% over its declared 3mm radius, with
`pointer: "NORTH"` (ASM-0069): the whole star sky and both moon images show. The pointer marks
the **full-moon** position — `MOON_PHASE_VISUALIZATION.windowWorldAngleRadians` already puts a
moon image straight north at the real full-moon instant (ASM-0055), so a moon under the triangle
reads as full moon and one at the sides as new (checked live on 20 Oct 2026, a few hours before
the real new moon: both moons sit at the sides). The moon images are plain discs, no phase shading
or ring marks (offered as an optional extra, not added).
**Layout side effect:** at its old straight-down position (9.5mm below the hour wheel) the
6.3mm window's lower edge ran into the 6 o'clock hour marker, so the two 4.75mm moon-train mesh
legs were bent into a shallow "V" (declared polar angles 244.86° and 295.14°, i.e. ±asin(4.3 /
4.75) off straight down), landing the disc 8.6mm below the hour wheel with ≈0.45mm clearance.
Mesh centre distances are unchanged, so every ratio and mesh is as before. **To revert:** restore
`centre: windowAbove(moonDiscArbor.id, 3, 0.4)`, `outline: { kind: "CIRCLE", radius: mm(0.7) }`
and drop `pointer` on the Moon phase window, and both moon `polar(...)` angles to 270, in
`teachingMovement.ts`. The moon phase is not set from the browser date by "Set to browser time"
(no sourced epoch in the model).

## Phase 8.15 follow-up 12: leap-year wheel prints words, not digits

At the user's request the leap-year wheel's printed ring now reads "Year 1", "Year 2",
"Year 3" and "Leap year" instead of "1".."4" (`LEAP_YEAR_SHORT_LABELS`,
`src/domain/leapYearComplication.ts`). The label auto-fit (ASM-0067) scales the font to the
widest label ("Leap year") so every label shares one size; checked live that all four sit
between the Geneva rim slots with no overlap, and that the current position (e.g. "Year 2" in
2026) reads at north under the pointer. The words rotate with the disc, so the one at the
bottom of the ring reads upside-down, as on any real rotating printed ring. The inspector and
validation text keep the full "Year 4 (leap)" wording.

## Phase 8.15 follow-up 11: date window trial — whole-wheel window with north pointer

A trial at the user's request ("do the same for the date window"), kept or reverted after
they look. The Date window changed from a 0.175mm-radius catch-one-number circle to a CIRCLE
centred on the date star's own axis, radius 5% over its declared 2.5mm tip radius, with
`pointer: "NORTH"` (ASM-0069) — the same treatment as month, season and leap-year. The
current day reads at north under the pointer (verified live: day 20 on 20 Oct 2026).
**Layout side effect:** the whole-wheel date window (2.625mm radius) and its pointer would
have overlapped the season window (wheel at (−6, 4.5)mm), so the season wheel moved to
(−10.5, 3)mm (seen from the dial side, beside the date wheel, clear of the hour markers);
no mechanism connects it (ASM-0057), so nothing else changes. The date star itself also moved up 0.8mm (y 0 → 0.8mm) because the bigger window's bottom edge encroached on the month window's own north pointer (checked live: clear afterwards); its revert line is `fixedAt(mm(-6), mm(0))`. The month linkage's small
declutch wheel (ASM-0054), which sits between the date and month stars, is now visible
through the date window. **To revert:** restore `centre: windowAbove(dateStarArbor.id, 2.5,
0.72)`, `outline: { kind: "CIRCLE", radius: mm(0.175) }` and drop `pointer` on the Date
window, and the season wheel's `fixedAt(mm(-6), mm(4.5))`, in `teachingMovement.ts`. The 31
labels are small (auto-fit to their slots, ASM-0067); that is the cost of showing the
whole ring.

## Phase 8.15 follow-up 10: "Set to browser time" now sets the calendar too

Reported live: after "Set to browser time" the month read January and the date the 1st
instead of October 20th. **Root cause:** the button only fast-forwarded the going train to
the browser's *time of day*; every calendar wheel (date, month, leap-year, season) started
at its own arbitrary reference (day 1, January, position 0) and the jump mechanism only
advances them from there, so no amount of clock time reaches today's date. **Fix:**
`setToBrowserTime` now also positions the date, month, leap-year and season wheels and the
year-digit segments from the browser's date (`withCalendarDate`, ASM-0070). The clock
fast-forward (`advanceToBrowserTimeOfDay`) now targets the full 24-hour day rather than the
12-hour dial reading, so the 24-hour arbor (the date-jump drive) is in phase and the date
changes at the right midnight. **Second, deeper bug this exposed (ASM-0071):** with the wheels
finally on non-zero positions, the month window's north label read *April* while the domain
said *October* (leap-year "4" against "Year 2", season "AU" against Spring) — always label
−i for position i. Every earlier alignment check (ASM-0068) had been made at position 0, where
i = −i, and its "terms cancel" derivation was wrong in sign. The label rings (date, month,
leap-year, season wedges/icons/labels) are now laid out in the opposite direction
(`DISC_LABEL_RING_DIRECTION = −1`), so the next label arrives at the window each time a disc
advances; verified live on 20 Oct 2026 and 31 Dec 2028 against every window's own reading
(date 20/31, October/December, Year 2/Year 4 (leap), Spring). Limits, declared: the 4-position leap-year wheel cannot
express the 1900/2100 century exceptions; the moon-phase disc is not set from the date
(not requested, no sourced epoch in the model); this is a set-by-hand action, not a claim
a real watch could do it unaided.

## Phase 8.15 follow-up 9: month window trial — whole-wheel window with north pointer

A trial at the user's request, to be kept or reverted after they look at it. The
Month window changed from a small 0.65 × 0.6mm RECTANGLE (above the star's label
ring) to a CIRCLE centred on the month star's own axis, radius 5% over its declared
tip radius, with `pointer: "NORTH"` (ASM-0069) — the same treatment as the season
and leap-year windows. The month labels already used
`DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS`, so the current month reads at north
under the pointer (verified live: "January"/"Jan"). **To revert:** restore
`centre: windowAbove(monthStarArbor.id, 2, 0.72)`, `outline: { kind: "RECTANGLE",
width: mm(0.65), height: mm(0.6) }` and drop `pointer` in `teachingMovement.ts`
(and the `Month window` expectation in `dialWindowRules.test.ts`).
`dialWindowRules.test.ts`'s rectangle-case tests now use the Year window.

## Phase 8.15 follow-up 8: year window enlarged, barrel and digits unchanged

Per the user's direction ("keep the barrel and digits exactly as they are now,
just make the window bigger"), only the Year window outline changed:
3.4mm × 0.235mm → 3.6mm × 0.4mm. Barrel (0.8mm), digit font (125px) and segment
layout are untouched. **Trade-off, declared:** 0.4mm exceeds the 0.251mm
per-digit slot arc, so the top sliver of the neighbouring digit and its divider
now peek into the window (checked live; at 0.5mm neighbours clearly stack and the
year reads as jumbled, so the height stops at 0.4mm).

## Phase 8.15 follow-up 7: leap-year whole-wheel window with north pointer; larger year digits

Two requests, live: (1) do the season-window treatment for the leap-year wheel
(window the size of the wheel, upside-down triangle at north); (2) the year
window is too small to read.

**Leap-year window.** Now a CIRCLE centred on the wheel's axis, radius 5% over
its declared tip radius, with `pointer: "NORTH"` (ASM-0069). Its labels use
`DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS` so the current position reads at
the window's north. **Layout change:** the Geneva wheel's rim slots face its
driver (slot angles = direction-to-driver + π + kπ/2); labels sit between
slots, so a label can only land at north if the driver lies on a diagonal from
the wheel. The teaching movement's leap-year arbor therefore moved from due
west of the month star to its south-west diagonal at the same 4mm centre
distance (`teachingMovement.ts`). This is a declared teaching-layout change,
not a physical-validation claim.

**Year window / digits.** Digit font 105→125px and window height 0.22→0.235mm (enlarged again in follow-up 8)
(inside the glyph-extent ≈0.218mm / slot-arc 0.251mm band). This is ≈19%
larger, not more: digit size is bounded by the barrel diameter (≈0.82mm cap
from the 1.4mm mainplate-to-dial clearance), so larger digits would merge into
their neighbours. A genuinely larger year display needs a larger barrel
(clearance) or more digit slots' worth of circumference — a design decision.

## Phase 8.15 follow-up 6: four aesthetic requests, two of which uncovered real pre-existing bugs

Four requests, live: (1) the year window still too small to see the full number;
(2) the season window should match the wheel's own size to show its wedge
artwork, with a north index-pointer triangle; (3)/(4) check the date and month
gears for the same clumping/size bug. (1) and the font-size half of (3)/(4)
were genuine continuations of follow-up 5's own bug category; (2) and the rest
of (3)/(4) led to two further, previously-undetected real bugs.

**Year window height (real bug).** Follow-up 5's own fix (0.15mm) stayed under
the 0.251mm neighbour-bleed ceiling but was itself smaller than a digit
glyph's own real rendered extent (measured via `ctx.measureText`: 75px of
105px-font cap height, ≈0.184mm on the real barrel), so the window now
*cropped* every digit's top and bottom instead of leaking a neighbour.
Raised to 0.22mm — inside the (0.184mm, 0.251mm) band with margin either side.

**Season window + north pointer (feature, correctly scoped only once a real
bug underneath it was found and fixed — see below).** Unlike date/month/leap-
year, the season wheel carries real wedge art (sun/leaf/snowflake/flower,
ASM-0058) that a small "catch one label" window would hide almost entirely.
Rebuilt as a CIRCLE centred directly on the wheel's own axis, radius 5% over
the wheel's own declared tip radius, showing the whole wheel. A window this
large no longer answers "which position is current" by its own small size,
so `DialWindow` gained an optional `pointer: "NORTH" | null` field (ASM-0069
schema migration v27→v28) and a new upside-down-triangle index mark
(`DIAL_WINDOW_POINTER_VISUALIZATION`, sized as a fraction of the dial's own
radius, same derivation convention as the hour markers) drawn on the dial
just outside the window's own north edge.

**Disc label ring auto-fit font size (ASM-0067, real bug).**
`DIAL_WINDOW_VISUALIZATION.fontSizePx` (105px) was a single constant shared
by every disc's own label ring regardless of label count or width — tuned,
apparently, only against the lowest-density rings (leap-year/season, 4
positions) and never re-checked against a denser one. Measured directly
against the real rendered canvas: date (31 positions, up to 2 digits) needed
113.4px in a 37.4px slot (≈3× overflow); month (12 three-letter
abbreviations) needed 196.9px in a 96.5px slot (≈2× overflow) — both
genuinely overlapping/clumped, exactly as reported. Fixed by
`discLabelSlotArcLengthPx`/`discLabelFittedFontSizePx`: the shared base font
scales down (never up) only as far as the real measured widest-label width
demands to stay within 75% of its own slot; leap-year/season clamp at scale
1 (unchanged, confirmed never actually broken).

**Date window radius (real bug, a second, independent instance of the same
category).** Even after the font fix, the date window's own 0.6mm radius
was itself more than 3× the date ring's own 0.365mm label pitch (31
positions on a small disc), so it always revealed several adjacent date
numbers at once — previously masked as unreadable overlapping mush by the
font bug, now, after fixing the font, cleanly separated but still wrong
(several distinct numbers in one window). Measured the real fitted-font
glyph's own bounding box (0.287mm × 0.176mm) against the 0.365mm slot pitch:
the valid window radius band is (0.168mm, 0.182mm) — tight, but real.
Shrunk to 0.175mm. Month's own window (0.65×0.6mm against a 0.754mm slot)
and leap-year's (1.2×0.55mm against a 1.696mm slot) were both already
comfortably inside their own valid bands — never actually broken.

**Disc label ring north-alignment (ASM-0068, a major, previously-undetected
real bug, found only by chasing the above).** With the font/size bugs fixed,
date/month/season windows each started showing a single, cleanly isolated,
but *wrong* label — month showed "Jul" against `MonthComplication`'s own
reported "Current position: January" (exactly 6 of 12 months, a half turn);
the season pointer showed "WI" against a true "SU" (exactly 2 of 4 quarters,
again a half turn). Derived directly from `discCapCanvasAngleForMeshAngle`'s
own verified cap reflection and `windowAbove`'s own "+Y = north = current"
convention: label `i`, drawn at `discLabelPlacements`' own un-corrected
default canvas angle, lands at world angle `−π/2` (south) once its own
`shaftAngle = i·step` is applied — exactly `π` (half a turn) short of the
window's own `+π/2` (north), for any `i` or any label count algebraically
(the `i`-dependent terms cancel). Invisible until now: a circular window or
a single centred digit never betrays a left-right or front-back swap, and
this is a front-back (north-south) one — a 4/12/31-way ring was the first
place it could show at all, and only once sized correctly enough to isolate
one label. Fixed with a new, explicit, declared correction
(`DISC_LABEL_CURRENT_AT_NORTH_OFFSET_RADIANS = −π`) passed by date, month
and season's own callers (`discMaterials`'s 4th argument;
`createSeasonTexture` gained the same `canvasAngleOffset` parameter
`discLabelPlacements` already has) — not a changed default on the shared
geometry function itself, so a future caller never silently inherits a
window-placement assumption it didn't ask for. Leap-year's own offset is
independently derived to dodge its real Geneva slot cutouts (a different,
unrelated constraint) and was deliberately left untouched — not verified
either way against this same question, flagged here rather than changed
without evidence.

**`crossesRevolution`'s own `previousAngle = 0` boundary (a second, deeper,
genuinely pre-existing kinematic bug, found while verifying the alignment
fix against `DateComplication`'s own reported truth).** Even with the
alignment and sizing fixes both correct, the date window still read one
step off from "Current position" — "1" expected at the very first simulated
instant, "2" actually shown. Root cause has nothing to do with rendering:
`crossesRevolution` mirrors a `forwardSign = -1` drive shaft's own angle as
`2π − previousAngle` so the same "crosses 2π" check works for either sign —
but left un-reduced, this evaluates to exactly `2π` (not the `0` a shaft
that has not yet moved should read) when `previousAngle` is exactly `0`,
every fresh simulation's own starting angle — so a date complication whose
own drive shaft happens to solve with negative angular velocity (ordinary
mesh-parity bookkeeping, not a design error) fired one spurious extra jump
in the very first simulated instant after every load. Fixed with `% (2π)`
on the mirrored angle — the one boundary case this reduces; every
`previousAngle > 0` already fell strictly inside `(0, 2π)`, needing no
change. Confirmed live: date now reads "1" at t≈0, matching
`DateComplication`'s own "Current position" exactly, with no change to any
other complication's behaviour (verified via a clean single-navigation
Playwright session with a direct debug trace of `shaftAngle`/`driveOmega`,
after first ruling out — and fully explaining away — an earlier, misleading
"two complications" symptom that turned out to be an artifact of chaining
`goto()` then `reload()` in the SAME test harness, not a real duplication).

Verified live throughout via precise canvas/DOM measurement (never
eyeballing a screenshot where a number was actually in question): real
`ctx.measureText` glyph metrics for every font-size and window-size
derivation above; a `DialWindow`'s own "Currently shows" field (the same
`discComplicationLabel` function the Inspector and the rendered texture both
ultimately read from) cross-checked against a pixel-cropped, upscaled
screenshot of the actual rendered aperture, for date, month and season, both
before and after each fix. `tsc -b`, `eslint`, 787 Vitest tests (12 new:
`discLabelSlotArcLengthPx`/`discLabelFittedFontSizePx`,
`createDialWindowPointerOutline`, and `crossesRevolution`'s own
`previousAngle = 0` regression), production build, and the 38-test
Playwright e2e suite all green.

## Phase 8.15 follow-up 5: year window showing two stacked digits, and reading "6202" instead of "2026"

Reported live, with an annotated screenshot: "the other text is jumbled
or not showing the proper entries like the year should say 2026 if the
browser time is activated." Two independent real bugs, both regressions
from this phase's own earlier work.

**Window height (real bug).** The "Year window" `DialWindow`
(`src/app/teachingMovement.ts`) kept its pre-redesign `height: mm(0.45)`
after `barrelDiameter` was shrunk from 2mm to 0.8mm in follow-up 2 (to
clear the mainplate/dial gap) — sized by comparing it to "roughly the
barrel's own 0.4mm radius," which is the wrong comparison for a
horizontal-axis barrel. The quantity a window's height must stay under
is a single digit's own circumferential arc length at the dial-facing
point, `(barrelDiameter/2) × (2π/10)` ≈ 0.251mm for this barrel, not
the radius — 0.45mm comfortably exceeded it, so the window always
revealed part of the neighbouring digit above or below the current one,
reading as stacked/jumbled glyphs. Fixed by lowering `height` to
`mm(0.15)`, safely under the 0.251mm arc length.

**Digit order mirrored (real bug, the one actually matching "should say
2026").** The four digit barrels (thousands/hundreds/tens/ones) are laid
out side by side along world +X, at x = -4.2/-3.4/-2.6/-1.8mm in that
order — chosen on the assumption that world +X reads left-to-right on
screen. It does not, specifically for the dial-side view: `viewport.ts`'s
`frameCamera` points the "DIAL" camera along world +Z with up = +Y (the
dial sits on the movement's −Z side, ASM-0014, so viewing it means
looking from its far side back toward the mainplate), and for that
camera orientation `screen-right = cross(forward, up) = cross((0,0,1),
(0,1,0)) = (−1,0,0)` — screen-right is world −X, a mirror. Every other
disc complication's text on this dial (season, month, leap-year) escaped
this because it is either rotationally symmetric in reading or was
independently tuned per-glyph; a 4-digit row crossing one window was the
first place the mirror actually showed, reading "6202" (exactly the
ones-through-thousands order, reversed) instead of "2026." Fixed by
swapping the x-assignment so thousands gets the barrel closest to 0
(screen-left under the mirror) and ones gets the most negative x
(screen-right): x = -1.8/-2.6/-3.4/-4.2mm for thousands through ones.

Verified live: selecting each of the four `YearDigitComplication` parts
individually and confirming their declared `axleOrigin.x` against which
side of a wide zoomed screenshot they render on (before the fix,
"Year thousands" — the most-negative x — rendered on screen-*right*,
confirming the mirror); then, after the fix, a pixel-cropped, upscaled
(`deviceScaleFactor: 3`, Lanczos-resampled) close-up of the actual dial
window aperture reading "2026" left to right with browser time active
(system date 2026-10-17). `tsc -b`, `eslint`, 774 Vitest tests
(unchanged — both fixes are position/dimension constants, no
domain/kinematic code touched), production build, and the 38-test
Playwright e2e suite all green (one incidental flake in
`presets.spec.ts` under parallel workers, confirmed unrelated to this
change and passing both before and after it when run in isolation).

## Phase 8.15 follow-up 4: toolbar silently clipped on narrow viewports

Real, pre-existing bug, surfaced by the new pulsing button: reported live
as "I still don't see the button" after confirming the deployment itself
was live and the cache was cleared. `.toolbar` carried a blanket
`overflow: hidden` (not inside any media query — active at every viewport
width), while `.toolbar-group` is `flex: none` so no group shrinks to
fit. Whenever the toolbar's total content (file actions, status, the
whole simulation-controls group) is wider than the window, whatever
doesn't fit is invisibly clipped off the right edge, with no scroll and
no wrap — on a narrow phone viewport that silently cut off the entire
simulation-controls group (Pause/Step/Reset/"Set to browser time"/speed),
not anything specific to the new button.

Fixed by switching `.toolbar` from `overflow: hidden` to a horizontally
scrollable `overflow-x: auto` (keeping `overflow-y: hidden`, plus
`-webkit-overflow-scrolling: touch` for a natural touch-scroll feel) —
every control stays reachable by swiping, instead of disappearing.
Verified live at a real mobile viewport width (412px, matching a typical
Android phone): before the fix, the simulation-controls group and the
pulsing button were entirely absent from the DOM's visible bounds, no
scroll possible; after, swiping the toolbar reveals Pause/Step/Reset/the
pulsing yellow button/speed selector, each with a real, in-viewport
bounding box. `tsc -b`, `eslint`, 774 Vitest tests (unchanged — CSS-only,
no domain/kinematic code touched), production build, and the 38-test
Playwright e2e suite all green.

## Phase 8.15 follow-up 3: barrel digits touching; a pulsing "Set to browser time" button

**Digit spacing (real bug).** Reported live: "the numbers on the barrel
are touching each other." Because every glyph is painted rotated ±90°
(`textRotationRadians`, the previous follow-up's own fix), it is the
font's own CAP HEIGHT, not its advance width, that consumes each
digit's 102.4px-wide circumferential slot — at `fontSizePx: 160` that
cap height alone nearly filled the slot. Confirmed by scanning the real
rendered canvas (`createYearDigitBarrelTexture`'s own output) for
contiguous ink runs rather than guessing from a screenshot: 160px gave
only 2 ink runs across all 10 digits (a 3px gap — i.e. genuinely
touching), against 11 separate runs with a ~28px gap at the new value.
Fixed by lowering `fontSizePx` to 105.

**Pulsing "Set to browser time" button.** Every toolbar button, this
one included, was previously unstyled (the shared dark `--bg-2` button
style, no colour of its own). Added a `pulse-yellow` CSS class (yellow
background `#e8c547`, black text, a looping `box-shadow` pulse,
`prefers-reduced-motion`-aware) applied to this one button on mount,
removed by its own click handler the moment it is clicked — a one-time
visual nudge, not a persistent state.

Verified live: the texture-level pixel scan above, and the button's
own class list before/after a click (`pulse-yellow` present, then
absent). `tsc -b`, `eslint`, 774 Vitest tests (unchanged — both
changes are visual-only, no domain/kinematic code touched), production
build, and the 38-test Playwright e2e suite all green.

## Phase 8.15 follow-up 2: barrel/housing poking through the mainplate and dial

Reported from a live screenshot: a black box visibly protruding above the
dial. Real bug, distinct from the previous follow-up's stray-position one
(that one was fixed; this one is a genuine size/clearance problem).

On a horizontal-axis barrel, `barrelDiameter` sets the Z-extent directly
(the circular cross-section lies in the Y-Z plane), unlike the old
vertical-axis drum, where diameter only set the flat XY footprint and a
separate, small `thickness` set the Z-extent. The teaching movement
carried the old drum's own numbers over unchanged (2mm diameter,
axleHeight -0.7mm), which needs about 2.8mm of mainplate-to-dial
clearance (diameter + the housing's own margin/wall overhead) — but only
1.4mm actually exists there (mainplate underside at 0mm down to the
dial's own back at -1.4mm). The assembly necessarily poked through both.

Fixed by shrinking `barrelDiameter` to 0.8mm (matching `segmentLength`,
giving roughly square segments) and the housing's own
`marginMetres`/`wallThicknessMetres` proportionally (0.3/0.2mm down to
0.12/0.12mm — scaled to the new, much smaller barrel rather than left
oversized relative to it), re-centring `axleHeight` at -0.75mm, and
shrinking the "Year window" height to match (0.9mm down to 0.45mm).
Verified live (Bridge side and Dial side, zoomed on the barrel): no
protrusion through either the mainplate or the dial, 22 info / zero
validation errors unchanged. `tsc -b`, `eslint`, 774 Vitest tests
(unchanged — a teaching-movement/declared-constant change only, no
domain/kinematic code touched), production build, and the 38-test
Playwright e2e suite all green.

## Phase 8.15 follow-up: two real bugs in the first shipped barrel

Found from the user's own first screenshot of the barrel in the live app:
"the numbers are not upright" and "there's a part that's showing on the
dial, it's a black square with black lines."

**Digit rotation.** `createYearDigitBarrelTexture` painted each glyph in
its own natural canvas orientation, with no correction for the fact that
the canvas's own "up" axis maps (through `cylinderXAxisCanvasUForLocalAngle`
and `createXAxisCylinder`'s `rotateZ(π/2)`) to the barrel's own AXIAL
direction, not a radial "up" — so every digit rendered rotated 90°
clockwise from upright. The user's own estimate ("rotate 45° to the
left") had the right direction (counter-clockwise) but undershot the
angle; confirmed empirically by rendering an unambiguous test glyph
("F") through the real pipeline at 0°, 45° and 90° — only 90° reads
upright. Fixed with a new declared `textRotationRadians` constant
(`YEAR_DIGIT_BARREL_VISUALIZATION`, −π/2) applied via `ctx.rotate`
around each glyph's own centre before `fillText`.

**Stray housing.** The housing's own root position (`src/viewport/
viewport.ts`'s year-digit housing build) was reconstructed from only the
barrel's own along-axle midpoint (`midAlong · (cos, sin)` of the shared
`axleDirection`) — a real bug: this recovers a point on the line
THROUGH THE WORLD ORIGIN in that direction, discarding the axle's own
perpendicular offset from the origin entirely. For the teaching
movement (axle direction 0°, but the real axle sits at y = 8mm, not
y = 0), this placed the whole housing at the wrong location — exactly
the "black square with black lines" floating elsewhere on the dial the
user reported, while the barrel itself (whose own root uses each
segment's full declared `axleOrigin` directly, never affected) rendered
correctly. Fixed by recovering the axle's own perpendicular ("across")
offset the same way the along component already is
(`yearDigitAxleProjection` against the direction rotated by π/2),
storing it on the per-month-complication group bucket, and using both
components to reconstruct the housing's own world position
(`midAlong·(cos,sin) − across·(sin,-cos)`, the inverse of the two
projections together).

Both fixes verified live (teaching movement reloaded, "Dial side"
camera, zoomed on the barrel and on the whole dial): digits read
upright and legible, the housing sits directly behind/around the
barrel with no stray geometry elsewhere, 22 info / zero validation
errors unchanged. Full suite green: `tsc -b`, `eslint`, 774 Vitest
tests (unchanged — both fixes are viewport-only, no domain/kinematic
code touched, and `viewport.ts` has no dedicated unit tests, the same
established pattern every other purely-visual viewport fix in this
project already follows), production build, and the 38-test Playwright
e2e suite.

## Phase 8.15: year-digit horizontal-axis "page-flip" barrel (architecture redesign)

Direct, explicit user rejection of the whole vertical-arbor "drum clock"
architecture Phase 8.12–8.14 built: "i dont want 4 gears with 4 windows,
it needs to be 1 large rectangular window with 1 large cylindrical
barrel behind it that is separated into 4 parts that turns all
separately 1 number at a time... the numbers should turn horizontally
when facing the dial." Asked directly which of two readings was meant —
(1) keep the vertical axis but simplify the window/layout, or (2) a
literal horizontal rotation axis, which breaks ASM-0006 (every `Shaft`
axis vertical) and needs a declared exception — the user chose (2)
explicitly, aware of the tradeoff.

**`YearDigitComplication` is no longer a `Shaft` at all** (ASM-0063),
exactly mirroring `KeylessWorks`'s own stem (ASM-0019), the one
pre-existing exception to ASM-0006. It now declares its own horizontal
axle placement directly: `axleOrigin` (Vec2), `axleDirection` (Angle,
plan direction of the rotation axis) and `axleHeight` (Length), plus
`barrelDiameter` and `segmentLength` (replacing `wheelTipDiameter`/
`wheelThickness`). `wheelShaftId` and every check that referenced it
(KIN-001's exemption, the "differs from the month star's own arbor" and
"wheel also geared" validation checks) are gone — there is no arbor to
exempt, differ from, or be geared to. The decimal-carry kinematics
(`digitsToAdvance`) and the declared (not invented) per-segment
`startDigit` carry forward from ASM-0059 completely unchanged — this
redesign only moves WHERE the digit lives in space and HOW it rotates.

**The real defect this fixes.** Phase 8.13's vertical-axis drum wrapped
its digit texture around the cylinder's own lateral surface, but the
dial-side camera looks straight down the SAME axis the drum rotated
about — so a lateral/side-wrapped digit always sat edge-on to that view,
geometrically invisible from the one viewing angle that mattered. The
user named this directly: "the problem you facing is that you using
gears with numbers on it that turns clockwise." A horizontal rotation
axis fixes this structurally, not just by retuning an angle: with the
axis horizontal, the local angle that faces the dial (`atan2(z, y) =
−π/2`, since the root group's own one-time `rotation.z` — which orients
local X along the declared `axleDirection` — never tilts local Z away
from world Z) is a geometric FACT of the construction, not a free
per-texture design choice the way the old drum's own `frontAngleRadians`
was.

**Geometry (ASM-0064).** `createXAxisCylinder` (`src/geometry/
assemblyGeometry3d.ts`) mirrors `src/viewport/keylessMeshes.ts`'s own
stem-rod construction exactly: `geometry.rotateZ(Math.PI / 2)` moves
`CylinderGeometry`'s default axis from local Y onto local X.
`yearDigitBarrelRestAngle(digit, digitCount)` gives the local angle a
digit's own canvas position must sit at so that the live simulated
rotation (`rotation.x = digit × step`, same `yearDigitAngle` state
Phase 8.12 already uses) brings it to the dial-facing angle for every
digit, not just the segment's own starting one.
`cylinderXAxisCanvasUForLocalAngle` inverts `CylinderGeometry`'s own
pre-rotation side-vertex formula through that same rotation to place it
on the canvas — verified against real built vertex data, the same
evidentiary standard `discCapCanvasAngleForMeshAngle` already holds
itself to. `createYearDigitBarrelTexture` replaces
`createYearDigitDrumTexture`.

**Viewport.** Each segment now builds a `root`/`spin` group pair
mirroring `buildStemMeshes` exactly: `root` is positioned at
`axleOrigin`/`axleHeight` with `root.rotation.z = axleDirection`; `spin`
(a child of `root`, no further transform) has its own `rotation.x`
driven every frame from `state.yearDigitAngle` in
`applyKinematicRotation`, the same pattern the keyless stem's own
`stemAngle` already uses. The segment mesh is a child of `spin`.
Horizontal-axis parts are excluded from `cappableSolids` (the
section-view cutaway system) — the same pre-existing, already-documented
limitation `KeylessWorks` parts have, not a new gap.

**Linkage (ASM-0065) and housing (ASM-0066)** carry the same concepts
forward from ASM-0061/ASM-0062 unchanged in kind — a static declutch
wheel pointed at the month star, and an enclosing housing with divider
bars and a mounting bracket — now anchored at the barrel's own
`axleOrigin`/along-axle bounds (`yearDigitAxleProjection`,
`yearDigitBarrelAlongBounds`, `yearDigitBarrelDividerPositions`) instead
of four independent wheel arbors' solved positions.

**Generalizing `DialWindow`.** `DiscComplicationRef`'s own `shaftId`
field became a `position: {kind: "SHAFT"; shaftId} | {kind: "FIXED";
point}` union (`src/domain/discComplication.ts`), so `DialWindow`'s
overlap check (DIALWIN-002) and the inspector's "current position"
readout keep working byte-for-byte for every other complication while
`YearDigitComplication` reports its own `axleOrigin` directly, with no
`Shaft` to look up. `src/assembly/measure.ts`'s `axisOf`/`zRangeOf` gained
their own `YearDigitComplication` case for the same reason.

**Teaching movement.** The four year-digit arbors are gone entirely; the
four `YearDigitComplication` entities now declare their own axle
placement directly (`axleDirection = 0°`, world +X, `axleHeight =
-0.7mm` — the same height the old drum used), laid out as four abutting
0.8mm-long segments on one shared axle at y = 8mm (the same row position
the old drums used). The four separate per-digit `DialWindow`s are
replaced by ONE shared rectangular window (3.4mm × 0.9mm) spanning the
whole barrel — the user's own explicit "1 large rectangular window"
request.

**Persistence.** Schema v26 → v27: a saved design's old
`wheelShaftId`/`wheelTipDiameter`/`wheelThickness`/`wheelZCentre` shape
migrates to the new fields. `wheelTipDiameter`/`wheelThickness`/
`wheelZCentre` carry over exactly (same meaning, new name).
`axleOrigin` is recovered only when the old arbor was itself a declared
FIXED position (every one the teaching movement ever created was);
anything else, and `axleDirection` (a genuinely new degree of freedom
with nothing to carry over), are left `NaN` — flagged by YEARDIGIT-001,
never invented.

ASM-0059–0062 (the superseded vertical-arbor assumptions) are marked
`Superseded` in the register rather than deleted, as the historical
record of the decimal-carry kinematics' own first derivation and of the
defect this redesign fixes. ASM-0063–0066 replace them.

Tests: full rewrite of `yearDigitComplicationRules.test.ts` (the
arbor-existence, "differs from month star," and "wheel also geared"
checks are gone; new dimension checks cover `axleOrigin`/
`axleDirection`/`axleHeight`); 6 call sites in
`simulationState.test.ts` updated from `wheelShaftId` to
`complicationId`/`yearDigitAngle`; `assemblyGeometry3d.test.ts`'s old
drum/housing describe blocks replaced with new ones for
`createXAxisCylinder`, `yearDigitBarrelRestAngle`,
`cylinderXAxisCanvasUForLocalAngle`, `yearDigitAxleProjection`,
`yearDigitBarrelAlongBounds` and `yearDigitBarrelDividerPositions` — the
cylinder and canvas-angle functions verified against real built vertex
data, the same standard the project already holds itself to.
`keyless.test.ts`'s `unreachableShaftIds` allowlist updated: the four
year-digit segments no longer appear in it at all (they are not Shafts).
Full suite green: `tsc -b`, `eslint`, 774 Vitest tests, production
build, and the Playwright e2e suite.

## Phase 8.14: year-digit counter housing, tight row layout, mounting bracket

Further direct user feedback, this time with a reference photo of a real
mechanical tally-counter (four digit rollers packed close together
inside a dark housing, thin dividers between columns): "remove the 4
gears for the year timer and create something like this that's
connected somehow to the movement." One new visual-only assumption
(ASM-0062) — no kinematic change; `shaftAngle`, `digitsToAdvance` and
every validation rule are untouched.

**Layout: 2×2 grid → tight single row.** `src/app/teachingMovement.ts`'s
four digit arbors move from a compact 2×2 grid to one row (2.3mm centre
spacing — 2mm-diameter drums with a 0.3mm clear gap for the new divider
bars), reading thousands/hundreds/tens/ones left to right like a
printed year, matching the reference photo's own four-in-a-row layout.
Still clear of the balance cock's own bridge footprint, the train
bridge, the mainplate's 15mm radius, and the date/month/leap-year/
season wheels further west (verified live — no new validation errors).

**Housing (ASM-0062).** Before this, the four drums (ASM-0059, ASM-0060)
sat fully exposed, each still reading as "a small wheel" individually
even after Phase 8.13's drum redesign. A dark housing now encloses the
row: three plain walls (one behind the row, one at each end) plus thin
divider bars between adjacent wheels — every one a plain
`THREE.BoxGeometry`, no new extrusion technique. Deliberately NO front,
top or bottom cover: the real counter's own "window" effect comes free
from the ordinary fact that a solid cylinder's own far side is already
hidden from the viewer, the same as every other part in this viewport —
no new reveal geometry was needed to get that. Two new pure functions
make this derived rather than invented: `yearDigitHousingBounds` (the
bounding box of the wheel group's own rims, expanded by a declared
margin) and `yearDigitDividerXPositions` (the midpoint between each
pair of wheels adjacent by X), both in `src/geometry/
assemblyGeometry3d.ts`, both built from the group's own already-solved
positions and declared tip diameters.

**Mounting bracket.** A static, never-animated rigid post runs from the
housing's own back wall up to the mainplate's own underside — the
explicit "connected to the movement" the user asked for, additional to
(not a replacement for) Phase 8.13's own ones-wheel-to-month-star
declutch link, which still shows what actually drives the counter.

**Drum colour inversion.** The lateral digit texture's own colours
flipped from dark-on-pale (the convention every other disc complication's
label ring uses) to pale numerals on a dark body
(`YEAR_DIGIT_DRUM_VISUALIZATION`), matching the reference photo's own
dark rollers with light print.

Tests: two new describe blocks in `assemblyGeometry3d.test.ts`
(`yearDigitHousingBounds`, `yearDigitDividerXPositions` — bounding-box
and midpoint math, including the empty/single-wheel edge cases and
order-independence). No domain, simulation or validation code changed,
so no existing test needed updating. Full suite green: `tsc -b`,
`eslint`, 772 Vitest tests, production build, a live-browser validation
check (teaching movement loads with the same 22 info / zero errors as
before the repack), and the full 38-test Playwright e2e suite.

## Phase 8.13: year-digit drum redesign + connection-to-movement linkage

Direct user feedback on Phase 8.12's first shipped look: "the drum clock
is 4 gears, i would like it to be a cylinder with 4 digits displayed
where every digit sits on a drum that rotates from 0 to 9 and also make
sure to display the connection to the movement." Two asks, two new
visual-only assumptions (ASM-0060, ASM-0061) — no kinematic change at
all; `shaftAngle`, `digitsToAdvance` and every validation rule are
untouched.

**Why not a horizontal-axis drum.** The literal mental model for "digits
on a rotating drum" (an odometer) has a HORIZONTAL rotation axis, which
would violate ASM-0006 (every shaft axis parallel to the mainplate's own
normal — i.e. vertical/Z) — a foundational, project-wide structural
assumption, not something to special-case for one complication. Resolved
by keeping the wheel's own existing vertical Z-axis and instead wrapping
the digit texture around the cylinder's own LATERAL (side) surface
rather than painting it on the top cap: the shaft's own already-correct
Z-rotation then naturally brings the current digit to face outward, no
new simulation state needed.

**Drum geometry/texture (ASM-0060).** The top (−Z, dial-facing) cap
keeps the plain position-label ring every other jump-driven wheel
already gets (`discMaterials`, ASM-0051) completely unchanged — the
dial window above each wheel still reveals exactly that, since nothing
about how dial windows work changed. The lateral surface additionally
carries the same ten digits painted around it once
(`createYearDigitDrumTexture`, `yearDigitLocalAngle`,
`cylinderSideCanvasUForMeshAngle`, `src/geometry/assemblyGeometry3d.ts`)
— a dial window was deliberately NOT added/adapted for this surface,
since a top-down window cannot usefully reveal circumferential text (it
would show the surface edge-on, heavily foreshortened). `src/app/
teachingMovement.ts`'s own thickness/diameter ratio for the four digit
wheels changed from a thin disc (0.15mm : 2mm) to a drum/roller
proportion (0.8mm : 2mm); `wheelZCentre` moved from the other
complications' shared −1.2mm to −0.7mm to keep this taller body clear of
both the mainplate's own underside (0mm) and the dial's own back
(−1.4mm) — safe only because the four digit wheels share no x/y
footprint with any other complication at that z-range (ASSY-002
clearance already separates the 2×2 digit grid from everything else).

The lateral texture's own derivation (`cylinderSideCanvasUForMeshAngle`)
required tracking `CylinderGeometry`'s own pre-rotation side vertex/UV
convention (the installed three.js source's own `generateTorso`) through
`createZCylinder`'s `rotateX(π/2)` — unlike the −Z cap's own reflection
formula, this turned out to be a plain rotation (`θ − π/2`), verified
directly against a real built cylinder's own vertex data in
`assemblyGeometry3d.test.ts`, the same evidentiary standard
`discCapCanvasAngleForMeshAngle`'s own regression test already holds
itself to. `yearDigitLocalAngle` works out which mesh-local angle each
digit must be painted at so that whichever digit the wheel is CURRENTLY
showing (not just its own starting digit) faces the same declared "front"
world direction — the digits necessarily run around the drum in the
OPPOSITE rotational sense to the wheel's own increasing `shaftAngle`, the
same way a real drum counter's own printed digits must run backwards
around its rim to read forward as the drum turns forward.

**Connection-to-movement linkage (ASM-0061).** Before this, none of the
four digit wheels had any visual link to anything (unlike date/month/
leap-year, each of which already got one earlier this phase; season is
the one deliberate, still-standing exception). Mirrors
`MONTH_LINKAGE_VISUALIZATION`'s own treatment (ASM-0054) exactly: a small
declutch wheel, drawn once in its own idle/disengaged position, never
animated. Only the ones-place wheel gets one drawn, pointed at the month
star that triggers all four digit wheels' own shared jump event
(ASM-0059) — the tens/hundreds/thousands wheels get no link of their own
to the ones wheel or to each other, since `digitsToAdvance` advances
every qualifying wheel in the SAME simulated instant rather than through
one wheel's own rotation stepping the next; drawing a tooth-engagement
link between them would imply real inter-wheel gearing this project does
not model, which YEARDIGIT-001's own `wheel-also-geared` check explicitly
forbids.

Tests: two new pure-function describe blocks in
`assemblyGeometry3d.test.ts` (`yearDigitLocalAngle`,
`cylinderSideCanvasUForMeshAngle` — the latter verified against a real
built `createZCylinder`'s own side-group vertex/UV data, the same
standard the moon-phase/leap-year regression tests already hold
themselves to). No domain, simulation or validation code changed, so no
existing test needed updating. Full suite green: `tsc -b`, `eslint`, the
full Vitest suite, production build, a live-browser check (the four
drums render taller/cylindrical with lateral digits and a static
declutch-wheel link from the month star to the ones wheel, zero
validation errors), and the full Playwright e2e suite.

## Phase 8.12: `YearDigitComplication`, a "drum clock" year display

Requested directly: "can we add a drum clock for the current year." Clarified
with the user before building: (1) a complication showing the actual
calendar year via rotating drum/cylinder digit wheels, not a 4-position
cycle indicator like `LeapYearComplication`; (2) the displayed year starts
at a declared value (like date always starting at day 1, month at
January), not auto-synced from the browser.

**Four separate digit-wheel entities, not one multi-shaft entity.**
Every existing disc complication (`DiscComplicationRef`,
`src/domain/discComplication.ts`) maps one complication to exactly one
disc/shaft — `DialWindow`, the inspector, componentTree and the viewport
all assume that 1:1 shape. A "drum clock" genuinely needs four rotating
discs (ones/tens/hundreds/thousands) under one logical year value, so
rather than inventing a new multi-shaft abstraction nothing else in this
project has, `YearDigitComplication` (new assumption) is architecturally
identical to `LeapYearComplication`/`SeasonComplication` (a declared
FIXED-position arbor, not meshed with anything, advanced only by a jump)
with an added `digitPlace` field (ONES/TENS/HUNDREDS/THOUSANDS). The
teaching movement declares four instances, all referencing the same
`MonthComplication`, fitting cleanly into every existing 1:1 pattern
(four small discs, four small windows) instead of widening it.

**The genuinely new kinematics: decimal carry propagation.**
`digitsToAdvance` (`src/kinematics/yearDigitComplication.ts`) walks
ONES → TENS → HUNDREDS → THOUSANDS, including a place and continuing to
the next only while the current one's own pre-advance position is 9 —
ordinary decimal carry, the same rule a mechanical odometer or a real
"big date" mechanism's own tens-digit jump already follows. No earlier
jump-driven wheel in this project needed this: date/month/leap-year/
season each only ever have one wheel to advance per trigger. A design
can declare any subset of the four places; a gap stops the carry chain
there rather than inventing a bridge across it (surfaced as a
YEARDIGIT-001 warning, not silently patched over).

**Simulation wiring** (`src/simulation/simulationState.ts`):
`DateJumpTrack.monthCorrection` gained `yearDigitCorrections` (zero to
four entries, each independently declared). Unlike
`yearCorrection`/`seasonCorrection` (each a single precomputed step),
carry needs every declared wheel's own CURRENT position read together,
so `stepSimulation` reads them fresh from `state.shaftAngle` each step
rather than carrying a precomputed step — on the same December-to-
January wrap trigger the leap-year wheel already uses.
`createSimulationState` gained a small loop applying each wheel's own
declared `startDigit` (0-9) as its initial angle: unlike every other
complication here, there is no "natural" zero position for a drum-clock
digit (no sourced way for a watch to know the real calendar year on its
own), so each wheel is independently set, like a real digit wheel would
be set by hand — not derived from a single shared "year" field, which
would need a new kind of cross-entity consistency check this project
does not otherwise have.

**Teaching movement**: four 2mm digit wheels in a compact 2×2 grid,
clear of the balance cock's own bridge footprint and the train bridge,
comfortably inside the mainplate's 15mm radius (verified live — no
INTERFERENCE/clearance errors). Starting digits 2/0/2/6 — today's own
year (2026) at the design's own t=0. Guided tutorial walkthrough
extended with 12 new steps (arbor + complication + window, ×4),
following the exact leap-year/season pattern.

Wired through every generic dispatcher this codebase's complications
need, closely mirroring `SeasonComplication`'s own wiring end to end:
`movement.ts`/`editing.ts`/`lookup.ts`/`measure.ts`,
`discComplication.ts` (plain "0"-"9" labels via the existing generic
label-ring texture, no new art needed), `kinematicRules.ts`'s KIN-001
exemption, the new `yearDigitComplicationRules.ts` (YEARDIGIT-001
dimensions/references/not-geared/duplicate-driver/carry-gap warning,
YEARDIGIT-002 an info row explicitly noting no sourced real wristwatch
mechanism exists for a year display built this way), `viewport.ts`
(new PickKind/COLORS entry, a render loop reusing the plain-disc
pattern), `yearDigitComplicationSection.ts` + `inspector/index.ts`
wiring, `componentTree.ts` ("+ Year digit" button + listing),
`designFile.ts` (decoder + v25→v26 migration), reference registers
(ASM-0059, YEARDIGIT-001/002 in both markdown and TS mirrors), and
`TRACEABILITY.md` (the carry equation, the rule-ID cross-reference).

Tests: `yearDigitComplication.test.ts` (kinematics — step angle, and
`digitsToAdvance`'s full carry-chain behaviour including gaps),
`yearDigitComplicationRules.test.ts` (11 cases), a new "year-digit
(drum clock) correction" describe block in `simulationState.test.ts`
(8 cases covering ordinary advance, each carry depth, a gap, and the
no-complication-declared case). Three pre-existing allowlist-style
tests needed updating, the same recurring pattern every prior
complication phase hits: `store.test.ts` (tutorial step count),
`keyless.test.ts` (unreachable-shaft name list),
`movementKinematics.test.ts` (info-only rule allowlist). Full suite
green: `tsc -b`, `eslint`, 761 Vitest tests, production build, a
live-browser check (teaching movement loads with zero validation
errors, the thousands wheel correctly reads "2"), and the full
38-test Playwright suite.

## Season wheel quadrant art: four wedges, one icon per season

Requested directly: "cut the gear into 4 equal pieces and add some art
representing each season in their respective quarter." The season
wheel previously carried only the generic disc label ring
(`createDiscLabelTexture`, ASM-0051) shared with date/month/leap-year —
a plain disc with just "SU"/"AU"/"WI"/"SP" printed around the rim.

Built a dedicated `createSeasonTexture` (`src/geometry/assemblyGeometry3d.ts`,
ASM-0058), the same "one texture function per complication" pattern
`createMoonPhaseTexture` (ASM-0055) already established, rather than
generalizing the shared label-ring function: divides the disc into
four equal wedges (`seasonWedgeBoundaryAngles`, boundaries at the
half-slot offset between adjacent labels — the same convention the
leap-year Geneva wheel's own rim slots already use relative to their
labels), tints each wedge (gold/Summer, rust/Autumn, ice-blue/Winter,
green/Spring), draws a divider line at each boundary, and draws one
simple icon per wedge — a sun, a leaf, a snowflake, a flower — plus
its position label, both oriented radially (the disc label ring's own
"up points away from centre" convention, ASM-0051). The icons are
generic symbolic glyphs, not sourced from any real watch's own dial
art: purely decorative (ASM-0004), the same "declared, not invented"
treatment the moon-phase illustration already has. Index-matched to
`SEASON_LABELS`'s fixed Q1–Q4 order (Summer/Autumn/Winter/Spring, the
Southern Hemisphere convention from the entry below), so
`createSeasonTexture` is specific to the season wheel, not a generic
N-wedge drawer.

Wired through a new `seasonMaterials` (`src/viewport/viewport.ts`,
mirroring `moonPhaseMaterials`), replacing the generic `discMaterials`
call for this one disc only. The −Z cap's own material colour is set
to white rather than the wheel's base colour so the wedge tints read
true rather than being darkened by it (the same reasoning the label
ring's own near-white texture background already relies on).

Verified live: built the production bundle, loaded the teaching
movement in a real browser, selected and zoomed to the season
complication — the wheel now shows four distinctly coloured,
divided wedges with their icons and labels legible at the window's
own scale.

Tests: `seasonWedgeBoundaryAngles` (`assemblyGeometry3d.test.ts`, pure
layout math, same pattern `discLabelPlacements` already uses — no DOM
canvas in the test environment, so the icon-drawing functions
themselves are exercised only through this live-browser check, the
same treatment `createMoonPhaseTexture`'s own drawing code already
has). Full suite green: `tsc -b`, `eslint`, 733 Vitest tests,
production build, and the full 38-test Playwright suite.

## Season complication: named seasons, Southern Hemisphere (declared, not invented)

Requested directly: rename the season wheel's "Quarter 1–4" labels to
"Q1 Summer, Q2 Autumn, Q3 Winter, Q4 Spring." Phase 8.11 (below)
originally offered the user neutral quarter numbers specifically
*because* named seasons are hemisphere-dependent and no hemisphere had
been declared; this request supplies that missing choice directly,
rather than this project defaulting to one. The requested mapping is
internally consistent: Q1 (January–March, the quarter that starts when
the month star wraps to January) falls mostly within the Southern
Hemisphere's own Dec 21–Mar 20 astronomical summer, Q2 within autumn,
Q3 within winter, Q4 within spring — the Southern Hemisphere's own
astronomical-quarter convention, not an arbitrary string swap. The
Northern Hemisphere reading of the same four quarters is
Winter/Spring/Summer/Autumn.

`SEASON_LABELS` (`src/domain/seasonComplication.ts`) changed from
`["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"]` to
`["Summer", "Autumn", "Winter", "Spring"]`; `SEASON_SHORT_LABELS` (the
wheel's own printed-ring texture) from `Q1`–`Q4` to `SU`/`AU`/`WI`/`SP`
— still two characters each, so the dial window sized for
`SEASON_SHORT_LABELS` needed no resizing. Updated everywhere the old
labels or their "neutral, hemisphere avoided" rationale were quoted:
the inspector section, SEASON-002's validation message, the guided
tutorial step, ASM-0057 (both the markdown register and its TS mirror,
`registers.test.ts` still passes since it checks IDs/status, not
prose), and `docs/ROADMAP.md`'s own "Done" summary (STATUS.md's own
Phase 8.11 entry below is left as it was written, describing the
choice actually made at the time). `isQuarterBoundary`
(`src/kinematics/seasonComplication.ts`) is unrenamed: it is about
calendar-quarter alignment, not season names.

Tests updated: `seasonComplicationRules.test.ts`'s SEASON-002 message
assertions, and `e2e/season.spec.ts`'s inspector text check (now
"Summer" instead of "Quarter"). Full suite green: `tsc -b`, `eslint`,
730 Vitest tests, production build, and the full 38-test Playwright
suite.

## "Set to browser time", and a real pre-existing bug it surfaced in every jump-driven complication

Requested directly: "set the movement to browser time" — a one-click
toolbar action that fast-forwards the running simulation so the dial
reads the computer's actual current local time.

**`AppStore.setToBrowserTime()`** (`src/app/store.ts`) computes the
simulated delta needed for ASM-0014's nominal 12-hour hand
correspondence to land on `new Date()`'s current hour/minute/second,
switches the crown back to `RUNNING` first if it was mid-setting or
mid-winding, then advances by exactly that delta. This is a computed
jump, not a simulated crown-setting action: ASM-0015's own "no
stop-seconds" limitation (already in `docs/STATUS.md`'s known
limitations) means the going train keeps running during a real setting
action, so the seconds hand can't be landed on an exact target that
way. The toolbar button (`src/app/panels/toolbar.ts`) warns if the
resulting dial doesn't actually match the target, rather than silently
claiming success, for a movement not driven at the nominal rate.

**Performance:** advancing up to 12 simulated hours at the standard
1/240 s timestep needs up to ~10.3 million steps — measured at over
10 seconds of synchronous UI-blocking work in a real browser
(headless Chromium, production build, a faked `Date` ~11.9 h ahead).
Fixed with a provably exact (not approximate) optimization: under
`RUNNING` mode, `shaftAngularVelocity` is a fixed, precomputed-once Map
(ASM-0008 — the fixed timestep is a numerical-method choice, not a
physical one), so Euler integration of a constant velocity is exact at
any step size between jump-chain events. `fastForwardTimestepSeconds()`
derives a coarser step from the fastest date-jump drive shaft's own
rotation period (capped well under it, so a single coarse step can
never span a whole revolution and risk `crossesRevolution` missing a
crossing), landing the final stretch at the standard fine timestep.
Re-measured after the fix: ~93 ms, a ~110× speedup, with the dial
landing on the exact same target.

**A regression test written specifically to check the coarse-timestep
optimization doesn't break a date-jump crossing surfaced a real,
pre-existing, unrelated bug**: `crossesRevolution`
(`src/kinematics/dateComplication.ts`) hard-required a drive shaft's
raw solved `angularVelocity` to be positive to count as "forward". But
a drive shaft's solved sign is mesh-parity bookkeeping — each
additional gear mesh between it and any reference flips the computed
sign — not a statement about which way it is genuinely turning. The
teaching movement's "24-hour arbor" (`DateComplication.driveShaftId`)
is one mesh away from the hour wheel, so its solved velocity is
negative under the real `analyzeMovement`-solved gear train, in every
drive mode. `crossesRevolution` therefore never fired for it: the date
star — and, chained off its jump, the month star, leap-year wheel and
season wheel — never advanced under real simulation. Every existing
unit test for this had used a synthetic, always-positive
`driveSolution(1)` fixture, never the real solved train, so this went
unnoticed since Phase 8.2.

**Fix:** `DateJumpTrack` (`src/simulation/simulationState.ts`) gained a
`forwardSign: 1 | -1` field, captured once per track from the sign
`driveShaftId`'s own angular velocity actually has under the design's
normal running solve — the same pattern `WindTrack.sign` already uses
for exactly this reason. `dateJumpTracks()` now takes the running
`GearTrainSolution` (like `windTracks()` already does) to derive it.
`crossesRevolution()` takes `forwardSign` (default 1, so every existing
caller is unaffected) and mirrors its crossing check around angle 0
instead of 2π when a track's forward direction is the raw-negative one.
No assumption register entry changes: ASM-0048's own description
("forward-only crossing of the drive shaft's own angle reference") was
always correct — this is a bug in detecting "forward" per-shaft, not a
change to the assumption itself.

**A second, independent bug surfaced by the same feature, caught only
by a live-browser check (not any unit test) after the above fix**: the
dial, after fast-forwarding, did not actually match the target time —
consistently short by roughly the same proportion as the jump itself.
`stepSimulation` computed `time: seconds(stepCount * dtSeconds)`
instead of accumulating from the previous state's own `time`. That
silently assumed every step a state had ever taken used the same
`dtSeconds` — true of every caller until `setToBrowserTime`'s
coarse-then-fine fast-forward mixed step sizes on one state: the first
step at the new, coarser size got multiplied across every step ever
taken (at the old, finer size), not just itself, throwing `time` off by
roughly (historical step count) × (old dt − new dt). Fixed to
`time: seconds(state.time + dtSeconds)`. CLAUDE.md requires a live
browser check for UI-visible features before calling them done
precisely because of bugs like this one: every unit test for
`setToBrowserTime` had asserted hand readings through `toBeCloseTo`
without an intervening historical dt change on the same state, so none
of them exercised a mixed-dt history and this one slipped past all of
them.

Tests: new `forwardSign: -1` cases in `dateComplication.test.ts`
(`crossesRevolution`), a new "a drive shaft that is negative under the
design's own forward running" describe block and a `time` accumulation
regression (mixed dtSeconds across consecutive steps) in
`simulationState.test.ts`, both exercising the exact scenarios that
were silently broken. `store.test.ts` gained `setToBrowserTime`
coverage, including one test that places the simulation seconds away
from a real date-jump crossing and confirms it still fires through the
coarse fast-forward. Full suite green: `tsc -b`, `eslint`, 730 Vitest
tests, production build, the full 38-test Playwright suite, and a
live-browser check (production build, real Chromium) confirming the
dial lands exactly on the browser's current time after the fix.

## Phase 8.11: `SeasonComplication`, a neutral quarter indicator driven by the month gear

Requested directly: "can you use the month gear to add a season gear that
rotates after every 3 months." Not the "season" item `docs/ROADMAP.md`
8.5 already scoped out and left deliberately unscoped — that is a
genuine equation-of-time/analemma complication (a bean-shaped cam
encoding real orbital-mechanics data) this project still has no source
for. What was asked is architecturally much simpler: a jump-driven
4-position wheel on another complication's own periodic trigger — the
closest existing precedent is `LeapYearComplication` (driven by the
month star's own December-to-January wrap, once a year); `SeasonComplication`
is the same shape, driven by the month star's own jump into
January/April/July/October instead, once a quarter.

**Two real engineering choices put to the user before building, not
invented.** (1) Labeling: named seasons (Spring/Summer/Autumn/Winter)
are hemisphere-dependent — Northern and Southern Hemisphere conventions
assign opposite seasons to the same quarter — and this project declares
no hemisphere, so defaulting to one would be a silently-wrong assumption
for half of any userbase. Offered neutral "Quarter 1–4" vs. two named-season
options; the user chose neutral quarters. (2) Phase alignment: offered
the Gregorian calendar-quarter boundary (Jan/Apr/Jul/Oct) vs. the
alternative (Mar/Jun/Sep/Dec); the user chose the calendar-quarter
convention. Both are now ASM-0057's own declared choices, not defaults
buried in code.

**Kinematics (`src/kinematics/seasonComplication.ts`):** `isQuarterBoundary(preAdvanceMonthPosition)`
is true for March/June/September/December (the last month of each
quarter) — the same pre-advance `monthPosition` reading `stepSimulation`'s
existing year-wrap check already uses, so the trigger condition sits
right next to it (`monthPosition % 3 === 2`, derived and unit-tested,
not asserted). `seasonJumpStepAngle()` is a plain 2π/4. Unlike the
leap-year wheel, no sourced real mechanism exists for a quarter-indicator
built this way, so the jump stays instantaneous — the same "no sourced
motion, stays instantaneous" treatment `DateComplication`/`MonthComplication`
already have (ASM-0048/0049), not a declared Geneva-drive upgrade. No
new `SimulationState` field was needed: the wheel's shaft angle is
advanced directly in `stepSimulation`, the same way the month star's own
instantaneous jump already is.

**Wired through every generic dispatcher this codebase's complications
need**, closely mirroring `LeapYearComplication`'s own wiring end to
end: `movement.ts`/`editing.ts`/`lookup.ts`/`measure.ts` (the TypeScript
exhaustiveness checker caught the two `measure.ts` switch cases
automatically, same as it did for `Screw`), `discComplication.ts` (so a
`DialWindow` can target it), `kinematicRules.ts`'s KIN-001 exemption set
(`seasonWheelShaftIds`), the new `seasonComplicationRules.ts`
(SEASON-001 dimensions/references/not-geared/duplicate-driver,
SEASON-002 an info row reporting the drive model and explicitly
distinguishing this from the out-of-scope real season complication),
`viewport.ts` (a plain disc via the already-generic `createZCylinder` +
`discMaterials` + `findDiscComplication` pattern the month star uses —
no new geometry function needed, since there is no sourced mechanism
shape to draw instead of a disc), the new `seasonComplicationSection.ts`
inspector panel, `componentTree.ts` ("+ Season" button and listing), and
`designFile.ts` (decoder + a v24→v25 migration, following the exact
`leapYearComplications` precedent).

**Teaching movement and guided tutorial kept in sync.** Added a
declared "Season wheel" arbor and `SeasonComplication` (same resolution
class as the leap-year wheel, 3mm tip diameter) plus a "Season window"
dial window, following the existing four-complication pattern exactly.
The guided tutorial walkthrough (`tutorialSteps.ts`) gained matching
"add the season wheel's arbor" / "add the season complication" / "cut
its window" steps — the `store.test.ts` structural-equivalence test
(tutorial-built movement vs. `createTeachingMovement()`) caught the
omission immediately when first skipped, confirming the two must stay
in lockstep.

Added: `src/domain/seasonComplication.ts`, `src/kinematics/seasonComplication.ts`,
`src/validation/rules/seasonComplicationRules.ts`,
`src/app/panels/inspector/seasonComplicationSection.ts`. Registered
ASM-0057, SEASON-001/002 (markdown + TS mirrors, `registers.test.ts`
passes) and new `TRACEABILITY.md` rows (kinematics, invalid-input, and
rule-ID cross-reference tables). Tests: `seasonComplication.test.ts`
(kinematics), `seasonComplicationRules.test.ts` (9 cases), a new
`quarter-boundary correction` describe block in `simulationState.test.ts`
(9 cases covering each of the four quarter boundaries, the no-op case,
the instantaneous-jump assertion, and the no-complication-declared
case), and `e2e/season.spec.ts`. Three pre-existing allowlist-style
tests needed updating for the new shaft/info-row, the same recurring
pattern every prior complication phase hit: `store.test.ts` (tutorial
step count), `keyless.test.ts` (unreachable-shaft name list),
`movementKinematics.test.ts` (info-only rule allowlist). Full suite
green: `tsc -b`, `eslint`, 718 Vitest tests, production build, and the
full Playwright suite.

## Phase 8.10: `Screw`, and bearing/screw holes on existing frames

Requested directly: "there's missing baseplates that the parts get
screwed on to" — raised against a real gap, with a second question
("will the plate automatically get edited to make space for it") about
auto-resizing an outline, deliberately **not** built here (see below).

**Scoping first.** `Mainplate`/`Bridge` (`Frame` entities) already
existed and were already used by the teaching movement — not actually
missing. What was genuinely missing: `Screw`, listed in CLAUDE.md's own
"Core component model" from the start but never built, and no bearing or
screw holes of any kind in frame geometry (a plain solid extruded slab).
Offered three scopes; the user chose "bearing + screw holes on existing
plates" over "fit outline to parts" (the auto-resize half of the original
question) or both together.

**`Screw` (ASM-0056):** a plain circular through-hole of declared
`diameter`, at a declared plan `position`, through one chosen `Frame` —
wired through every generic dispatcher a new selectable entity type
needs in this codebase: `movement.ts` (collection, `addScrew`/`updateScrew`),
`editing.ts` (`newScrew`, cascade-delete when its frame is removed),
`lookup.ts` (`findEntity`/`SelectableEntity`), `measure.ts` (`axisOf`/
`zRangeOf` — caught automatically by `tsc`'s own exhaustiveness check once
`Screw` joined the union), `inspector/index.ts` + the new `screwSection.ts`,
`componentTree.ts` ("+ Screw" button and a "Screws" list), and
`designFile.ts` (decoder + a v23→v24 migration, following the exact
`dialWindows` precedent). SCREW-001 (position finite, diameter positive,
frame exists) and SCREW-002 (position falls within its own frame's
outline) follow `dialWindowRules.ts`'s own structure exactly.

**Bearing holes are not a new concept bolted on separately — they reuse
the same "declared, never defaulted" rule `Jewel.boreDiameter` already
had.** `frameBearingHoles` (`src/assembly/assemblyGeometry.ts`) punches
one hole per jewel seated in a frame whose own `boreDiameter` is declared
(non-null) and whose shaft's axis is resolved; a jewel with an unknown
bore is skipped outright, not given an invented size. `frameScrewHoles`
does the equivalent for `Screw`. `createFrameGeometry`
(`src/geometry/assemblyGeometry3d.ts`) gained an optional
`holes: FrameHole[]` parameter, punched via `THREE.Path.absarc` directly
in the same movement-plan (x, y) coordinates the outline itself already
uses — no local-frame translation needed, unlike `createDiscWithHolesGeometry`'s
disc-local convention. `viewport.ts`'s frame-mesh loop now computes
`[...frameBearingHoles(...), ...frameScrewHoles(...)]` per frame and
passes it through. Same "visual only, no manufacturing claim" treatment
already given other declared/cosmetic geometry (ASM-0004, ASM-0051): no
thread, head, countersink/counterbore, clamping-torque or
thread-engagement data, and a real screw's second clamped part isn't
modeled either.

**Outline auto-resize deliberately not built.** CLAUDE.md states "never
silently alter user dimensions" as a project principle; a plate that
resizes itself whenever a part is added would violate exactly that, so
this stays a distinct, explicit, user-triggered action (e.g. a future
"Fit outline to parts" button) rather than an automatic side effect of
adding a part — not implemented in this phase.

**Teaching movement:** five illustrative screws added (three on the
mainplate, one on the train bridge, one on the balance cock) — declared
positions within each frame's own outline, not a complete, sourced screw
layout for a real caliber (ASM-0009, same illustrative-input treatment as
the rest of the teaching movement's own dimensions). Jewel bore diameters
are still left unknown on purpose (a separate, already-tracked gap,
BRG-005/006/007) — bearing holes exist in the geometry now but won't
visually appear in the teaching movement until those are filled in
separately; `frameBearingHoles` is exercised by its own unit tests with
a declared bore instead.

Added: `src/domain/screw.ts`, `src/app/panels/inspector/screwSection.ts`,
`src/validation/rules/screwRules.ts`. Registered ASM-0056,
SCREW-001/002 (markdown + TS mirrors, `registers.test.ts` passes) and a
`TRACEABILITY.md` row for the hole geometry. Tests: `screwRules.test.ts`
(8 cases), new `createFrameGeometry` hole-punching cases in
`assemblyGeometry3d.test.ts`, new `frameBearingHoles`/`frameScrewHoles`
cases in `assemblyRules.test.ts`, and `e2e/screw.spec.ts`. Full suite
green: `tsc -b`, `eslint`, 698 Vitest tests, production build, and the
Playwright suite. The "frames are solid slabs without bearing holes"
line in Known limitations below is now stale for the 3D viewport and
narrowed to note it still holds for the STL export only (`stl.ts` calls
`createFrameGeometry` without the new `holes` argument — not touched in
this phase).

## Guided tutorial: driver.js spotlight + built-in speech narration

Requested directly ("add driver.js ... and edge tts for my tutorial
section"). UI tooling, not an engineering change — no new ASM/RULE IDs.

**Spotlight (driver.js).** The tutorial's own custom banner+CSS-pulse
highlight (`tutorialBanner.ts`) is replaced with `driver.js`: a dimmed
overlay with a cutout around the current step's own target, and a popover
(title, instructions, Next/Skip, Exit) anchored to it. `TUTORIAL_STEPS`'s
own data (`tutorialSteps.ts`) and the store's own step-advancement logic
(`store.ts`, still the single source of truth for *when* a step completes)
are unchanged — only the rendering layer moved.

**Narration: the browser's own speech synthesis, not Microsoft's edge-tts
service.** Investigated first: edge-tts's own WebSocket now requires a
header browsers cannot set themselves, so direct-from-browser calls only
work from within Edge itself; reaching it from any other browser needs a
server, and this project has none (a static Vite build, no backend).
Confirmed with the user, who chose the browser's own built-in
`SpeechSynthesis` API instead — zero backend, zero network call, works
offline, and already exposes the same high-quality online voices on
Windows/Edge that edge-tts itself uses.
`tutorialNarration.ts`'s `pickPreferredVoiceIndex` (pure, unit-tested)
prefers an English voice whose own name advertises "Natural"/"Neural"
synthesis over a plain English voice over anything else. A small
body-level toggle button (shown only while the tutorial is active) mutes
narration, persisted across sessions the same way autosave's own
`KeyValueStore` is used elsewhere.

**Two real bugs found integrating a third-party overlay library with this
app's own reactive rendering, not just test artifacts** — each would have
affected a real user, not only the e2e suite:

- **The narration toggle was unclickable.** `driver.js`'s own stylesheet
  sets `.driver-active * { pointer-events: none }` on the whole `<body>`
  subtree while a tour is active, re-enabling it only for its own popover
  and the highlighted element. The toggle, a sibling of `.driver-overlay`
  with a *higher* z-index, still inherited `pointer-events: none` from
  this blanket rule — z-index decides paint order, not whether an element
  receives pointer events at all. Fixed with an explicit
  `pointer-events: auto !important` on the toggle.
- **Driver.js's own cached element reference can go stale.** Clicking a
  step's own target (e.g. "+ Bridge") completes the step and re-renders
  the Components tree panel, tearing down and rebuilding its buttons —
  driver.js caches the *element it was given*, and its own next internal
  refresh (scheduled via `requestAnimationFrame`, independent of this
  app's own render calls) can end up measuring a now-detached node,
  collapsing the spotlight's cutout to zero size and silently blocking
  the real click underneath the now-solid overlay. Found by comparing the
  overlay's own SVG cutout path immediately after a click (correct) against
  one animation frame later (collapsed to a near-origin sliver) while a
  `MutationObserver` confirmed no second `highlight()` call from this
  app's own code. Fixed by re-asserting the highlight (re-querying the
  selector fresh) one frame after the first, consistent with CLAUDE.md's
  "verify against real data, not just algebra" — this was found by
  inspecting the library's own compiled output and live DOM state, not
  by guessing from its documented API.
- A third, narrower positioning issue (the popover opening on top of a
  target in the narrow left-hand Components panel) was fixed by preferring
  `side: "right"` for every tutorial popover (driver.js still falls back
  to another side on its own when "right" has no room, e.g. an
  Inspector-panel target) and disabling driver.js's own 400 ms transition
  animation (its position math measures a popover mid-transition
  otherwise, not the final settled target).

**Verification.** 6 new unit tests for `pickPreferredVoiceIndex` (pure);
`createTutorialNarrator`'s own `window.speechSynthesis` calls are untested
directly (this project's vitest environment is Node, no DOM — the same
already-accepted limitation canvas-texture code has), confirmed live
instead. `tutorial.spec.ts` updated for driver.js's own DOM
(`.driver-popover`, `.driver-active-element`) in place of the old
`.tutorial-banner`/`.tutorial-target`; a new test covers the narration
toggle's own visibility and mute/unmute behaviour. Full vitest suite (681
tests, 6 new), typecheck, lint, production build, and the full e2e suite
(33 tests, 1 new) all pass under `--workers=1`.

## Tutorial narration follow-up: real edge-tts via a separate Supabase proxy

Follow-up to the above, in two rounds. First: "change the voice to Morgan
Free[man]" — declined outright, not a scope question. Cloning a specific,
identifiable real person's voice without their consent is impersonation,
independent of the use being an internal tutorial; offered a voice picker
over the browser's own voices instead. Second: "is it possible to import
a voice" → "can we use supabase as a backend", landing on reviving the
original edge-tts request properly this time, now that real backend
infrastructure is on the table — not a cloned/custom voice, genuine
Microsoft neural voices (the same family edge-tts always offered), reached
through a backend that can actually call it.

**Why a backend fixes this now.** The original blocker (documented above)
was specifically a *browser* restriction: edge-tts's WebSocket needs a
header (`Sec-WebSocket-Version`) browser JavaScript cannot set. That
restriction does not exist server-side. A Supabase Edge Function runs on
Deno — full control over its own WebSocket headers — so it can call
Microsoft's real service directly and stream the audio back.

**Isolation from the user's own existing Supabase-hosted web portal**
(their explicit concern, "I don't want to corrupt it"): the function is
meant to be deployed to its own, separate, newly-created Supabase
project — its own database, auth and functions, nothing shared with any
other project. `supabase/functions/tts-proxy/README.md` spells out the
exact steps (new project, CLI link, deploy, copy the new project's own
URL/anon key into `.env.local`). Nothing in this repo references any
particular Supabase project; it is entirely opt-in via two Vite env vars
(`.env.example`), unset by default, and the app has always worked without
them (the browser's own `speechSynthesis` fallback, already built).

**What's implemented:**

- `supabase/functions/tts-proxy/index.ts` — the Deno Edge Function.
  Validates its own request body, calls `edge-tts-universal`'s
  `IsomorphicEdgeTTS` (the variant built on Web-standard APIs only,
  confirmed via that package's own compiled type declarations to be the
  one that actually runs under Deno — its default `EdgeTTS` export is
  Node-only and explicitly documented as unsupported there), and returns
  the synthesized audio bytes directly. CORS-open; access-gated by
  Supabase's own default per-function JWT check (the project's anon key),
  not a secret of its own.
- `tutorialNarration.ts` extended: `createTutorialNarrator` now tries the
  proxy first (when `VITE_SUPABASE_TTS_URL`/`VITE_SUPABASE_TTS_ANON_KEY`
  are set), with an 8s timeout and automatic fallback to the existing
  local `speechSynthesis` path on *any* failure — unconfigured, network
  error, non-2xx response, or timeout — since this proxies an unofficial,
  unversioned API that could change without notice (the proxy's own
  README says so). A request-token guard discards a stale in-flight
  response if a newer `speak()` call (the user advancing steps quickly)
  has already superseded it.
- `REMOTE_VOICE_OPTIONS` — a curated list of six real, standard Microsoft
  voice names (not custom or cloned), each one a widely documented,
  stable identifier. A voice picker (`tutorialBanner.ts`) appears next to
  the existing mute toggle, but *only* once the proxy is actually
  configured — nothing new shows up for anyone who hasn't set it up.
- `src/vite-env.d.ts` added (typed `import.meta.env` for the two new
  Vite env vars) — this project had never needed Vite's own client types
  before.

**A third real bug, same root cause as the first two.** The new voice
picker and its wrapping control div hit the exact same
`.driver-active * { pointer-events: none }` issue documented above for
the narration toggle — except this time the override had been applied to
the *wrapper* div only, not the button/select inside it.
`.driver-active *` matches every descendant directly (its own selector,
not inheritance), so a `pointer-events: auto` override on a parent does
not reach its children at all; each interactive element needs its own.
Found immediately by the same e2e test that already covered the toggle,
now failing with the wrapper itself named as the thing intercepting
clicks. Fixed by moving the override onto `.tutorial-narration-toggle`/
`.tutorial-voice-picker` directly (kept on the wrapper too, since it does
no harm and documents the intent there as well).

**Verification.** 2 new unit tests for `buildTtsRequest` (the exact
fetch call, pure and testable without real network IO) plus a sanity
test for `REMOTE_VOICE_OPTIONS`'s own uniqueness (683 tests total, 2
new since the driver.js/narration round). `eslint.config.js` now
excludes `supabase/functions/**` — Deno code, a different runtime and
type system, deployed independently of this Vite/Node project, was
never part of its TS program and typed linting cannot run on it as this
project's own config is scoped. Two new e2e tests: the voice picker's
visibility (hidden without the env vars — the default, and the only
configuration exercised in CI, since no deployed proxy exists here) and
a regression test for the pointer-events bug via the existing toggle
test. Full vitest suite (683 tests), typecheck, lint, production build
(confirms the app still builds and runs with the env vars unset), and
the full e2e suite (34 tests, 1 new) all pass under `--workers=1`. The
proxy itself has not been deployed or called live from here — no
Supabase project exists in this environment to deploy to — so the
*proxy call itself* is verified by code review and the package's own
type declarations, not a live round-trip; the fallback path (what every
e2e test actually exercises) is fully verified.

## Phase 8.9 follow-up: moon-phase disc illustration (ASM-0055)

Requested after scoping ("Yes" to scope, then "2 and 3" — the real
crescent reveal plus decorative stars, not just a static marker).
`MoonPhase` was built (Phase 8.1, ASM-0047) with "moon/star artwork is
not modeled" as a deliberate scope cut; with the dial window built
later (Phase 8.6), the window had nothing to actually reveal — a plain
disc, same colour everywhere, even though the phase fraction itself
(`moonPhaseFraction`) was already correct and tested.

- **New texture generator**, `createMoonPhaseTexture` +
  `MOON_PHASE_VISUALIZATION` (`src/geometry/assemblyGeometry3d.ts`): a
  dark sky, one or two pale moon images (`windowsPerRevolution` — SINGLE
  or DOUBLE, SRC-0045's own "two moons 180° apart" Fig. 4), and a fixed,
  declared set of decorative stars (ASM-0004, not a real star chart).
- **No new simulation code needed for the reveal itself.** The dial
  window is already a fixed aperture offset from the disc's own
  rotation axis (Phase 8.6); the disc already rotates correctly. Two
  circles — the fixed window, a moving moon image — sliding past each
  other as the disc turns traces new moon → crescent → full → crescent
  → new moon from ordinary 3D occlusion, the same optical trick the
  real mechanism's own window uses.
- **A genuine, now-fixed bug found via rigorous unit testing**: getting
  that reveal to actually line up required a new pure function,
  `moonImageLocalAngle`, deriving exactly where each moon image must
  sit in the disc's own local frame from `moonPhaseFraction`'s own
  convention. Drawing at that angle directly (the same technique
  `discLabelPlacements` uses for date/month/leap-year's own labels)
  turned out to be wrong: `createZCylinder`'s own −Z-cap UV formula
  (`u = 0.5 − y/2r`, `v = 0.5 − x/2r`, the same formula
  `reshapeCapGroupsForDiscMaterials` already relies on for the leap-year
  wheel) is a *reflection*, not a rotation — a feature drawn at canvas
  angle θ actually lands at mesh angle `−π/2 − θ`, verified directly
  against a real built disc's own vertex UVs, not just algebra. This
  never mattered for date/month/leap-year, since their own correctness
  only ever needed "some label passes under the window at roughly even
  intervals," never exact alignment with one fixed feature. A new pure
  function, `discCapCanvasAngleForMeshAngle` (self-inverse, since
  reflections are their own inverse), corrects for it.
- **Window geometry retuned to match** (`src/app/teachingMovement.ts`):
  the moon-phase window's own offset and radius were chosen for "a
  smaller aperture near the top," not for a clean reveal; retuned to
  `MOON_PHASE_VISUALIZATION`'s own declared fractions so the window and
  a painted moon image are exactly concentric at the real full-moon
  instant and clear of each other (offset × √2 > their summed radii) at
  the real new-moon instant — the same kind of geometry fix the date
  linkage's own `pivotDistanceFraction` needed.
- Registered as **ASM-0055**
  (`reference/assumptions/ASSUMPTION_REGISTER.md`,
  `src/reference/assumptions.ts`), and `MoonPhase`'s own doc comment
  (`src/domain/moonPhase.ts`) updated — no longer "moon/star artwork is
  not modeled."

**Verification.** Three regression tests cover the math: evenly-spaced
local angles for SINGLE/DOUBLE, world-position alignment with the
window at every real full-moon instant, and clearance at every real
new-moon instant (the last one using the teaching movement's own actual
declared disc/window numbers, not abstract values, so a future edit to
either without the other would be caught). A fourth test cross-checks
`discCapCanvasAngleForMeshAngle` against a real `createZCylinder`
disc's own vertex UV data (not just the algebra it was derived from).

Live-browser confirmation took real effort to get right: an initial
pixel-level check (reading back the WebGL canvas via `drawImage`)
repeatedly found nothing where the moon images should be, even for the
already-shipped, already-correct date star — that control result
showed the *readback technique itself* was unreliable (almost certainly
a `preserveDrawingBuffer` timing gap), not the product. Switching to
Playwright's own native screenshot capture (reliable, confirmed against
the same date-star control) showed a uniform grey disc at first, two
different ways in turn — before realizing why: selecting the disc's own
complication enables the viewport's "draw through occluding geometry"
mode (`applySelection`), which also retints every material to
`COLORS.selected`, washing out the texture's own contrast; leaving it
unselected instead let the dial's own opaque disc legitimately occlude
the moon disc outside its tiny declared window, since that's exactly
what the real window geometry is for. Hiding the dial (the viewport's
own "Dial" visibility toggle) removed both confounds at once and showed
the disc exactly as built: dark sky, two pale moon images, stars,
rotating correctly with `shaftAngle` — matching the fix. Getting a
clean screenshot through the window itself specifically (at its real,
tiny 0.7 mm scale) stayed short of fully conclusive, most likely a
parallax/projection detail in the verification script's own screen-space
math (the window sits at the dial's own z, the content it reveals at
the disc's, several mm further back) rather than the product; the
math-and-geometry proof above does not depend on getting that last
screenshot.

Verified: typecheck, lint, full vitest suite (672 tests, 4 new),
a production build, and the live-browser checks described above. Full
e2e suite run (known layout/presets/tolerances flakiness under
2-worker parallelism in this sandbox reconfirmed as non-regression via
an isolated `--workers=1` rerun, all 8 passing).

## Bugfix: leap-year wheel's own position-label texture never rendered

Reported directly ("the leap year text is not showing on gear"), twice —
the first fix below was real but incomplete; the user's follow-up
report ("the leap year is still not showing") caught the second,
independent cause.

**Cause 1 — wrong material group.** `createGenevaWheelGeometry` (Phase
8.9) returns a `THREE.ExtrudeGeometry`, but `discMaterials`
(`src/viewport/viewport.ts`, which builds the 3-entry label-texture
material array) assumes `CylinderGeometry`'s own group layout —
`[sides, +Z cap, −Z cap]`, three separate groups, the layout every
other labeled disc (date, month) uses via `createZCylinder`.
`ExtrudeGeometry` actually produces only two groups by default —
`[caps (front and back combined), sides]` — so `discMaterials`' labeled
material (array index 2) matched no face group at all: the wheel always
rendered in its plain colour, the label texture silently never drawn.

- Fixed in `createGenevaWheelGeometry` itself (not `discMaterials`,
  since this is the project's only `ExtrudeGeometry` ever passed to it):
  a new `reshapeCapGroupsForDiscMaterials` helper splits the combined
  caps group back into its own front/back halves — found by scanning
  for where the group's own z value changes, since `ExtrudeGeometry`
  lays the front cap down as one contiguous triangle run followed by
  the back cap as a second, not interleaved — and relabels all three
  groups to match `CylinderGeometry`'s own convention, so
  `discMaterials`' existing 3-entry array now works unchanged.
- Verified live by inspecting the mesh's own material array and
  geometry groups directly in the browser: the labeled material (index
  2, `materialHasMap: true`) landed on the correct (−Z, dial-facing)
  face group — but this alone turned out not to be sufficient, below.

**Cause 2 — unnormalized UVs (the actual remaining cause).**
`ExtrudeGeometry`'s own default UVs are each cap vertex's raw local
(x, y) position in metres (e.g. ±0.0015), not normalized into the
`[0, 1]` unit square `createDiscLabelTexture`'s ring-of-labels drawing
assumes — `CylinderGeometry`'s own caps normalize by radius instead.
With cause 1 fixed but this left alone, the label material was on the
right face but the entire texture sampled from a razor-thin sliver of
UV space near the origin: in practice, invisible. Found by comparing
the Geneva wheel's own UV range (≈ ±0.0015) against a `createZCylinder`
disc's (exactly `[0, 1]`), then empirically deriving `CylinderGeometry`'s
own exact −Z-cap formula (`u = 0.5 − y/2r`, `v = 0.5 − x/2r`; the +Z cap
sign-flips `v`) from a real built disc.

- Fixed in the same `reshapeCapGroupsForDiscMaterials`: after
  reassigning the groups, it now also rewrites every cap vertex's own
  UV using that exact formula (now taking `tipRadius` as a parameter),
  so a Geneva wheel built from this function reads identically to the
  `createZCylinder` discs that already worked.
- Verified live by extracting the mesh's own label-texture canvas
  directly (`material.map.image.toDataURL()`) rather than trying to
  screenshot the 3D scene — the canvas itself showed each label legible
  and correctly placed around the ring, not overlapping.
- Added two regression tests: one for the group/face assignment (cause
  1), one asserting every dial-facing-cap vertex's UV matches
  `CylinderGeometry`'s own formula exactly and stays within `[0, 1]`
  (cause 2).

**Follow-up — labels shortened to match the month precedent.** Even
correctly mapped, `LEAP_YEAR_LABELS` ("Year 1" … "Year 4 (leap)") are
the longest labels of the three labeled discs, printed on the smallest
wheel (3 mm tip diameter, vs. date's 5 mm and month's 4 mm) — on a real
3D screenshot the ring read as an illegible blur, the same "clogging a
small disc" problem the user already asked to fix for month's own
labels (`MONTH_ABBREVIATIONS`, Phase 8.6 follow-up). Applied the same
treatment: a new `LEAP_YEAR_SHORT_LABELS` (`src/domain/
leapYearComplication.ts`, plain digits "1"–"4") feeds the wheel's own
printed-ring texture via `findDiscComplication`
(`src/domain/discComplication.ts`); `LEAP_YEAR_LABELS` itself stays the
full "Year N" text everywhere else (inspector, validation,
`discComplicationLabel`), unchanged.

## Bugfix (cause 3): leap-year labels landed exactly on the wheel's own slot cutouts

Reported a third time ("no text showing on leap year gear") after causes 1
and 2 above were both fixed and verified — a live screenshot of the real
teaching movement's own leap-year wheel, framed correctly this time (the
two causes above were each confirmed via indirect means: a live material/
group inspection for cause 1, a direct texture-canvas extraction for cause
2 — neither actually screenshotted the rendered wheel itself), showed the
wheel still perfectly flat, no digits anywhere.

**Root cause.** `discLabelPlacements` (date/month/leap-year's shared label-
ring layout) places labels at canvas angle `(i / n) · 2π` — phase 0, always
— while `createGenevaWheelGeometry`'s own rim slots (ASM-0050) sit at mesh
angle `baseAngle + k · spacing`. The −Z-cap UV reflection
(`discCapCanvasAngleForMeshAngle`, added during the moon-phase work above)
maps a 4-fold-symmetric angle set onto itself, so whenever `baseAngle`
itself is close to a multiple of the slot spacing — which it is, in the
teaching movement's own actual component layout, to within the slot's own
half-width — every one of the four labels lands exactly in a slot's own
cutout. The slot cuts the rim inward to half the tip radius there; the
label ring sits further out (0.72 of the tip radius); there is simply no
geometry at that position for the label's own UV coordinate to land on.
Not a texture, UV-normalization, or material-group problem (all already
fixed) — the texture is correctly drawn, correctly mapped, and correctly
bound, onto a part of the disc that the slot itself had already cut away.

Found by direct, non-destructive live inspection rather than guesswork:
with a temporary debug hook exposing the running `Viewport`, the camera
was moved to sit very close to the wheel along its own existing viewing
direction (bypassing the unreliable mouse-wheel-zoom-toward-cursor
approach, which drifted unpredictably instead of converging on the
target). A diagnostic swap of the labeled material's own texture image for
a flat red/blue test pattern rendered sharp and correctly positioned,
proving the geometry/UV/material pipeline itself was sound and ruling out
mipmap blur, backface culling, and stale-shader theories in one step. With
the pipeline cleared, a per-angle scan of the wheel's own real vertex data
(bucketing every cap vertex by angle, recording the maximum radius seen at
each) showed the wheel's own material genuinely has no geometry at
±5–10° around 0°, 90°, 180°, 270° past 0.5 of the tip radius — exactly
where the four labels, placed via `discLabelPlacements`'s own default
phase, were computed to land.

- Fixed by giving `discLabelPlacements`/`createDiscLabelTexture` an
  optional `canvasAngleOffset` parameter (default 0 — date/month, which
  have no slots to avoid, call them unchanged). The leap-year wheel's own
  viewport code now computes an offset of half a slot's own spacing past
  `baseAngle`, converted through `discCapCanvasAngleForMeshAngle` the same
  way `moonImageLocalAngle` converts a desired mesh angle into a canvas
  one, so every label is centred between two slots — on the rim's own
  full, uncut tip radius — instead of on one.
- Two regression tests build the real `createGenevaWheelGeometry` geometry
  (not just the angle algebra) and confirm both halves directly: the bug
  reproduces at the label ring's own default phase for `baseAngle` at a
  slot-spacing multiple (available material radius at each label's own
  angle is capped at the slot's own inner radius, below the label ring),
  and the fix's own offset formula avoids it across a representative range
  of `baseAngle` values (available radius at each label's own angle is the
  full, uncut tip radius).
- Verified live: with the fix applied, a closeup screenshot (camera placed
  directly via the same debug-hook technique) shows all four digits
  ("1", "2", "3", "4") clearly legible, each centred in solid material
  between two rim slots.

Verified: typecheck, lint, full vitest suite (675 tests, 3 new), a
production build, and the live-browser diagnosis/confirmation above. Full
e2e suite (31 tests) passed under `--workers=1`.

## Usability gap (the real reason cause 3's fix stayed unreachable): no way to zoom in on a small part

Reported a fourth time, right after cause 3 above shipped and was reported
fixed — with a screenshot. Cause 3's own live confirmation had used a
temporary debug hook to place the camera directly at the wheel; re-checked
through the actual UI (select the wheel in the component tree, scroll to
zoom), the labels were still unreachable — not because the render was
wrong again, but because there was no way for an ordinary user to get the
camera close enough to see them.

**Root cause.** `OrbitControls`' own scroll-wheel zoom dollies the camera
toward `controls.target`, which `frameCamera` sets once, to the *whole
movement's own* bounding-sphere centre, on load and on every view change —
never toward the cursor and never toward whatever is selected. Scrolling
in on a small, off-centre part (the leap-year wheel least of all: 3 mm,
the smallest of the three labeled discs, and rarely anywhere near the
assembly's own centre) makes it drift toward the frame's edge and
eventually off-screen, long before it is large enough to read. The
rendering fix (cause 3) was completely correct; it was simply never
reachable by the normal zoom/pan affordances the UI offered.

- Added `Viewport.zoomToSelection()`: finds the selected part's own mesh,
  computes its world-space bounding sphere, and moves the camera in along
  its own current viewing direction to frame that sphere tightly — the
  same `radius / sin(fov/2)` distance `frameCamera` already uses for the
  whole assembly, scoped to one part instead, with a touch of margin.
  Re-points `controls.target` at the part so subsequent scroll-zoom orbits
  around it, not the old assembly centre.
- A new **"Zoom to selection"** button (`src/viewport/viewportControls.ts`,
  alongside the existing "Through selection" section-plane button, same
  enabled-only-with-a-selection pattern) in the viewport toolbar triggers
  it.
- This fixes the same reachability gap for date and month's own labels
  too, not just leap-year's — they are larger (5 mm, 4 mm) so the problem
  was less severe, but the same underlying limitation applied.
- Verified live, through the actual UI end to end (no debug hook): open
  the component tree, click "Leap year" to select the wheel (the ordinary
  selection highlight applies, same as any part), click "Zoom to
  selection" — the wheel fills the viewport and all four digits read
  clearly, each oriented radially per `discLabelPlacements`'s own
  convention.
- A new e2e test (`workspace.spec.ts`) checks the button is disabled with
  nothing selected, enables once a part is picked, and that clicking it
  leaves the viewport rendering with no console errors — matching this
  project's existing level of UI-behaviour (not pixel-content) e2e
  coverage elsewhere in the suite.

Verified: typecheck, lint, full vitest suite (675 tests, unchanged — this
is UI camera behaviour, not a new engineering relationship, so no new
unit test), a production build, and the full e2e suite (32 tests, 1 new)
passed under `--workers=1`.

## Non-bug: centre wheel appearing to "touch" the barrel's upper jewel

Reported alongside the above ("the center wheel looks like its touching
the barrel pin"). Investigated and confirmed NOT a geometry or domain
bug: the red peg in question is the Barrel's own upper jewel, mounted in
the Train bridge (z ≈ 4.0–4.8 mm); the centre wheel sits at z ≈ 1.9–2.1
mm (axial position 2 mm, thickness 0.2 mm) — about 2 mm apart in height,
and the barrel/centre arbors are 5.04 mm apart in plan (the gear-mesh
centre distance) — nowhere near touching in real 3D. Confirmed visually
by rotating the live viewport toward a top-down angle: the apparent
contact disappears completely, since it was only ever a 2D screen-space
alignment from the original oblique camera angle (two parts at very
different heights can still project to the same screen position from
some angles — the same thing a real angled photo of a movement would
show). No code change made; `src/validation/rules/interferenceRules.ts`
already checks gear-to-gear axial/radial overlap and reported no errors
for this design.

## Phase 8.9: leap-year visual/mechanical linkage — done (leap year only)

Prompted directly: "why is the date, month and leap year gear not look
like its connected to anything." Answer: by construction, not a bug —
DATE-002/MONTH-001/YEAR-001 actually *error* if a star/wheel arbor is
ever meshed into the continuous gear train, since each complication's
jump mechanism (ASM-0048/0049/0050) simulates only the net discrete
effect, not the real jumper-spring/cam/finger/Geneva-drive contact
geometry a real watch uses to actually connect them. Scoped (requested,
"scope the visual/mechanical linkage") across all three before building
anything: date's cam+roller+jumper-spring (SRC-0042) and month's
declutching drive wheel (SRC-0043) both have only qualitative patent
prose, no sourced closed-form motion curve to play — building a real
linkage for either would mean either inventing unsourced cam/contact
geometry or building a visual-only approximation with no new kinematic
claim. Leap year is different: its real Geneva-drive stroke kinematics
(SRC-0047) were already implemented and tested back in Phase 8.4
(`src/kinematics/genevaDrive.ts`) but never actually wired into the
simulation or rendered — "shovel-ready." Per the user's own choice
("Start with leap year"), this item builds leap year's real linkage;
date's and month's stay unscoped pending the user's next instruction.

- **The real stroke is now simulated, not just the net step.**
  `SimulationState` gained `genevaStrokes`
  (`src/simulation/simulationState.ts`): on the December-to-January
  trigger, instead of jumping the wheel's `shaftAngle` straight to its
  post-index value, `stepSimulation` starts a stroke and plays out the
  real β(α) shape (`genevaWheelAngle`, already-tested since 8.4) across
  subsequent steps, converging to the exact same final angle an instant
  jump would give. A new pure helper, `genevaStrokeDriverAngle`
  (`src/kinematics/genevaDrive.ts`), computes the driver's own angle
  linearly over a declared playback duration,
  `LEAP_YEAR_INDEX_STROKE_SECONDS` (0.4 s) — a genuinely new kind of
  declared constant for this project: no continuously-rotating driver
  exists anywhere in this simplified model to derive a real duration
  from (only the real stroke *shape* has a sourced basis), registered as
  a new assumption, ASM-0052, rather than overloading ASM-0050 (which
  covers the shape) with a claim it doesn't support.
- **The wheel itself now looks like a Geneva wheel.** A new geometry
  function, `createGenevaWheelGeometry`
  (`src/geometry/assemblyGeometry3d.ts`), cuts real radial slots into
  the wheel's rim instead of rendering a plain disc — oriented so one
  slot always lines up with the driver at every dwell position, derived
  from the already-declared wheel/month-star positions (not an invented
  alignment parameter; see the function's own doc comment for why one
  alignment condition at shaftAngle 0 holds at every subsequent dwell by
  construction, a property of equal step/slot spacing).
- **A driver-pin assembly now visibly swings into the wheel each
  trigger.** Built in `src/viewport/viewport.ts` (a small carrier disc
  and pin, both plain `createZCylinder` cylinders — no new geometry
  function needed), positioned at the month star's own arbor (the real
  mechanism's own "journalled on the month star" layout, SRC-0044), with
  its own orbit radius derived from λ × the wheel/driver centre distance
  (both already-declared positions). Not backed by a declared `ShaftId`
  (the driver has no arbor of its own), so tracked in a new
  `genevaDriverPins` map, updated every `applyKinematicRotation()` tick
  — mid-stroke, swept via the same `genevaStrokeDriverAngle` the wheel's
  own β is computed from; dwelling, parked at its entry-ready position,
  since no real continuously-rotating driver's own dwell position exists
  here to show instead.
- Corrected every "not simulated" / "reference figures only" claim this
  upgrade made stale: YEAR-002's own validation message, the leap-year
  inspector section, `componentReport.ts`'s derived rows, and ASM-0050's
  own text (which explicitly said the wheel's position "still only ever
  takes the discrete net step" — no longer true).

Verified: typecheck, lint, the full vitest suite (663 tests, 12 new —
`genevaStrokeDriverAngle` property tests, `createGenevaWheelGeometry`
geometry tests, and four `simulationState.test.ts` tests stepping
through the real stroke a real simulation timestep at a time, confirming
mid-stroke angles match the pure kinematics functions exactly and the
stroke clears on completion), a production build, and a live-browser
spot check (confirmed the leap-year wheel renders as a visibly slotted
4-slot cross, not a plain disc, with no console or page errors).

## Phase 8.9 follow-up: month declutch-wheel visual linkage

Requested directly ("scope month's linkage too", then "build option 1"
from the scoping it produced). Scoping surfaced a real architectural
difference from date: `MonthComplication` has no continuous drive arbor
at all — it only ever advances in the same instant the date star's own
jump lands on day 1 (`stepSimulation`'s `monthCorrection`) — so date's
own trick (hang a cam on an already-spinning shaft) doesn't apply, and
SRC-0043 (month's own sourced mechanism) describes its drive member only
as a "declutching drive wheel set," qualitative prose with no numeric
engagement geometry or timing, same as date's own SRC-0042. Two options
were put to the user: (1) a static, never-animated declutch wheel parked
in its idle/disengaged position — zero new simulation state, same cost
profile as date's linkage; (2) an animated engage/disengage synced to
the jump instant, which would need a genuinely new declared engagement-
duration constant with no source behind it at all (unlike leap year's
duration, which at least times a real sourced stroke shape). The user
chose option 1.

- **New config**, `MONTH_LINKAGE_VISUALIZATION`
  (`src/geometry/assemblyGeometry3d.ts`): just two declared values
  (`wheelRadiusFraction`, `clearanceMetres`) — no new geometry function,
  since the wheel reuses the already-tested `createZCylinder`.
- **A small wheel drawn once**, in `src/viewport/viewport.ts`'s month-
  complication loop: positioned `monthStarTipRadius + wheelRadius +
  clearanceMetres` from the month star's own centre, in the direction of
  the date star that drives it — clear of the star's rim (reads as
  "disengaged," truthfully), offset toward its own real kinematic
  connection point (SRC-0043 ties the wheel set to the date disc). No
  tracking map, no per-tick update, no `applyKinematicRotation()` change
  at all: unlike the date rod (which must re-read the star's live angle
  every frame) or the leap-year driver pin (which sweeps through a real
  stroke), this wheel never moves once built — the honest consequence of
  having neither a continuous member nor a sourced motion to animate.
- **Registered as ASM-0054**
  (`reference/assumptions/ASSUMPTION_REGISTER.md`,
  `src/reference/assumptions.ts`), scoped to the month complication's
  own visual/mechanical linkage, L0/visual only, parallel to ASM-0053 —
  and a short note added to `MonthComplication`'s own doc comment
  (`src/domain/monthComplication.ts`) clarifying the wheel is a visual
  cue, not a contact-geometry simulation.
- No dedicated unit test was added: no new pure function was extracted
  (the placement arithmetic is inline in `viewport.ts`), the same
  treatment the date linkage's own pivot/cam placement math already
  got — only `createRodGeometry` (an actual new function) earned its own
  test in that earlier item, and this item introduces no equivalent.

Verified: typecheck, lint, the full vitest suite, a production build,
and a live-browser confirmation that the wheel renders at the expected
position, clear of the month star's rim, with no console or page errors.

## Phase 8.9 follow-up: date jumper visual linkage

Requested directly ("yes", choosing to build date's linkage now rather
than scoping both date and month first). Unlike leap year, date has no
sourced closed-form motion curve to play (SRC-0042's cam+roller+jumper-
spring description is qualitative prose only, per the original Phase 8.9
scoping), so this is a declared visual-only addition, not a new
kinematic claim: the star's own jump (ASM-0048) stays exactly as
instantaneous as before — no release-velocity profile exists to play out
— and the cam/rod only read that already-computed result each frame,
never drive it.

- **New geometry helpers**, `createRodGeometry` and
  `DATE_LINKAGE_VISUALIZATION` (`src/geometry/assemblyGeometry3d.ts`): a
  unit-length rod (pivot at the local origin, extending along local +X,
  scaled via `mesh.scale.x` and rotated via `mesh.rotation.z` each frame
  to reach any declared tip distance/angle — a reusable "bone-link"
  technique) plus the fractions/sizes the linkage's geometry is derived
  from.
- **A cam on the drive arbor and a jumper rod at the star**, built in
  `src/viewport/viewport.ts`: a plain disc cam, radius
  `camRadiusFraction × centreDistance`, parented directly to the drive
  shaft's own already-existing `shaftGroup` (turns for free, no new
  tracking needed); a pivot point `pivotDistanceFraction × starTipRadius`
  beyond the star's rim (away from the drive arbor) and a rigid rod from
  that pivot to a "nose" that reads the star's own live `shaftAngle`
  every frame via the same `applyKinematicRotation()` loop every other
  shaft uses — a new `dateJumperLinkages` map tracks the rod mesh/pivot
  per date complication, mirroring the leap-year driver-pin's own
  tracking-map pattern. Zero new domain fields and no schema bump: every
  dimension is derived from the drive/star arbors' own already-declared
  positions and the star's own already-declared tip diameter.
- **Registered as ASM-0053** (`reference/assumptions/ASSUMPTION_REGISTER.md`,
  `src/reference/assumptions.ts`), scoped to the date complication's own
  visual/mechanical linkage, L0/visual only — kept separate from
  ASM-0048 (the date jump's own kinematics, unchanged) exactly as the
  leap-year work kept ASM-0052 (declared stroke timing) separate from
  ASM-0050 (the stroke's sourced shape).
- Verified the linkage actually renders and is positioned sensibly by
  inspecting the live THREE.js scene graph directly in a Playwright test
  (world positions, visibility, mesh scale) rather than relying on
  screenshot pixel-peeping alone, since the cam/rod sit tucked among a
  dense gear cluster and are easy to miss or misjudge in a flat
  screenshot; confirmed separately via the viewport's own Explode control
  (unrelated existing feature, used here only to pull overlapping parts
  apart for inspection) that the elements are not occluded or
  mispositioned, just naturally nested among the gear train the way a
  real date-jumper mechanism usually is. A design bug found in the
  process — `pivotDistanceFraction` originally placed the pivot a
  further `0.6 × starTipRadius` outside the mainplate's own 15 mm radius
  than intended — was fixed before committing.
- Added a short note to `DateComplication`'s own doc comment
  (`src/domain/dateComplication.ts`) clarifying that the new cam/rod are
  a declared visual addition, not a contact-geometry simulation, so the
  comment's existing "no finger/cam contact geometry... are modeled"
  claim about the kinematic model still reads as true.

Verified: typecheck, lint, the full vitest suite (665 tests, 2 new —
`createRodGeometry`'s own geometry tests), a production build, and a
live-browser confirmation (both a direct scene-graph inspection and an
exploded-view screenshot) that the cam, pivot and rod render at the
correct positions with no console or page errors. Month's own linkage
remains unscoped-but-not-started, unchanged from Phase 8.9's own
scoping.

## Month star label texture: 3-letter abbreviations (follow-up to Phase 8.6)

Requested directly: the month star's printed-ring texture used the full
word ("January", "February", ...) for each of its 12 positions, visibly
crowding a disc only a few millimetres across — exactly the kind of
clogging a real month indicator avoids by using a short form.

- New `MONTH_ABBREVIATIONS` in `src/kinematics/monthComplication.ts`:
  the first 3 letters of each `MONTH_NAMES` entry ("Jan", "Feb", ...),
  same order and indexing.
- `src/domain/discComplication.ts`'s `findDiscComplication` now feeds
  `MONTH_ABBREVIATIONS` (not `MONTH_NAMES`) as the month star's
  `positionLabels` — the field that reaches `createDiscLabelTexture`
  and is baked onto the disc. Every other month-name display (the
  inspector's "Current position" row, `discComplicationLabel`'s own
  "Currently shows" reading, validation messages, the correction-
  schedule list) keeps the full word, since none of those are painted
  onto a crowded disc.

Verified: typecheck, lint, the full vitest suite (651 tests, 1 new), a
production build, a live-browser spot check (confirmed the month
window's texture now reads "Jul Aug" rather than overlapping full
words), and the full e2e suite.

## Dial windows: rectangular month/year windows (follow-up to Phase 8.6)

Requested directly: change the month and leap-year dial windows from
circles to rectangles, leaving date (and moon phase) circular — a real
month/year window is usually a rectangle wide enough for a word
("January") or short label ("Year 4"), which a fixed-radius circle
cannot show without either clipping the text or revealing its
neighbours on the ring.

- `DialWindow.radius` became `DialWindow.outline`, a discriminated union
  (`{ kind: "CIRCLE"; radius }` or `{ kind: "RECTANGLE"; width; height }`),
  the same tagged-union pattern already used for `ShaftPlacement` and
  `Frame.outline` in this codebase.
- `createDiscWithHolesGeometry` (`src/geometry/assemblyGeometry3d.ts`)
  now punches either shape of hole through the dial mesh.
- A new pure helper, `distanceToRectangle` in `src/math/vec2.ts`
  (clamped per-axis distance to an axis-aligned rectangle), lets
  DIALWIN-002's overlap check and `componentReport.ts`'s derived "Overlap
  with the complication's own disc" row handle a rectangular window the
  same way they already handled a circular one (circle-circle distance),
  without needing a general polygon-overlap routine.
- Inspector gains a Shape selector (Circle/Rectangle) with the matching
  dimension fields; switching shape resets dimensions to empty rather
  than guessing a conversion.
- Schema 22 → 23: an existing dial window's `radius` becomes
  `outline: { kind: "CIRCLE", radius }`, preserving its shape and size
  exactly — the first dial-window schema change since 8.6 shipped.
- Teaching movement: month and leap-year windows are now rectangles
  (1.6 × 0.7 mm and 1.2 × 0.55 mm respectively, at the same offset
  position as before); date and moon phase stay circular. Guided
  tutorial copy for the month-window step now mentions the shape change.

Verified: typecheck, lint, the full vitest suite (650 tests, 8 new —
geometry-helper tests for the rectangle hole case, `distanceToRectangle`
property tests, and DIALWIN-001/002 rectangle-specific cases), a
production build, a live-browser spot check (confirmed the month and
leap-year windows render as visibly rectangular cutouts, the date
window stays round, and the wider month window shows more of its
printed text than the circular one did), and the full e2e suite.

## Phase 8.6: dial windows — done

Prompted by a direct question: "how come there's no visual presentation
of the year, month and season on the dial." Season was correctly out of
scope (8.5), but year and month turned out to be a real gap, not a false
alarm — `MonthComplication` and `LeapYearComplication` (8.3/8.4) rotate
their star/wheel correctly, but nothing made that rotation visible: the
`Dial` had no window concept, its mesh was an opaque solid disc with no
cutout, and even a cutout would have shown a plain-colored disc with no
printed position to read. `docs/ROADMAP.md`'s 8.6 bullet claimed this
cross-cutting display groundwork had shipped "folded into 8.1-8.4" —
that was an overstatement; it had not been built. This item builds it
for real, as its own entity:

- **`DialWindow`** (`src/domain/dialWindow.ts`): a circular cutout in a
  named `Dial`, at its own movement-plan (x, y) and radius, referencing
  any disc complication by a generic `EntityId` — deliberately simpler
  than a general `Outline` cutout (no need to generalize `Frame`'s
  polygon-point-editor UI for one circle), and deliberately not
  concentric with its complication's own rotation axis: real date
  windows sit off-centre, over where the printed ring actually is, so
  exactly one label shows at a time as the disc turns underneath, not
  the whole ring at once or nothing at all.
- **`src/domain/discComplication.ts`**: a `findDiscComplication`/
  `discComplicationLabel` pair unifying MoonPhase/DateComplication/
  MonthComplication/LeapYearComplication's differently-named fields
  (`shaftId` vs `starShaftId` vs `wheelShaftId`, etc.) into one shape, so
  a dial window can reference any of the four without knowing which.
- **Geometry**: `createDiscWithHolesGeometry` (`THREE.Shape` +
  `shape.holes`) punches real holes through the dial mesh at the
  window's own position; `createDiscLabelTexture`/`discLabelPlacements`
  bake each complication's own position labels (month names, "Year 1..4
  (leap)", date numerals, moonphase percentage) onto a canvas texture
  applied to the disc's dial-facing cap, generated once from the domain
  model, not re-synchronized per frame — the existing kinematic rotation
  (8.1-8.4) carries the right label past the window on its own, the same
  way a real printed ring works.
- **A real rendering bug, caught by the live-browser check, not a test**:
  the first version left the label texture's unpainted pixels fully
  transparent. `MeshStandardMaterial.map` is not alpha-blended unless the
  material also declares `transparent: true`, so those pixels still
  contributed their RGB — black — to the lit result, darkening almost
  the entire disc toward black and leaving the (also dark) label text
  essentially invisible against it. Fixed by filling the canvas with an
  opaque near-white background before drawing the glyphs, the same way a
  real printed disc has a pale background under dark numerals.
- **Validation** (DIALWIN-001/002, ASM-0051): dimensions and references
  must be valid; the window must actually geometrically overlap its
  referenced complication's own disc in plan (a warning instead of an
  error while the complication's own arbor position isn't resolved yet,
  an error once it is and there's still no overlap) — otherwise nothing
  would be visible through it, caught before it ships silently broken.
- **A new cascade-delete relationship**: removing a `Dial` now removes
  the windows cut into it (`removeEntity` in `src/domain/editing.ts`) —
  the first ownership cascade in this codebase beyond
  frame/shaft/gear/jewel/coupling/tolerance.
- **A selection-highlighting generalization**: making complication discs
  carry a second material (for the label-texture cap) would have broken
  `viewport.ts`'s `applySelection`/`addPickable`, which assumed a single
  `MeshStandardMaterial` per mesh. Generalized both to handle
  `Material | Material[]` uniformly before this was ever actually
  broken.
- The teaching movement gains one real window per disc complication
  (moon phase, date, month, leap year), each positioned via
  `solvePlacement` at its own complication's actual solved rotation axis
  plus the label ring's own offset; the guided tutorial gains a matching
  step after each complication's own "add" step (71 steps total, up from
  67).
- Schema 21 → 22 (`dialWindows: {}` on migration, ASM-0051).

Verified: typecheck, lint, the full vitest suite (642 tests, 30 new —
geometry-helper tests for `createDiscWithHolesGeometry`/
`discLabelPlacements`, and `dialWindowRules.test.ts` for DIALWIN-001/002
against the teaching movement's own four windows), a production build, a
live-browser spot check (which caught and led to fixing the label-
contrast bug above, confirmed the four windows report live correct
readings and that selection still highlights correctly on the
now-multi-material discs), and the full e2e suite.

## Phase 8: post-shipment audit — done

Before starting Phase 9, audited every touchpoint of all four Phase 8
entities (MoonPhase, DateComplication, MonthComplication,
LeapYearComplication) against each other for staleness and gaps —
domain layer, `Movement`/`editing`/`lookup` wiring, persistence
decoders/migrations, inspector/componentTree/componentReport/viewport,
validation rules and their KIN-001 exemptions, the assumption/rule-ID
registers, the teaching movement, the guided tutorial, and the
simulation jump-chain logic end to end. Found and fixed:

- **Stale "leap years not modeled (Phase 8.4)" text**, left over from
  when 8.3 shipped before 8.4 existed, in 8 places (domain/kinematics
  doc comments, the live MONTH-002 validation message, the inspector's
  "Correction schedule" row, two `componentReport.ts` derived values,
  ASM-0049's own text in both `assumptions.ts` and
  `ASSUMPTION_REGISTER.md`, and a `TRACEABILITY.md` row) — reworded to
  state the real, still-true fact accurately: `LeapYearComplication`
  (Phase 8.4) tracks the 4-year cycle as an indicator wheel only and is
  not wired back into `daysInMonth`/`monthEndCorrection`, so February
  stays fixed at 28 days every year (a stated simplification, ASM-0050
  — the "year cam" that would carry real Feb-29 logic is explicitly out
  of scope, matching SRC-0044's own real mechanism). Not a bug; the
  surrounding text just read as if Phase 8.4 hadn't happened yet.
- Two magic-number `12`s (should be `MONTHS_PER_YEAR`) in
  `monthComplicationSection.ts` and `componentReport.ts`, against
  CLAUDE.md's own "engineering constants belong in named configuration
  objects" rule.
- The guided tutorial's step-count comment ("~51-step") was stale from
  before Phase 8 — the real, measured count is 67 — and its closing
  "covers the whole teaching movement" doc comment omitted the month
  and leap-year complications it does in fact walk through.
- **A real, previously-undetected design gap**: `dateJumpTracks()` in
  `src/simulation/simulationState.ts` picks the *first* `MonthComplication`
  referencing a given `DateComplication` (and the first
  `LeapYearComplication` referencing a given `MonthComplication`) via
  `Array.find`. Nothing validated 1:1 cardinality, so a second
  complication referencing the same target passed every check and
  silently never advanced in simulation. Fixed with new MONTH-001/
  YEAR-001 duplicate-reference checks (`monthsByDate`/`yearsByMonth`
  count maps in `monthComplicationRules.ts`/`leapYearComplicationRules.ts`),
  each flagging every complication sharing a duplicated reference as an
  error, with dedicated tests for both the new error and the
  (corrected) independent-entities case.

Verified: typecheck, lint, the full vitest suite (627 tests, two new),
a production build, a live-browser spot check of the reworded
MONTH-002 message, and the full e2e suite.

## Phase 8.4: leap year / four-year cycle — done

Implemented per the Phase 8 scoping, after first clearing its own research
gate: ROADMAP.md's 8.4 entry flagged "Geneva-drive kinematics are
implementable here" as an open question, not a confirmed yes, pending a
literature check. That check (SRC-0047, a peer-reviewed mechanism-design
paper, independently re-derived from first principles and cross-checked
against two further sources) confirmed it — a genuine yes, with real
closed-form position and velocity equations, not a hand-waved claim.

- `src/kinematics/genevaDrive.ts` (new): a generic, reusable external
  single-pin Geneva (Maltese-cross) drive kinematics module, not watch-
  specific — the same role `math/gearMath.ts` plays for gears.
  `genevaLambda` (the no-shock pin-radius/centre-distance ratio, λ =
  sin(π/n)), `genevaLockingDiscRadiusRatio` (cos(π/n)),
  `genevaWheelAdvanceAngle` (2π/n), `genevaDriverMotionAngle` (π(n−2)/n),
  and the two continuous-motion functions this item's research was
  actually gated on: `genevaWheelAngle` (β(α) = arctan(λ sin α / (1 − λ
  cos α))) and `genevaWheelAngularVelocity` (ω2 = λω1(cos α − λ)/(1 + λ²
  − 2λ cos α)). The secondhand research report's own α reference point
  (measured from slot entry) did not survive independent verification —
  direct driver-pin/wheel-centre coordinate geometry showed α must be
  measured from the stroke's symmetric midpoint instead, where β is an
  odd function of α; this was caught and fixed before shipping, by
  deriving the relationship from scratch and cross-checking it
  numerically, not by trusting the transcription.
- `src/domain/leapYearComplication.ts` (new): a `LeapYearComplication`
  entity, structurally identical in pattern to `MonthComplication` —
  references an existing `MonthComplicationId`, has no drive arbor or
  gear train of its own. `LEAP_YEAR_SLOT_COUNT = 4` is a named constant
  (a four-year cycle has four positions, not a declared per-movement
  field). SRC-0044 (Omega SA, a granted patent): the real mechanism is "a
  rotatable assembly journalled on the month star such assembly including
  a year cam and a Maltese cross" — a cam-plus-Geneva hybrid; this project
  models only the Geneva-drive component, a stated simplification
  (ASM-0050), not a literal reproduction (the year cam, which would carry
  real leap-year logic such as century exceptions, is not modeled).
- **The trigger is chained one level further than 8.3's**, not a new
  mechanism: a `DateJumpTrack.monthCorrection.yearCorrection` field
  (`{ wheelShaftId, wheelStepAngle }`), populated by `dateJumpTracks`
  whenever a `LeapYearComplication` references the `MonthComplication`
  already referencing this date complication. Inside `stepSimulation`'s
  existing jump loop, when the month star's own correction advances it
  AND its pre-step position was December (the last of `MONTHS_PER_YEAR`),
  that is a year-wrap by construction — the year wheel then advances by
  exactly one real Geneva index step
  (`genevaWheelAdvanceAngle(LEAP_YEAR_SLOT_COUNT)` = 90°), in the same
  event. The real mechanism's own continuous, non-uniform pin/slot
  contact motion during that index event is not simulated — only its net
  effect, consistent with how ASM-0048/0049 model their own jump
  mechanisms — though the real kinematics for that motion are implemented,
  tested and cited (`genevaWheelAngle`/`genevaWheelAngularVelocity`), and
  surfaced as reference figures (YEAR-002), not left as inert unused code:
  the peak wheel/driver speed ratio at mid-stroke (λ/(1−λ) ≈ 2.414 for a
  4-slot wheel) is computed from the real velocity formula and reported in
  both the inspector and the validation message.
- YEAR-001 (dimensions/references/`wheel-also-geared`, mirroring
  MONTH-001 exactly) and YEAR-002 (an info message giving the drive model
  plus the real Geneva reference figures: index angle, motion/dwell
  split, λ, peak speed ratio) in
  `src/validation/rules/leapYearComplicationRules.ts`.
- Inspector section, component-tree "+ Leap year" button, component
  report rows (including the same four reference-figure derived values as
  the validation message), and a 3D viewport disc on the wheel's own
  shaft group — same zero-special-case rendering pattern as every other
  shaft-group entity.
- `leapYearWheelShaftIds` is a new `KIN-001` exemption helper (mirroring
  `monthStarShaftIds`).
- Schema migration v20 → v21.
- Teaching movement: a declared leap-year wheel arbor (no gear train of
  its own, positioned further along the same line from the month star,
  comfortably inside the mainplate) and a `LeapYearComplication`
  referencing the existing month complication. Verified live: the
  inspector's reference Geneva figures read "4-slot: 90° index / 90°
  driver motion, λ = 0.7071, peak speed ratio 2.414" — matching a
  hand-derivation of the same formulas exactly; current position reads
  "Year 1"; validation shows YEAR-002's info message and no YEAR-001
  errors.
- The guided tutorial was extended to match (the leap-year wheel's own
  declared arbor, then the leap-year complication itself), preserving the
  existing enforced tutorial/reference-design parity invariant.

Verified: unit tests for the Geneva-drive kinematics
(`genevaDrive.test.ts`: λ and the locking-disc ratio against known
values and the Pythagorean identity, the wheel-advance and driver-motion
formulas, a direct independent coordinate-geometry cross-check of
`genevaWheelAngle`, oddness/monotonicity, and for
`genevaWheelAngularVelocity`: agreement with a numerical derivative of
the position function, integration recovering the net wheel advance, and
boundary/peak checks), a new `simulationState.test.ts` "year-wrap
correction" block (a month-end correction that is not a December wrap
leaves the wheel untouched, an ordinary day in December does too,
December's own correction both wraps the month star and advances the
wheel by exactly one Geneva step, the wheel itself wraps at
`LEAP_YEAR_SLOT_COUNT`, and no leap-year complication means no wheel
movement at all), a dedicated validation-rule test file
(`leapYearComplicationRules.test.ts`, mirroring
`monthComplicationRules.test.ts`), the full suite (625 tests), typecheck,
lint, a production build, a live-browser check (inspector values,
validation console, and a 3-step simulation advance with no crash), and
the full e2e suite.

Next in Phase 8's recommended order: 8.6/8.7 (display/UI groundwork and
validation rules) are cross-cutting and were done incrementally alongside
8.1–8.4 rather than as separate items; 8.5 (season/equation of time)
stays confirmed out of scope. No further Phase 8 sub-item is currently
scoped to start without the user's next explicit instruction.

## Phase 8.3: month / annual calendar — done

Implemented per the Phase 8 scoping: a `MonthComplication` entity that
both advances once a month and enlarges its referenced date complication's
own jump at the end of short months — the "intermittently-engaged
kinematic chain" 8.2's write-up flagged as this item's real new risk, now
designed and built on top of 8.2's own jump-mechanism foundation.

- `src/domain/monthComplication.ts`: a new top-level entity that
  REFERENCES an existing `DateComplicationId` (`dateComplicationId`) —
  distinct from the "entity references a `ShaftId`" pattern used
  everywhere else in this codebase. Chosen specifically so
  `DateComplication` stays exactly as useful standalone as it shipped in
  8.2 (month-awareness is strictly additive), and because this mechanism
  genuinely has no continuous drive arbor or gear train of its own: SRC-0043
  (ETA SA, a granted patent) describes the date disc itself gaining "a
  second toothing (24), a correction drive wheel set (42)... and a month
  star wheel (54) arranged to be actuated at the end of each month" — the
  month star is driven entirely by the date complication's own jumps.
  `starShaftId` is a separate, declared (FIXED-position) arbor, like the
  date star, deliberately not meshed with anything.
- `src/kinematics/monthComplication.ts`: `MONTHS_PER_YEAR` and
  `GREGORIAN_MONTH_LENGTHS` as named constants (February fixed at 28
  days — real, uncontested external facts, not invented or declared
  per-movement, same treatment as 8.1's `SYNODIC_MONTH_DAYS`).
  `monthEndCorrection(dayPosition, monthIndex, dateStarToothCount)` is the
  single formula covering every case: on an ordinary day, one date-star
  step and no month advance; on a month's last day, `dateStarToothCount −
  lastDay + 1` date-star steps (landing exactly on day 1 of the next
  month) and a month-star advance. Verified by hand that this reduces to
  an ordinary single step after every 31-day month, so no special-cased
  branch is needed there.
- **The correction lives in the same jump-application loop 8.2 built**,
  not a parallel mechanism: `DateJumpTrack` in
  `src/simulation/simulationState.ts` gained an optional `monthCorrection`
  field (`{ monthStarShaftId, monthStepAngle }`), populated by
  `dateJumpTracks` whenever a `MonthComplication` references that date
  complication. Inside `stepSimulation`, the existing trigger
  (`crossesRevolution` on the date's own drive shaft) is unchanged; only
  the action taken on a crossing becomes conditional — with no month
  correction, behaves exactly as in 8.2 (always +1 step); with one, reads
  the date and month stars' own pre-step positions (`starPosition`, 8.2's
  own function, reused unchanged for the month star too, keyed off
  `MONTHS_PER_YEAR` instead of a tooth count) and applies
  `monthEndCorrection`'s result to both stars in the same event. No new
  top-level simulation-state field was needed.
- MONTH-001 (dimensions/references, including "does not reference an
  existing date complication" and "star arbor must be different from the
  date complication's own star arbor," plus a `star-also-geared` conflict
  check parallel to DATE-002) and MONTH-002 (an info summary of the
  correction schedule — which months get an extra date-star step and by
  how many — explicitly flagging February's fixed length and the Phase
  8.4 leap-year deferral) in
  `src/validation/rules/monthComplicationRules.ts`.
- Inspector section, component-tree "+ Month" button, component report
  rows, and a 3D viewport disc on the star's own shaft group — same
  zero-special-case rendering pattern as every other shaft-group entity:
  it turns only when the simulation writes into `simulation.shaftAngle`.
- `monthStarShaftIds` is a new `KIN-001` exemption helper (mirroring
  `dateStarShaftIds`): jump-driven shafts are never flagged "unpowered."
- Schema migration v19 → v20.
- Teaching movement: a declared month star arbor (no gear train of its
  own) and a `MonthComplication` referencing the existing date
  complication. Verified live: the inspector's correction schedule reads
  "February (28d, +3), April (30d, +1), June (30d, +1), September (30d,
  +1), November (30d, +1)"; current position reads "January"; validation
  shows MONTH-002's info message and no MONTH-001 errors.
- The guided tutorial was extended to match (the month star's own
  declared arbor, then the month complication itself), preserving the
  existing enforced tutorial/reference-design parity invariant.

Verified: unit tests for the pure kinematics functions
(`monthComplication.test.ts`: `daysInMonth` nominal/wrap/boundary,
`monthEndCorrection` for every Gregorian month length, `monthJumpStepAngle`),
a new `simulationState.test.ts` block directly exercising `stepSimulation`
with a month-aware `DateJumpTrack` (an ordinary day, the last day of a
31/30/28-day month, and month-star wraparound at `MONTHS_PER_YEAR`), a
dedicated validation-rule test file (`monthComplicationRules.test.ts`,
mirroring `dateComplicationRules.test.ts`), the full suite (599 tests),
typecheck, lint, a production build, a live-browser check (inspector
values, validation console, and a 3-step simulation advance with no
crash), and a scratch e2e check of the month complication's inspector,
validation and simulation-stepping behaviour.

Next in Phase 8's recommended order: 8.4 (leap year / four-year cycle),
gated on checking its Geneva-drive kinematics claim against a real
mechanism-design source first, per the original Phase 8 scoping.

## Phase 8.2: simple instantaneous date — done

Implemented per the Phase 8 scoping: a `DateComplication` entity whose
star wheel is NOT a continuous gear-train member — the genuinely new
"jump" kinematic concept Phase 8 flagged as the real risk in this item,
now designed and built.

- `src/domain/dateComplication.ts`: `driveShaftId` is an ordinary,
  already-built, continuously-driven arbor (e.g. a 24-hour wheel geared
  2:1 from the hour wheel, SRC-0042) — zero new domain concept there,
  same finding as 8.1's moonphase. `starShaftId` is a separate, declared
  (FIXED-position) arbor, deliberately not meshed with anything.
- `src/kinematics/dateComplication.ts`: `crossesRevolution` (pure,
  forward-only threshold-crossing detection — the ratchet behaviour real
  jump mechanisms have: reversing the drive, e.g. setting the hands
  backward through the trigger point, never un-advances the star),
  `dateJumpStepAngle` (2π / starToothCount) and `starPosition` (reads the
  star's current discrete position, rounding against floating-point
  drift).
- **The actual jump lives in the simulation layer**, not a display-only
  offset like the escapement's phase trick: `DateJumpTrack`/
  `dateJumpTracks` in `src/simulation/simulationState.ts`, applied inside
  `stepSimulation` itself — each step, for every declared date
  complication, reads the drive arbor's pre-step angle from `state` (never
  mutated) and the solved gear train's live angular velocity, and if
  `crossesRevolution` fires, nudges the star's own stored angle forward by
  one step directly. The star is otherwise untouched by the normal
  per-shaft continuous-velocity loop (it isn't gear-meshed, so it's absent
  from the solver's angular-velocity map) — confirmed correct via a
  dedicated `KIN-001` exemption (`dateStarShaftIds`, same pattern as the
  escapement's `oscillatingShaftIds`) so it isn't flagged "unpowered."
- DATE-001 (dimensions/references), DATE-002 (the star must not also be
  continuously geared — a real configuration conflict, not just an
  advisory) and DATE-003 (the drive arbor's implied jump period, reported
  against one day, ±10% info/warning split) in
  `src/validation/rules/dateComplicationRules.ts`.
- Inspector section, component-tree "+ Date" button, component report
  rows, and a 3D viewport disc on the star's own shaft group — turns only
  when the simulation jumps it, via the same `applyKinematicRotation`
  loop that spins every other shaft group, since the jump writes directly
  into `simulation.shaftAngle`. No special-case rendering code needed.
- Schema migration v18 → v19.
- Teaching movement: a real 24-hour wheel (8:16, exactly 2:1 off the hour
  wheel, SRC-0042) and a 31-tooth date star (SRC-0042's own worked
  number) on its own declared arbor. Verified live: implied jump period
  reads "1 rev per 24.002 h" (the balance governs the whole train at
  very slightly off nominal, same ~0.004% deviation already reported
  elsewhere in this design) — correctly classified as `info`, well inside
  DATE-003's ±10% tolerance.
- The guided tutorial was extended to match (24-hour pinion/arbor/wheel,
  their mesh, the star's own declared arbor, the date complication
  itself), preserving the existing enforced tutorial/reference-design
  parity invariant.

Verified: unit tests for the pure kinematics functions (nominal,
boundary, ratchet/reversal cases) and for the simulation-layer jump
integration directly (`simulationState.test.ts`'s new "date jump"
block: no movement mid-revolution, exactly one step per revolution, many
revolutions wrapping correctly at the tooth count, no movement on a
stationary or reversed drive), a dedicated validation-rule test file
(`dateComplicationRules.test.ts`, mirroring the existing
escapementRules.test.ts pattern), the full suite (577 tests), typecheck,
lint, a production build, a live-browser check (inspector values,
validation message and a 5-step simulation advance with no crash and no
premature jump), and the full e2e suite including the guided-tutorial
walkthrough.

Next in Phase 8's recommended order: 8.3 (month / annual calendar),
which depends on this item's jump-mechanism design and extends it with
an intermittently-engaged kinematic chain (the date disc's own
month-end correction step, and the month star's own drive, per SRC-0043).

## Phase 8.1: moonphase disc — done

Implemented per the Phase 8 scoping (below): a new `MoonPhase` domain
entity (`src/domain/moonPhase.ts`), a flat disc fixed to, and turning
continuously with, its own declared arbor — no jumper/cam mechanism
(ASM-0047). This was the key architectural finding from scoping: unlike
every other Phase 8 item, moonphase needs zero new kinematics, since a
declared arbor geared down from an existing shaft is already fully
covered by this project's gear-mesh/shaft-angular-velocity engine
(Phase 2/3).

- `src/kinematics/moonPhase.ts`: `moonPhaseFraction` (reads the current
  phase cyclically from the arbor's own solved angle, the same pattern
  `readHand` uses — this project tracks no absolute calendar date, so
  this is not a claim to show the real moon phase on any particular real
  date), `impliedLunationDays` and `lunationDriftMinutes` (report the
  gear train's own implied lunation against the real synodic month,
  29.53059 days, SRC-0046 — a comparison only, never fed back into the
  model).
- MOON-001 (dimensions/reference) and MOON-002 (the implied-lunation
  report) in `src/validation/rules/moonPhaseRules.ts`.
- Inspector section, component-tree "+ Moon phase" button, component
  report rows, and a 3D viewport disc that rotates automatically with
  its own shaft group (`applyKinematicRotation`'s existing per-shaft loop
  — no special-case rotation code needed, confirming the "ordinary
  continuous gear train" architecture finding).
- Schema migration v17 → v18 (movements gain an empty `moonPhases`
  record).
- Added to the teaching movement: a two-stage 8:87 reduction off the
  hour wheel's own arbor (≈1/118.27 of its speed), giving a disc period
  of about 59.1 days and, with the conventional two-moon-images-180°-
  apart layout (SRC-0045), a lunation of about 29.57 days — a few tens
  of minutes off the real synodic month, reported (+55 min/lunation)
  rather than engineered away. Illustrative tooth counts (ASM-0009),
  same as the rest of the teaching movement.
- The guided tutorial (`src/app/tutorial/tutorialSteps.ts`) was extended
  with matching steps, keeping the tutorial-built design structurally
  identical to `createTeachingMovement()` (an existing, enforced test
  invariant) rather than leaving moonphase as an undocumented gap.

Verified: unit tests for the pure kinematics functions (nominal,
boundary — zero/non-finite angular velocity, reversed direction —
cases), the full suite (556 tests), typecheck, lint, a production build,
a live-browser check (inspector values and validation message match the
hand-computed figures above), and the full e2e suite.

Next in Phase 8's recommended order: 8.2 (simple instantaneous date),
which is where the genuinely new "discrete jump" kinematic concept
(needed by date/month/leap-year, not moonphase) actually gets designed.

## Phase 8: scoped into ordered sub-items (8.1-8.7)

Phase 7 closed out; per the user's standing request (flagged
2026-10-05), scoped Phase 8 (calendar complications) next. Found and
read five new sources: four granted patents (SRC-0042 simple date;
SRC-0043 annual calendar, ETA SA; SRC-0044 leap year/Geneva drive, Omega
SA; SRC-0045 moonphase, Seikosha) and one NASA astronomical reference
(SRC-0046, the real 29.53059-day synodic month). Full sub-item
breakdown, sourcing and suggested order are in `docs/ROADMAP.md`'s
Phase 8 entry; summary:

- The driving side of every calendar complication here is an ordinary
  continuous gear reduction — zero new kinematics needed, this
  project's existing gear-mesh engine already covers it.
- The one genuinely new concept (needed by date/month/leap-year, not
  moonphase) is the discrete **jump**: spring energy stored
  continuously, released abruptly at a trigger to snap a star wheel
  forward one tooth. Closer in kind to this project's own escapement
  phase-display pattern (derive a discrete-looking display from a
  continuous simulation state) than to anything else in Phase 1-7.
- Recommended order: 8.1 moonphase (no jump-mechanism risk, ships
  independently) → 8.2 simple date (settles the jump-mechanism design)
  → 8.3 month/annual calendar → 8.4 leap year (gated on checking its
  Geneva-drive kinematics claim against a real mechanism-design source
  first, not yet done). 8.5 "season"/equation of time re-researched and
  confirmed out of scope (a profile cam encoding analemma curve data —
  a different mechanism class entirely, "rarely featured in a
  wristwatch" even among grand complications). 8.6 display groundwork
  and 8.7 validation rules are cross-cutting.

Nothing implemented yet — this is a scoping pass only, same as Phase
7.1's initial scoping before any sub-item was built.

## Phase 7.2: impact/sliding-contact dynamics — researched, deliberately not implemented

REF-ENG §9 already flags that "a simple rigid gear mesh is not an
adequate physical model" at unlock/impulse. This phase's research
substantially enriched the source base (SRC-0005, SRC-0006 corrected and
completed; SRC-0041 newly added and read in full) without finding
anything implementable at this project's L1-L3 level:

- **SRC-0005/SRC-0006** (both Rolland et al., *Tribology International*
  2017 and *Wear* 2017 respectively) had null/placeholder metadata from
  an earlier phase. Corrected via Crossref's own bibliographic API (title,
  full author lists, volume, pages, and the real publication year — the
  *Wear* paper's DOI carries a "2016.12" infix that is Elsevier's
  online-first registration month, not its April 2017 citation year).
  Both remain genuinely unread: ScienceDirect/Elsevier paywalled, and
  neither WebFetch nor a direct `curl` with a browser user agent could
  reach the full text — the same access block already hit for SRC-0038.
- **SRC-0041** (Brian M. Naperkoski, *Exploring the Dynamics of a
  Mechanical Watch Lever Escapement Using Finite Element Analysis*, MS
  thesis, Virginia Tech, 2022) is open-access and was fetched and read in
  full (148 pages). It is the single most directly relevant source found
  this phase, and it independently confirms the research gap rather than
  closing it:
  - A full 3D FEM simulation of the escapement's contact dynamics "would
    take weeks to analyze tens of milliseconds of simulation time"; even
    the simplified 2D model needed over a year of calibration against a
    custom physical test rig, and still only achieved two seconds of
    stable operation.
  - Citing Fu's 2008 dissertation (the same study already behind this
    project's SRC-0004): Fu's own numerical lever-escapement model could
    not reach a stable balance amplitude at all — only his simplified
    analytical spring-mass-damper model did. A second, independent
    full-dynamics attempt landing on the same instability.
  - The fitted contact parameters (an Abaqus "friction coefficient" of
    0.00772, a damping coefficient of 1.91 µN·s/rad) are lumped FEM
    calibration constants for one specific physical movement (an ETA
    6497-1), not general material or geometric constants — adopting them
    for this project's generic movements would be exactly the kind of
    uncited-constant substitution CLAUDE.md prohibits.

Decision: leave 7.2 unimplemented. The evidence this phase found is not
"no one has looked" — it is "the people who looked needed a custom rig,
a year of FEM calibration, and still couldn't reach long-term stability."
That is a standing research problem, not a sourcing gap this project can
close by reading one more paper. Revisit only if a source supplies a
validated closed-form (not purely numerical) relationship, or if this
project itself takes on dedicated contact-mechanics work matching
SRC-0041's own scope.

## Phase 7.4: escapement efficiency — further researched, remains genuinely open

Already "partly done" (Q's informal advisory, SPR-004/ASM-0035; a
geometric-only upper bound on escapement efficiency by tooth count,
SRC-0035). This phase's research (the same SRC-0005/0006/0041 above)
adds no closed-form efficiency formula, and SRC-0041 explicitly reports
that the relevant error is not quantifiable from its own kind of model:
"the amount of timing error that the simulated escapement would
experience over an extended period is impossible to quantify without a
watchmaker's expertise, additional information about the design of the
escapement, and data from prolonged stable operation" — stated by the
author of a dedicated, full-FEM thesis on exactly this mechanism, about
their own model. Decision: remains genuinely open, documented rather than
approximated; no change to the existing geometric-only bound.

## Phase 7.5: mainspring torque curve — reconfirmed, remains genuinely open

Re-checked for new leads; none found (same T = Eεbt²/6 flat-spring
formula already cited as SRC-0037, already known to be a narrower, not an
improvement on, this project's own ASM-0026 two-point-line model).
SRC-0041's own experience independently corroborates the underlying
sourcing problem: its author, writing a dedicated academic thesis, could
not find a published mainspring torque value for their own reference
movement and had to use "20 N-mm" sourced from "a timepiece development
consultant on a public forum," because "watchmakers seldom use
conventional torque units" and manufacturers do not publish the figure.
No change to the existing conclusion (SRC-0037/0038/0039): the real
nonlinearity needs per-movement measurement, not a formula.

## Phase 7.6: temperature coefficient implemented; position deliberately not

Found a genuinely actionable Tier 1 primary source: F. A. Gould,
"Precision of Watches and the Effect of Temperature upon Their Rate"
(Bureau of Standards Research Paper RP670, *Journal of Research* vol.
12, 1934, SRC-0040) — a scanned PDF; WebFetch's text extraction failed
outright, so the cached file was read directly with the Read tool's
image support (the same workaround already used for Playtner's figures
and Roymech's spring-rate images).

Gould treats a compensated balance's rate-vs-temperature curve as
"approximately straight lines" near the working range, with the
slope "indicat[ing] the degree of temperature compensation," and
cites "the middle temperature (20 C)" as the reference and "the usual
temperature range 5 to 35 C" as reporting bookends. That is exactly
this project's existing `isochronismCoefficient` pattern (ASM-0034) —
a declared/measured first-order local linearization, null by default,
no universal value (compensated and monometallic/elinvar assemblies
differ by roughly an order of magnitude in Gould's own figures) —
so it was implemented the same way:

- `Balance.temperatureCoefficient: number | null` (ASM-0046).
- `temperatureAdjustedRate`, `MIDDLE_TEMPERATURE_CELSIUS` (20),
  `USUAL_TEMPERATURE_RANGE_CELSIUS` (5–35) in `src/kinematics/balance.ts`,
  mirroring `isochronismAdjustedRate` exactly.
- BAL-001 (finiteness) and BAL-002 (reports the rate at 5 °C and 35 °C
  when a coefficient is declared, combined with the existing isochronism
  sentence into one message) in `src/validation/rules/balanceRules.ts`.
- A new inspector input row and a componentReport parameter/derived row,
  both mirroring the isochronism-coefficient rows.
- Schema migration v16 → v17 (existing balances gain `temperatureCoefficient:
  null`); verified with a scratch test that decodes a synthetic v16 file.

**Positional error, the other half of 7.6, was read (Gould's own
Section III) but deliberately not implemented.** Unlike temperature or
amplitude, a watch's positional rate is not a sensitivity to one ordered
scalar variable — it is a spread across (at least) three rotational
axes (dial up/down, crown positions), referenced to no single "zero."
Fitting it into the declared/measured-coefficient pattern used for
isochronism and temperature would need a materially different domain
shape (per-orientation rates, or a 3-axis model), not a one-line
addition, and no source read this phase supplies that structure. Left
genuinely unmodeled rather than squeezed into a scalar that would
misrepresent it — consistent with REF-ENG §10's own "Physical model"
list, which already named position as unmodeled.

## Phase 7.1.6: researched, deliberately not implemented

Read Playtner's "Center Distance of Wheel and Pallets" chapter in
full, plus Figs. 2, 3 and 4 (fetched and viewed directly). His own
worked example ("the distance from the heel of the tooth to the
pallet center will be .4691 mm... by allowing .1 mm. between wheel and
pallet and .15 mm. for stock on the pallets we find we will have a
pallet arbor [diameter]... .4382 mm" — the transcriber flags the
printed arithmetic itself as `Sic`; working it as
`(heelDistance − clearance − stock) × 2` reproduces his stated result
exactly, `(.4691 − .1 − .15) × 2 = .4382`, so that is almost certainly
the intended formula despite how it is printed) depends on a quantity
this project has never modeled: the escape tooth's own *heel* corner
position, which in turn depends on a tooth-side *lifting* angle
distinct from the tooth's declared *width* (ASM-0037) — "the lifting
angle on the tooth must be less in proportion to its width than it is
on the pallet," and fine watches (A. Lange & Söhne, per Playtner) even
curve the lifting planes rather than leave them flat.

This is squarely the "tooth/pallet FACE contact geometry... true
lifting-face curvature" every prior SOURCES.yml update this phase has
named as deliberately out of scope (ASM-0038 through ASM-0045 all
carry some version of that same exclusion). Approximating the tooth's
heel position using the already-modeled `toothWidthAngle` in place of
a real, separately-sourced tooth-lift angle would be exactly the kind
of uncited substitution CLAUDE.md rules out ("never invent an
engineering constant... mark it UNKNOWN, ask for a source, or register
an explicit assumption") — and inventing a new domain field (a tooth
lift-angle split) just to unblock an item the roadmap itself flagged
as smallest/lowest-priority would reopen a boundary this project has
held deliberately firm since 7.1.1.

Decision: leave 7.1.6 unimplemented, documented here as a genuine
research finding rather than silently dropped or approximated. Revisit
only alongside real tooth/pallet face-contact work (the same family as
7.2's impact/sliding-contact dynamics), not before.

## Phase 7.1.5.6: ruby pin and single roller in the 3D viewport (grounded slice)

Sixth and last of 7.1.5's sub-items — the visual capstone, flagged in
`docs/ROADMAP.md` as "by far the largest single piece here; likely the
highest-risk item in the whole of 7.1.5." Fetched and viewed Fig. 25
("The Horn") first, which confirmed the risk: a real two-pronged fork
with curved horn jaws cradling a roller with a notch (the crescent)
cut into its edge — neither curve has a stated formula, only derived
angular bounds (`crescentHalfAngle`, ASM-0044; the horn's own freedom,
ASM-0045).

- **Scoping decision, put to the user first.** Three options: the full
  capstone (curved horn jaws + crescent notch + roller + ruby pin,
  with invented-but-flagged curvature for the two shapes with no
  formula), a grounded slice (only what's directly derivable), or
  deferring 7.1.5.6 entirely. The user chose the grounded slice.
- **Ruby pin, drawn at its real position (`src/viewport/viewport.ts`).**
  A small cylinder at `impulseRadius` from the balance centre
  (ASM-0041), in the direction toward the pallet arbor at the
  escapement's placed (rest) pose — attached to the balance's own
  rotation group, so it swings with the balance's simulated motion
  like every other escapement mesh already does. Drawn whenever
  `impulseRadius` is entered (true for the teaching movement, 0.9mm).
- **Single roller, drawn as a plain disc.** Radius = `rollerRadius`
  (ASM-0044), centred on the balance, drawn only for `rollerKind ===
  "SINGLE"` with a positive declared radius. The crescent notch is not
  cut into it — that would need the notch's own curvature, which
  isn't derivable, only its angular span.
- **Fork bar length finally reconciled (deferred since 7.1.5.1).** The
  bar's own drawn length now uses the real `forkActingLength` when it
  is positive and strictly less than the actual placed pallet-to-
  balance distance — never overshooting past the balance. Falls back
  to the pre-existing cosmetic 85%-of-distance placeholder otherwise,
  which is what the teaching movement itself still uses: its own
  `forkActingLength` (4.5mm) does not fit its own placed distance
  (3.5mm), the same inconsistency ASM-0044 already documented.
- **Deliberately not drawn:** the crescent's notch profile and the
  horn's own curved jaws. Both have genuinely derivable angular bounds
  but no derivable physical outline — drawing a specific curve would
  mean inventing it, not computing it, which is exactly the line this
  project's engineering-honesty discipline draws.
- **Verification.** No new pure functions were added (only new cosmetic
  visual constants, `ESCAPEMENT_VISUALIZATION.rubyPinRadiusMetres`/
  `rubyPinThicknessMetres`, under the existing ASM-0012 convention), so
  no new unit tests were needed — this is viewport-only code, tested
  the same way the rest of the viewport's mesh-wiring already is: live
  in a real browser. Verified the ruby pin renders at a stable,
  correct position (unaffected by unrelated field changes, as
  expected) and that entering a roller radius visibly adds the disc,
  with no page errors; separately verified the section-cut view (which
  consumes the same new `cappableSolids` footprints) renders without
  error once a roller is entered. 539 unit tests pass (unchanged, no
  new pure functions); `tsc -b --noEmit` and `eslint` are clean;
  production build succeeds; full e2e suite (31 tests) passes.

All six sub-items of Phase 7.1.5 ("Fork and roller action", SRC-0036)
are now done.

## Phase 7.1.5.5: horn freedom and the derived clearance (ESC-113, ASM-0045)

Fifth of 7.1.5's six sub-items, from SRC-0036's "The Horn" chapter —
much simpler than 7.1.5.4's crescent, once read in full: the horn's
own freedom needs no cross-centre geometry at all.

- **Turned out simpler than scoped.** `docs/ROADMAP.md` had flagged
  this as "a similar circle-intersection construction" to the
  crescent. Reading the full chapter showed otherwise: Playtner states
  outright that "the freedom between dart and roller, of ruby pin with
  acting edge of fork and end of horn are all measured from the
  pallet center, while the impulse angle and the crescent are measured
  from the balance center." The horn's end lies on the *same* arc as
  the ruby pin — "we plant the compass on the pallet center and the
  center of the face of the ruby pin and draw k k, which will be the
  path described by the horn" — so no new radius field and no
  real-placement dependency were needed, unlike 7.1.5.4.
- **`PalletGeometry.hornFreedom` (declared, optional °, new field).**
  "The end of the horn is... planted upon it from 1½° to 1¾° from the
  ruby pin." Must be strictly less than the total lock, the same hard
  necessity as `rubyPinEntryFreedom`/`guardPointFreedom`: "it must in
  any case be less than the lock on the pallets, so that the fork will
  be drawn back against the bank in case the horn be thrown against
  the ruby pin" (ESC-113).
- **`hornClearance` (derived, new function).** Arc length = fork
  acting length × horn freedom — the horn's end sits on the fork's
  own already-derived acting length from the pallet centre
  (`forkActingLength`, ESC-109), so this reuses the same "arc length =
  radius × angle" formula as `dropClearance`/`guardPointClearance`
  with no new radius.
- **Relational advisory.** "This freedom at the end of the horn is...
  from ¼° to ½° more than we allow for the guard point." Checked as a
  non-blocking advisory, only when guard-point freedom is also
  declared.
- **Teaching movement value, cross-referenced from a different worked
  example.** Playtner's own 15-tooth single-roller specification
  (used for most of this movement's other pallet values) doesn't give
  a horn-freedom number. A separate double-roller specification
  elsewhere in the same chapter does: "freedom for ruby pin and
  acting edge of fork is to be 1¼°... space between the end of horn
  and ruby pin is to be 1½°" — and its own dart/safety-roller freedom
  (1¼°) exactly matches this movement's own guard-point freedom, so
  1.5° is used directly: 1.25° + 0.25° (the low end of the cited
  range) = 1.5°, reproducing Playtner's own number exactly despite
  being drawn from a different worked example, the same kind of
  cross-chapter combination already used for 7.1.5.1's impulse
  radius.
- **UI and outputs.** A new optional input ("Horn freedom (°)") and a
  readonly "Horn clearance (derived)" row, next to the crescent row in
  the pallet geometry section; matching parameter/derived rows in the
  component report. Left out of the BOM's terse "Pallet fork" row
  (already just "shape not modeled"), matching the precedent already
  set for the ruby-pin/guard-point freedoms being left out of
  "Pallet stones".
- New tests cover `hornClearance`'s own arithmetic and ESC-113's full
  behavior (positivity, the lock-angle hard constraint, the relational
  advisory firing and not firing, and the no-guard-point-freedom
  no-advisory case). Verified live in a real browser, including the
  hard-lock error and the relational advisory appearing/disappearing.
  539 unit tests pass (532 before); `tsc -b --noEmit` and `eslint` are
  clean; production build succeeds; full e2e suite (31 tests) passes.

## Phase 7.1.5.4: single-roller crescent angular opening (ESC-112, ASM-0044)

Fourth of 7.1.5's six sub-items, from SRC-0036's "The Crescent"
chapter — a genuinely different kind of source material from every
earlier piece of this book used so far: a verbal compass-and-protractor
construction with named points, not a stated formula, and with no
worked numeric example anywhere to verify a reconstruction against.
Fig. 14 and Fig. 24 were fetched and viewed directly before writing
any code, per the roadmap's own flag that this geometry has multiple
interacting circles that are risky to get right from text alone.

- **Scoping decision, put to the user first.** Reconstructing the
  construction exactly requires a new declared field (the roller's own
  edge radius, which Playtner never gives a number for) and the actual
  placed pallet-arbor-to-balance-staff distance (which none of
  7.1.5.1-3 needed). Offered three options — full construction with a
  new field, a smaller double-roller-only slice, or deferring the
  whole sub-item — and the user chose the full construction.
- **`Balance.rollerRadius` (declared, optional mm, new field).**
  Distinct from `impulseRadius`: the roller's own edge, where the
  crescent is cut, not the ruby pin's own lever-arm length. Entered
  directly, same pattern as `impulseRadius`; left unknown (null)
  everywhere, including the teaching movement, because — unlike every
  other field added this phase — there is no Playtner worked number
  for it, and because the teaching movement's own placed pallet-to-
  balance distance (3.5mm) does not in fact admit its own fork acting
  length (4.5mm) and impulse radius (0.9mm) as a consistent triangle;
  entering a value there would only ever report the construction as
  not realizable.
- **Three new pure functions (`src/kinematics/palletGeometry.ts`).**
  `ringCrossingAngle`: where a ray from the pallet centre — leaning an
  angle off the pallet-to-balance line — first crosses a circle around
  the balance centre, found via the nearest-root ray/circle quadratic
  (same method as the existing `rayCircleInward`) then the law of
  cosines, avoiding the two-root ambiguity a law-of-sines-only approach
  would leave. A first implementation using only the law of sines
  picked the *far* crossing instead of the near one; caught by an
  independent geometric cross-check test before it shipped, not
  something a plain unit test against a single hand-computed number
  would have found. `rubyPinAngleAtBalance`: the ruby pin's own
  direction from the balance centre (Playtner's "A′A2"), via the law
  of cosines on the three already-known triangle sides (the actual
  placed centre distance, the fork acting length, the impulse radius).
  `crescentHalfAngle`: the difference between the two, composing them
  per Playtner's own construction ("will give us one-half the
  crescent, the remaining half being transferred to the opposite side
  of the line A′A2").
- **ESC-112 (error/warning/info, single roller only).** Roller radius,
  when entered, must be positive. With it, plus impulse radius,
  guard-point freedom and the *actual placed* pallet-to-balance
  distance (the same real distance ESC-103 already uses — reusing real
  geometry rather than inventing a second, redundant declared one),
  the crescent's angular opening is derived and reported. When those
  lengths don't form a consistent triangle, a warning names that
  plainly rather than a wrong number being shown — a direct instance
  of this project's own stated mission to detect mechanical
  inconsistencies, not a bug. Never checked for a double roller: its
  own "dart" crescent uses a different, additional empirical allowance
  ("we construct at 5° angle... to ensure sufficient freedom for the
  dart") that this does not reconstruct — unmodeled, along with the
  dart's own shape and "The Horn" chapter.
- **Verification.** New property-based tests cross-check
  `ringCrossingAngle` and `rubyPinAngleAtBalance` against independent
  coordinate-geometry constructions (200 random cases each, seeded),
  not just hand-picked numbers — this is what caught the near/far-root
  bug above. New ESC-112 tests cover roller-radius positivity, the
  teaching movement's own geometrically-inconsistent case (reported as
  a warning, not silently wrong), a separately-chosen self-consistent
  example that does derive a value, and the single/double roller gate.
  Verified live in a real browser: the roller-radius input, the
  "not geometrically realizable" warning on the teaching movement's own
  values, the derived crescent opening once a consistent impulse
  radius is entered, and the ESC-112 output disappearing entirely on
  switching to a double roller. 532 unit tests pass (524 before);
  `tsc -b --noEmit` and `eslint` are clean; production build succeeds;
  full e2e suite (31 tests) passes.

## Phase 7.1.5.3: roller kind, guard-point freedom/radius/clearance (ESC-111, ASM-0043)

Third of 7.1.5's six sub-items: single vs. double roller, and the
guard point's own freedom and clearance, from SRC-0036's "The Safety
Action" chapter (the chapter after "Fork and Roller Action").

- **`Balance.rollerKind` ("SINGLE" | "DOUBLE", required, new field).**
  Playtner draws a real trade-off: "in the single roller the safety
  action is at the mercy of the impulse and pallet angles... in order
  to favor the impulse we require a large roller, and for the safety
  action a small one, therefore escapements made on fine principles
  are supplied with two rollers, one for each action." SINGLE is the
  only configuration this codebase previously assumed; the field only
  changes a validation outcome (the fork-ratio advisory below) — no
  separate roller geometry (diameter, dart shape) is modeled for
  either kind.
- **Single-roller fork-ratio floor (ESC-111, advisory).** "A
  proportion between the fork and impulse angles in 10° pallets of 3
  or 3½ to 1, depending upon the size of the escapement, is the
  lowest which should be made in single roller. We have seen them in
  proportions of 2 to 1 in single roller — a scientific principle
  foolishly applied — resulting in an action entirely
  unsatisfactory." Playtner's own hedged number (3, not his cited
  "3½") is used as the non-blocking floor; only checked when
  `rollerKind === "SINGLE"`. The teaching movement's own 5:1 ratio is
  comfortably above it, so the advisory does not fire there.
- **`PalletGeometry.guardPointFreedom`/`guardPointRadius` (declared,
  optional ° and mm, new fields).** The same hard necessity as
  7.1.5.2's ruby-pin entry freedom, now applied to the guard point:
  "When the guard point is pressed against the roller the escape
  tooth must still rest on the locking face of the pallet; if the
  total lock is 2°, by allowing 1¼° freedom for the guard point
  between the bank and the roller the escapement will still be locked
  ¾°." ESC-111 enforces guard-point freedom strictly under the total
  lock (lock + run) as an error, plus simple positivity checks on both
  fields.
- **`guardPointClearance` (derived, new function).** Arc length =
  guard-point radius × guard-point freedom, the same formula as
  `dropClearance` applied to the guard point's own radius. Playtner's
  own worked numbers — "Suppose this [radius] to be 4 mm., then the
  freedom would equal 4 × 2 × 3.1416 ÷ 360 × 1.25 = .0873 mm." — are
  used verbatim as the teaching movement's guard-point freedom (1¼°)
  and radius (4 mm), reproducing his 0.0873 mm clearance exactly.
- **UI and outputs.** A new "Roller" select (Single/Double) next to
  the balance's impulse radius; two new optional inputs ("Guard-point
  freedom (°)", "Guard-point radius (mm)") next to the ruby-pin rows
  in the pallet geometry section, plus a readonly "Guard-point
  clearance (derived)" row; matching parameter/derived rows in the
  component report; the BOM's "Roller and impulse pin" row now names
  the roller kind (single/double) in its specification text, since —
  unlike the ruby-pin freedoms left out of the terser "Pallet stones"
  row in 7.1.5.2 — roller kind directly describes the part that row is
  already about.
- Schema bumped to v14: balances gain `rollerKind: "SINGLE"` (the only
  configuration previously assumed); pallet geometry, where given,
  gains empty (null) guard-point freedom and radius. Migration
  verified with a scratch test (old-schema document → migrated
  defaults), then removed.
- New tests cover `guardPointClearance`'s own worked numbers and
  ESC-111's full behavior (both positivity checks, the lock-angle hard
  constraint, the single-roller advisory firing and not firing, and
  double roller never triggering it even at the same low ratio).
  Verified live in a real browser: the roller selector, both new
  inputs, the derived clearance readout, the lock-angle error, the
  single-roller advisory appearing and disappearing when switched to
  double. 524 unit tests pass (516 before); `tsc -b --noEmit` and
  `eslint` are clean; production build succeeds; full e2e suite
  (31 tests) passes.

## Phase 7.1.5.2: ruby-pin entry freedom, slot shake, suggested width (ESC-110, ASM-0042)

Second of 7.1.5's six sub-items: the ruby pin's own interaction with
the fork's slot, continuing SRC-0036's "Fork and Roller Action"
chapter where 7.1.5.1 left off.

- **`PalletGeometry.rubyPinEntryFreedom` (declared, optional °).**
  Playtner: "the ruby pin in entering the fork must have a certain
  amount of freedom for action, from 1 to 1¼°." A genuine hard
  necessity, not just a cited convention: "it is important that the
  angular freedom between the fork and ruby pin at the moment it
  enters into the slot be less than the total locking angle on the
  pallets" — so a premature strike leaves the pallets still locked
  rather than fully unlocking them. ESC-110 enforces this as an error
  (entry freedom ≥ lock + run), on top of a simple positivity check,
  with a separate non-blocking advisory for the cited 1°-1¼° figure.
- **`PalletGeometry.rubyPinSlotShake` (declared, optional °).**
  "The shake of the ruby pin in the slot of the fork must be as
  slight as possible... it varies from ¼° to ½°." Simple
  positive-when-declared check plus an advisory for the cited range.
- **`suggestedRubyPinWidth` (derived, new function).** "We would
  choose a ruby pin of a width equal to half the angular motion of the
  fork" — a cited convention, not a strict formula (same genre as
  `toothDrawAngle`'s doubling), so it has no corresponding hard
  constraint; ESC-110 reports it as info only, whenever the lever
  angle is valid (independent of whether freedom/shake are entered).
- **Teaching movement values, both matching Playtner's own cited
  numbers exactly**, not invented: entry freedom 1¼° is the precise
  figure from his own total-lock worked example (1½° lock + ½° run =
  2° total, 1¼° freedom leaves ¾° locked margin — the teaching
  movement's own 2° lock + 0.5° run = 2.5° total leaves even more
  margin); slot shake 0.25° is the low end of his cited ¼°-½° range.
- **UI and outputs.** Two new optional inputs ("Ruby-pin entry freedom
  (°)", "Ruby-pin slot shake (°)") next to "Fork ratio" in the pallet
  geometry section, plus a readonly "Suggested ruby-pin width" row;
  matching parameter/derived rows in the component report. The BOM's
  terse "Pallet stones" summary row is deliberately left unchanged —
  it already omits drop/width (added in 7.1.1) for brevity, so leaving
  out these two new fields too matches that existing precedent rather
  than inventing a new one.
- New tests cover `suggestedRubyPinWidth`'s own worked numbers and
  ESC-110's full behavior (positivity, the lock-angle hard constraint,
  both advisories, and the no-entry case). Verified live in a real
  browser, including the entry-freedom-vs-total-lock error and the
  separate advisory for an in-bounds-but-atypical value. 516 unit
  tests pass (508 before); `tsc -b --noEmit` and `eslint` are clean;
  production build succeeds; full e2e suite run.

## Phase 7.1.5.1: impulse radius and the derived fork acting length (ESC-109, ASM-0041)

First of 7.1.5's six sub-items (scoped last pass): gives the existing
`forkRatio` — previously an abstract dimensionless number with no
physical length attached — real geometric content, the first piece of
SRC-0036's separate "Fork and Roller Action" chapter used in this
project.

- **`Balance.impulseRadius` (declared, optional mm).** Playtner: "the
  ruby pin, or strictly speaking, the 'impulse radius,' is a lever arm,
  whose length is measured from the center of the balance staff to the
  face of the ruby pin." Entered directly, same pattern as
  `inertia`/`hairspringStiffness`: no roller or ruby-pin geometry is
  used to derive it.
- **`forkActingLength` (derived, new function in `palletGeometry.ts`).**
  Playtner's own stated law: "the angles are in the inverse ratio to
  the radii" — impulse angle × impulse radius ≈ lever angle × fork
  acting length, so `forkActingLength = impulseRadius × forkRatio`.
  Turns the fork's real acting length (pallet centre to ruby-pin
  contact) from nothing into a genuine derived quantity.
- **ESC-109 (new rule).** Impulse radius, when entered, must be
  positive (error otherwise); the derived fork acting length is then
  reported as info.
- **Teaching movement value, fully sourced, not invented.** Its own
  lift/lever angles (50°/10°) already matched Playtner's own cited
  "5 to 1" proportion exactly. Chose `impulseRadius = 0.9 mm` so the
  derived fork acting length lands on Playtner's own worked example —
  "the acting length of fork = 4.5 mm" (used in his ruby-pin-shake
  calculation) — since 4.5 mm ÷ 5 = 0.9 mm.
- **Deliberately not touched: the viewport's visual fork-bar length.**
  The 3D viewport still draws the fork bar using the actual placed
  pallet-to-balance distance (`toBalance * 0.85`, a cosmetic
  placeholder), not the newly-derived `forkActingLength`. These are
  different quantities — the declared/derived theoretical ruby-pin
  contact radius versus the real placed geometry — and mixing them
  could visually break the drawing (the bar not reaching the balance)
  if a user's declared impulse radius doesn't closely match their
  actual placement. That reconciliation, along with the real ruby-pin/
  roller/crescent/horn shapes, is deferred to 7.1.5.6, the visual
  capstone for this sub-area (same role 7.1.4 played for pallets/teeth).
- **UI and outputs.** An "Impulse radius (mm)" optional input next to
  "Lift angle" in the Balance section; a readonly "Fork acting length
  (derived)" row; matching parameter/derived rows in the component
  report; the BOM's "Roller and impulse pin" row (previously a bare
  "not modeled" placeholder) now reports the entered impulse radius and
  derived fork acting length.
- **A real formatting bug caught by live-browser verification**, not
  just unit tests: the first version of the new readonly row used
  `fields.ts`'s `mmText` (a bare digit string meant for editable input
  values, e.g. "4.5") instead of `formatMm` (the readonly-display
  formatter used everywhere else for a derived length, e.g.
  "4.5000 mm") — caught by screenshotting the rendered inspector panel
  and noticing the row read "4.5" with no unit, not by the unit tests
  (which check the validation message text, not the UI's own
  formatting choice). Fixed before commit.
- New tests cover `forkActingLength` against Playtner's own 5:1/4.5mm
  worked numbers, ESC-109's positive-or-error and derive-or-nothing
  behavior, and the BOM/component-report rows. Verified live in a real
  browser. 508 unit tests pass (504 before); `tsc -b --noEmit` and
  `eslint` are clean; production build succeeds; full e2e suite run.

## Phase 7.1.4: real 2D outlines for escape teeth and pallet stones (ASM-0040)

The capstone of the six 7.1 sub-items: replacing the escape wheel's and
pallet fork's purely cosmetic placeholder shapes with real 2D outlines
built from the model's own angles (toothWidthAngle, toothDrawAngle,
draw — ASM-0037/0038/0039), flagged in the roadmap as the highest-risk
piece ("by far the largest single piece... budget for a construction
that may not close cleanly").

- **Scoped down from Playtner's full drafting procedure, deliberately.**
  Fetched and viewed two of SRC-0036's own figures (Fig. 5 "Diagram
  illustrating Draw", Fig. 28 "The pallets when unlocked" — redirected
  through www.gutenberg.org, `curl -L`, same "fetch the image and read
  it directly" workaround already used for SRC-0037's formula images)
  to ground the general shape before building anything. The book's full
  construction needs information this project doesn't have a source
  for or has already explicitly deferred: true lifting-face curvature,
  the actual tooth/pallet FACE contact geometry, the real/primitive-
  circle correction, the engaging/disengaging asymmetry and the locked-
  vs-unlocked position correction (ASM-0039 already named these out of
  scope). What shipped is a straight-edged approximation using the
  model's own real angles, not a reproduction of the source's diagrams
  point-for-point.
- **Escape tooth (`generateEscapeWheelOutline`, with a tooth face):** a
  quadrilateral — a flat top of `toothWidthAngle` at the tip circle, a
  plain radial trailing edge to the root, and a locking edge leaning
  `toothDrawAngle` off the radial at the locking corner. The lean is
  found exactly via a new `rayCircleInward` helper (ray–circle
  intersection), not an arbitrary visual angle. A near-zero (ratchet)
  tooth width clamps to a small non-degenerate sliver so it still
  renders. Falls back to the earlier cosmetic leaning-trapezoid shape
  when there's no pallet geometry to derive from (same 3-point-per-
  tooth test still passes unchanged).
- **A real math bug caught before it shipped.** The first version of
  `rayCircleInward` picked the far root of the quadratic instead of the
  near one — for Playtner's own 12°→24° draw numbers this sent the
  tooth's root corner nearly 130° around the wheel instead of the
  expected ~10°, caught by actually computing and inspecting the
  numbers (a scratch script) before writing any TypeScript. Fixed by
  picking the nearer intersection (`t = -b - √disc`, not `+`).
  Re-verified the corrected version against a hand-worked example and a
  sweep of lean angles before moving on — exactly the kind of thing
  this is scoped to watch for; shipping the wrong root would have
  looked like a plausible but wrong tooth shape.
- **Pallet stone (`generatePalletStoneOutline`, new):** a quadrilateral
  whose near edge is the locking face through the locking point, in the
  model's own declared/derived draw direction, swept back a fixed
  visual depth. The two locking points get mirrored lean signs (one
  toward the pallet axis, one away) — matching Playtner's structural
  description that the engaging and disengaging pallets incline in
  opposite senses, without tracking which physical pallet is which.
  Falls back to a plain square when there's no face to derive (no
  pallet geometry, or draw not positive).
- **Verified geometrically, not just visually.** New tests check every
  tooth and both the zero-draw/no-pallet-geometry fallback and the
  derived-face cases produce a closed, non-self-intersecting polygon
  with the expected point count and correct radius bounds (shoelace
  area + segment-intersection checks, for all 15 teeth against
  Playtner's own worked numbers), plus `rayCircleInward`'s own
  behaviour (zero lean reaches the target radius directly; a lean too
  steep to reach the target circle returns null, not NaN).
- **Verified live in a real browser, twice over.** First, a rendered
  screenshot of the actual app's 3D viewport (pan/zoom via mouse
  events) showing a plausible claw-shaped escape wheel. Second — more
  reliably — an SVG dump calling the real exported functions directly
  with the teaching movement's own numbers, rendered and screenshotted:
  all 15 teeth form a clean ring of hook-shaped teeth with no overlap,
  and both pallet stones sit correctly nested in the valley at their
  locking points, visibly mirrored. Also exercised live edits (draw,
  pallet width, tooth kind, clearing pallet geometry entirely) to
  confirm the viewport rebuilds without errors on every path.
- Fixed a latent bug surfaced along the way: the section/cutaway cap
  footprint for pallet stones still used a plain `squareFootprint` even
  where the rendered stone was already a real wedge; now built from the
  same `generatePalletStoneOutline` the mesh itself uses, keeping the
  cap and the solid consistent.
- Registered ASM-0040, extended SRC-0036's `claims_supported` and notes,
  added a Equations-table row each for the two outline functions
  (`TRACEABILITY.md`, APPROXIMATION/L0, matching the existing precedent
  for `generateGearOutline`). 504 unit tests pass (496 before); `tsc -b
  --noEmit` and `eslint` are clean; production build succeeds; full e2e
  suite run.

## Phase 7.1.3: draw-derived escape-tooth locking face (ESC-108, ASM-0039)

Third of the six 7.1 sub-items: giving `drawAngle` its actual geometric
meaning instead of a bare validated positivity check, and deriving the
escape tooth's own locking face from it — the piece of Playtner
(SRC-0036, "The Draw") sitting right next to drop, pallet width and
tooth type (ASM-0036/0037/0038).

- **`drawAngle` now documents its real geometric referent.** Playtner:
  "The locking planes when locked are inclined 12° from EB, and FB" —
  EB/FB being radii from the escape wheel's own axis through the
  locking points. `PalletGeometry.drawAngle`'s JSDoc and the inspector
  tooltip now say this explicitly, rather than only "pulls the lever
  onto its banking". No value or type changed — same field, accurate
  framing.
- **The escape tooth's own locking face is derived, not declared.**
  `toothDrawAngle` = 2 × the pallet's draw — Playtner's own reasoning:
  "it is certainly necessary that the point of the tooth alone should
  touch the pallet. From this it follows that the angle on the teeth
  must be greater than on the pallets... for practical reasons, from a
  manufacturing standpoint, the angle on the tooth is made just twice
  the amount". Explicitly NOT a strict formula — "we could make it a
  little less or a little more" — so this is a conventional derivation
  with a cited practical working range (20°-28°): below it, "too great
  a surface would be in contact with the jewel"; above it, "the point
  or locking edge of the tooth would rapidly become worn".
- **ESC-108 (new rule)**: when draw is positive, reports the derived
  tooth-locking-face angle as info; an advisory (not an error — this is
  a cited practical figure, not a hard constraint) when it falls
  outside 20°-28°.
- **Deliberately not in scope**, and said so in ASM-0039: Playtner's
  own further detail that the engaging and disengaging pallets incline
  in physically opposite senses (one toward the pallet center, one
  away), and that draw should properly be measured with the fork
  against its banking rather than at the locking corner — both genuine
  mechanical subtleties this simplified model doesn't carry. Also not
  in scope: the actual 2D face/outline construction (that's 7.1.4, the
  capstone).
- **UI and outputs.** A readonly "Escape-tooth locking face (derived)"
  row next to "Draw (°)" in the pallet geometry section; a matching
  derived row in the component report.
- **Verified live in a real browser**: the teaching movement's 12° draw
  shows a derived 24° tooth face; setting draw to 8° shows 16° and
  fires the ESC-108 advisory ("outside the practical range"); setting
  it back to 12° clears the advisory.
- New tests: `toothDrawAngle` against Playtner's own 12°→24° worked
  value (`palletGeometry.test.ts`); ESC-108's info/advisory behavior,
  including that nothing is derived without a positive draw
  (`mainspringEnergy.test.ts`). Two existing exact-issue-list tests
  updated for the new ESC-108 info row. Registered ASM-0039, extended
  SRC-0036's `claims_supported` and notes, updated `RULE_IDS.md`/
  `ruleIds.ts`/`TRACEABILITY.md`. 496 unit tests pass (492 before);
  `tsc -b --noEmit` and `eslint` are clean; production build succeeds;
  full e2e suite run.

## Phase 7.1.2: tooth type, club/ratchet (ESC-106/107 extended, ASM-0038)

Second of the six 7.1 sub-items: which escape-tooth form (club or
ratchet), the piece of Playtner (SRC-0036) immediately next to drop and
pallet width (ASM-0036/0037) already implemented.

- **`EscapeWheel.toothKind` (CLUB | RATCHET), a required field.** CLUB
  (Playtner's own worked 15-tooth specification, "the wheel teeth of the
  'club' form") has its own impulse face sharing the lift with the
  pallet, so the derived tooth width must stay strictly positive,
  unchanged from the existing ESC-106 rule. RATCHET (the older English
  form, "a metal point passing over a jeweled plane", "the entire
  lifting angle is on the pallets") puts the whole lift on the pallet,
  so the tooth is a bare point and the derived tooth width may be
  exactly zero — ESC-106 relaxes `> 0` to `>= 0` only for this case.
  Both options are fully enabled in the UI (unlike CIRCULAR, which
  stays a disabled stub): the ratchet case has real, implemented
  validation consequences, not just a named gap.
- **Drop advisory becomes type-specific.** ESC-107's informal drop
  figure now cites the type's own value — Playtner: "Authorities on
  the subject allow 1½° drop for the club and 2° for the ratchet
  tooth" — instead of a generic club-only wording. The underlying 1–2°
  advisory band is unchanged (no separate per-type band is sourced).
- **A genuine floating-point edge found and fixed.** A ratchet
  configuration whose tooth width is mathematically exactly zero (e.g.
  10.5° pallet + 1.5° drop against a 12° budget) can round to a tiny
  negative double through the degree→radian arithmetic, which would
  wrongly fail the new `>= 0` check. Added
  `NUMERICAL_PARAMETERS.angleZeroToleranceRadians` (1e-9 rad), the same
  kind of absolute floating-point tolerance already used for centre
  distances, and used it in all three places that now derive
  tooth-width validity: `escapementRules.ts` (ESC-106/107),
  `energySection.ts` (the live inspector's own readonly rows — this one
  had the stale, non-toothKind-aware `tooth > 0` check too, not just
  the component report) and `componentReport.ts`.
- **UI and outputs.** A "Tooth kind" selector next to "Escape teeth" in
  the Escape wheel section; an "Escape tooth kind" parameter row in the
  component report; messages throughout name which kind is in play.
  Teaching movement kept at CLUB (Playtner's own worked specification).
- **Persistence.** Schema 10 → 11: every escape wheel gains
  `toothKind: "CLUB"` (the only form previously assumed, and what every
  existing design already implicitly was).
- **Verified live in a real browser**: the tooth-kind selector defaults
  to Club with the teaching movement's 4.50° derived tooth width;
  setting pallet width to 10.5° (exactly exhausting the 12° budget with
  the existing 1.5° drop) correctly fires ESC-106 for Club; switching
  to Ratchet at the same values clears the error and shows a derived
  0.00° tooth width; switching back to Club re-fires it.
- New tests in `mainspringEnergy.test.ts` (ratchet allows zero tooth
  width where club doesn't; ratchet still rejects a genuinely negative
  tooth width; the type-specific drop-advisory wording). Registered
  ASM-0038 in `ASSUMPTION_REGISTER.md`/`assumptions.ts`, extended
  SRC-0036's `claims_supported` and notes in `SOURCES.yml`/
  `SOURCE_INDEX.md`, and updated `RULE_IDS.md`/`TRACEABILITY.md` for
  the now type-aware ESC-106/107. 492 unit tests pass (489 before);
  `tsc -b --noEmit` and `eslint` are clean; production build succeeds;
  full e2e suite run.

## Phase 7.1.1: pallet type and width (ESC-106/107 extended, ASM-0037)

Started the first of the six 7.1 sub-items scoped last pass: pallet type
(equidistant/circular) and a declared pallet width.

- **The existing model was already equidistant.** Re-reading Playtner
  (SRC-0036, already read in full for drop) showed the project's current
  tangential-locking construction (`tangentialCentreDistance`/
  `lockingPoints`) *is* the equidistant pallet — Playtner's own words:
  "the equidistant pallet... also called the tangential escapement, on
  account of the unlocking taking place on the intersection of
  tangent[s]". So this pass didn't need to rebuild the locking-point
  math, just make the choice explicit and add what was genuinely
  missing: a declared pallet width.
- **Circular pallets stay an honest stub.** The circular construction
  (equal lifting lever arms, two locking circles) locks off the tangent
  by an amount Playtner states only grows/shrinks with pallet width — no
  closed-form offset is given. Added `PalletGeometry.kind` (EQUIDISTANT |
  CIRCULAR) with CIRCULAR visible but disabled in the UI (same pattern as
  `MANUFACTURING_VALIDATED_PROFILE`), rather than guessing a formula not
  actually in the source.
- **The tooth/pallet/drop partition is now complete.** Drop (ASM-0036)
  already established the per-beat wheel-angle budget
  (`wheelAngleBudgetPerBeat`, π/escapeTeeth). Adding declared pallet
  width (`widthAngle`, ASM-0037) lets the escape tooth's own width be
  *derived*, not guessed, as the remainder (`toothWidthAngle` = budget −
  width − drop) — directly Playtner's own 15-tooth worked numbers (12° =
  4½° tooth + 6° pallet + 1½° drop), now fully reproduced rather than
  only partially.
- **Validation (ESC-106 extended, not a new rule).** Pallet width must
  be positive; together with drop it must leave a positive tooth width
  within the budget — a derived geometric necessity, same tier as drop's
  own check. ESC-107 now also reports the derived tooth width as info.
- **UI and outputs.** A "Pallet type" selector (circular disabled, with
  an explanatory tooltip) and a "Pallet width" input in the pallet
  geometry section; a derived "Escape-tooth width" readonly row;
  matching parameter/derived rows in the component report. Teaching
  movement set to Playtner's own 15-tooth values (equidistant, 6° pallet
  width) — grounded, not guessed, same tooth count as the book's example.
- **Persistence.** Schema 9 → 10: pallet geometry, where already given,
  gains `kind: "EQUIDISTANT"` (the only implemented, and already-correct,
  behavior) and an empty width to fill in.
- **Verified live in a real browser**, not just asserted: the pallet
  type selector, declared width (6°), and derived tooth width (4.50°)
  all render correctly; setting width to 11° (over budget with the
  existing 1.5° drop) correctly fires ESC-106 without flagging the width
  field itself invalid (it's still positive on its own — the *combined*
  constraint is what fails); setting it to 0° correctly fires the
  separate positivity check and does flag the field.
- New tests in `palletGeometry.test.ts` (checked against Playtner's own
  numbers) and `mainspringEnergy.test.ts` (ESC-106 pallet-width and
  tooth-width-budget cases). Two existing exact-issue-list tests updated
  for the new, correct ESC-107 info row. 489 unit tests pass (486
  before); `tsc -b --noEmit` and `eslint` are clean; production build
  succeeds; full e2e suite run.

## Scoped the rest of Phase 7.1 (real tooth/pallet face geometry)

Broke the large remaining piece of 7.1 — real tooth/pallet face geometry,
left open when drop shipped — into six ordered sub-items in
`docs/ROADMAP.md` (7.1.1-7.1.6). No code changed; a planning pass, same
category as the original top-level Phase 7 scoping.

Unlike every other Phase 7 item so far, sourcing isn't the open question
here: Playtner's 1908 book (SRC-0036, already read in full for the drop
work) covers all of it — equidistant vs. circular pallets, club vs.
ratchet teeth, draw as a real face angle, the full pallet-stone/tooth
outline construction, and a separate four-chapter treatment of the
fork-and-roller coupling (ruby pin, safety roller, guard pin, crescent,
horn) that this codebase doesn't model at all yet (`forkRatio` is the
only trace of balance interaction today). The open risk is construction
correctness, not source availability — flagged explicitly against the
one precedent where that risk materialized (the trochoidal fillet,
SRC-0025/ASM-0031, not shipped when its own geometric verification
didn't close).

Suggested build order: 7.1.1 (pallet type + width) → 7.1.2 (tooth type +
width split) → 7.1.3 (real draw-angled faces) → 7.1.4 (full 2D outline,
the capstone — replaces the placeholder shapes in
`src/geometry/assemblyGeometry3d.ts`), each independently shippable, same
incremental pattern as the WATCH_SPECIFIC_PROFILE gear work (three
separate passes). 7.1.5 (fork/roller) and 7.1.6 (center-distance
manufacturing clearance) are smaller and can run separately.

## Phase 7.5: searched for a real mainspring torque curve; a genuine negative result

Researched REF-ENG §11's "torque curve" and "bridle/slipping behaviour"
for the mainspring (ASM-0026 currently uses a straight line between two
entered torque values). No code changed this pass — a research-only
conclusion, same category as the escapement-efficiency half of Phase 7.4.

- **Torque curve.** Found three independent sources landing on the same
  negative result. Roymech's spiral-spring reference (SRC-0037, read
  directly — its formulas are images with no alt text, so fetched and
  read as images, a new variant of the "WebFetch can't extract this"
  workaround) gives the standard engineering treatment of a spiral/clock
  spring: an *ideal linear* torsion relation, M = kθ — no narrower, in
  fact, than this project's own two-point-line model, so not an
  improvement path at all. A patent's background section (SRC-0039, read
  directly) confirms real mainsprings have a non-constant torque curve
  but gives no formula or shape, just states the problem. A third claim
  (an "ideal peak estimate, not a full real-world curve" formula, SRC-0038)
  could not be verified directly — both of its source sites
  (hourstriker.com, watchtime.com) returned HTTP 403 to WebFetch and to a
  direct `curl` alike, a real access block; recorded as an unread
  search-engine snippet only, per the SRC-0023 precedent, not used for
  anything. Conclusion: the real nonlinearity comes from coil friction
  and barrel/arbor contact, which no accessible source formulizes — it
  has to be measured, not computed, the same conclusion already reached
  for circular error (ASM-0034, Phase 7.3).
- **Bridle/slipping behaviour.** A cited ~1.3–1.5× slip-to-working-torque
  ratio exists (via the same unread SRC-0038 snippets) but is scoped, by
  other unread search results, to automatic-winding barrels specifically
  — a mechanism this project's domain model doesn't have at all (no
  rotor/automatic-winding concept exists). Implementing it now would have
  nothing to attach to; left open.
- Registered SRC-0037/0038/0039; updated ASM-0026's own notes in
  `ASSUMPTION_REGISTER.md` and `src/reference/assumptions.ts` to record
  the conclusion, so a future pass doesn't re-tread this same search.
  `registers.test.ts`, the full unit suite (486), `tsc -b --noEmit` and
  `eslint` all still pass — docs-only change, no build/e2e needed.

## Phase 7.1: real pallet geometry, starting with drop (ESC-106/107, ASM-0036)

Started the moderate-risk geometry item from the Phase 7 scoping: real
pallet/escape-wheel contact geometry (ASM-0023's own list names "drop,
impact, sliding and banking geometry" as entirely unmodeled).

- **Research first, same discipline as the other Phase 7 passes.** Found
  H. R. Playtner's "An Analysis of the Lever Escapement" (1908) — a
  full, recognized, book-length watchmaking text devoted specifically to
  lever-escapement geometry, freely available via Project Gutenberg
  (Tier 4, stronger sourcing than most of this project's recent
  horological finds). WebFetch's own isolated summarizer compressed the
  chapters too aggressively to extract the worked formulas faithfully
  (a similar lossy-extraction problem to scanned PDFs, but for a
  different reason — HTML isn't saved locally by WebFetch the way a
  binary PDF is), so fetched the raw HTML with curl and read it with the
  Read tool instead — a new, reusable workaround for this kind of case.
- **What the book actually gives.** With two beats per tooth (ASM-0021,
  already in this codebase), each beat's wheel-angle budget — tooth
  width + pallet width + drop, all measured at the escape wheel's own
  axis, not the lever's — is exactly half the tooth pitch. Worked 15-tooth
  example: 12° = 4½° (tooth) + 6° (pallet) + 1½° (drop). This gives a
  genuine, derivable geometric necessity (drop must be positive and
  strictly less than that budget) independent of any cited "typical"
  range — not just an empirical rule of thumb like the BRG-006/007/
  SPR-004 advisories. The book separately cites 1–2° as the typical
  club-tooth range, used as a non-blocking advisory on top of that hard
  constraint. It also corroborates this project's existing teaching-
  movement lock (2°) and draw (12°) angles as the right order of magnitude.
- **Scope, stated plainly.** Only drop is added this pass. The book's
  much larger treatment of equidistant-vs-circular pallet types,
  club-vs-ratchet tooth types, and convex/concave lifting-plane shapes —
  real tooth and pallet FACE geometry — remains unmodeled, left for a
  future Phase 7.1 pass rather than attempted incompletely now.
- **Model (ASM-0036).** `PalletGeometry` gains `dropAngle: Angle`
  (wheel-side, required — unlike Q/efficiency this isn't a loss property
  with no default state, so it follows the same NaN-until-filled
  convention as lock/draw/run). New pure functions in
  `src/kinematics/palletGeometry.ts`: `wheelAngleBudgetPerBeat`
  (π/escapeTeeth) and `dropClearance` (arc length = tip radius × drop
  angle) — both checked against Playtner's own worked numbers in tests,
  not just the formulas in the abstract.
- **Validation.** ESC-106 (error): drop must be positive and under the
  budget — a derived necessity, not a cited convention. ESC-107 (info):
  drop outside 1–2° is a non-blocking advisory, and the resulting linear
  clearance at the tip circle is always reported once drop is valid.
  ESC-002's "not modeled" message now says so conditionally — drop is
  modeled when declared.
- **UI and outputs.** A new "Drop (°, wheel-side)" input in the pallet
  geometry section, plus readonly rows for the wheel-angle budget and
  the resulting clearance; parameter/derived rows in the component
  report. The teaching movement's drop is set to 1.5°, Playtner's own
  15-tooth worked value (its escape wheel also has 15 teeth) — grounded,
  not guessed, consistent with how its other illustrative values work
  (ASM-0009).
- **Persistence.** Schema 8 → 9: pallet geometry, where already given,
  gains an empty (NaN) drop angle to fill in. (Also backfilled the
  missing schema-7→8 row in `TRACEABILITY.md`'s migration table, a gap
  from the isochronism-coefficient pass.)
- **Verified in a real browser, not just asserted.** Loaded the teaching
  movement, confirmed the Drop field shows 1.5°, the wheel-angle budget
  reads 12.00°, and the clearance reads 0.0602 mm (2.3 mm tip radius ×
  1.5° in radians) — then set drop to 15° and confirmed ESC-106 fires in
  the validation panel, the field turns red, and the header's declared-
  level banner flips to "NOT SATISFIED". Screenshotted both states.
- New tests in `palletGeometry.test.ts` (both new functions, checked
  against Playtner's own worked numbers) and `mainspringEnergy.test.ts`
  (ESC-106/107 cases through `createTeachingMovement()`). Two existing
  exact-issue-list tests (`escapementRules.test.ts`,
  `movementKinematics.test.ts`) updated for the new, correct ESC-107 info
  row the teaching movement now legitimately produces. 486 unit tests
  pass (480 before); `tsc -b --noEmit` and `eslint` are clean; production
  build succeeds; full e2e suite run.

## Phase 7.4: sourced ranges for balance Q (SPR-004); escapement efficiency stays open

Continued the energy-model research named in this file's own "Next"
section: look for real values for the balance quality factor Q and
escapement efficiency (ASM-0026), both currently user-entered unknowns
with no cited typical range.

- **Q: found a usable, if secondhand, source.** Two independent
  professional watch writers (Jack Forster; watchprosite.com) credit
  Douglas Bateman with a 1970s finding that Q — not escapement type —
  is the dominant predictor of a timekeeper's accuracy, and both
  independently cite "~300" for a good mechanical wristwatch balance,
  consistent with a third source's broader "~100 to 300" range across
  grades. Bateman's own paper wasn't located or read (Tier 6, same
  confidence as SRC-0011/SRC-0012). Added SPR-004 (`springRules.ts`,
  ASM-0035): an info-only advisory when an entered Q falls outside
  ~100–300, never a pass/fail limit and never used to default or infer
  any movement's own Q — the teaching movement's Q stays null, exactly
  as `teachingMovement.ts` already deliberately left it.
- **Escapement efficiency: a real partial finding, not yet usable.**
  Found a 2024 watchesbysjx.com article deriving Swiss lever escapement
  *geometric* efficiency (91% at 15 teeth, 88% at 20 teeth) from
  impulse-angle data in two recognized horological references (Defossez's
  "Théorie générale de l'horlogerie", corroborated by Daniels'
  "Watchmaking"; Vermot & Dordor's "Mécanique & Construction"). This is a
  genuine upper bound on this project's `escapementEfficiency` (defined
  as the full fraction of energy reaching the balance, friction and
  dynamic losses included) — not a value for it, since geometric
  efficiency explicitly excludes those other loss categories. Not
  implemented: only two tooth-count data points were obtained, not the
  underlying general formula, so no accurate bound for an arbitrary
  tooth count can be computed without risking a wrong
  interpolation/extrapolation. Recorded (SRC-0035) rather than dropped,
  per the project's rule to preserve partial evidence.
- Registered SRC-0034/SRC-0035, ASM-0035, SPR-004 in SOURCES.yml,
  SOURCE_INDEX.md, ASSUMPTION_REGISTER.md, RULE_IDS.md and their
  `src/reference/` mirrors. New tests in `mainspringEnergy.test.ts`
  (SPR-004 fires outside the range, not inside, not when Q is unknown).
  480 unit tests pass (477 before); `tsc --noEmit` and `eslint` are
  clean; production build succeeds; e2e suite run (no UI changed — the
  advisory renders through the existing generic validation panel).

## Phase 7.3: amplitude-dependent balance rate (isochronism coefficient, ASM-0034)

Started the lowest-risk item from the Phase 7 scoping pass: replacing
ASM-0024's "isochronous by construction" balance with an optional
correction for amplitude dependence ("circular error", REF-ENG §10).

- **Research first.** Searched for a citable rate-vs-amplitude formula.
  Found Horace Bowman's 1950 NIST/NBS paper (SRC-0032, Tier 1/2, a lab
  instrument for plotting isochronism curves) — genuine evidence the
  phenomenon is real, and a secondhand citation of Phillips' 1861
  geometric conditions for a zero-error hairspring terminal curve
  (SRC-0033, cited via SRC-0032, not read directly). Neither gives a
  usable closed-form rate-vs-amplitude equation — Phillips' result is
  conditions for an *ideal* overcoil, not a quantified residual for a
  real spring, and Bowman's own figures are measured curves, not a
  formula. So the honest scope is a **declared/measured coefficient**,
  the same pattern already used for Q and escapement efficiency
  (ASM-0026), not an invented universal constant.
- **Model (ASM-0034).** `Balance` gains `isochronismCoefficient: number
  | null` (s/day per radian, null = unmodeled). `isochronismAdjustedRate`
  (`src/kinematics/balance.ts`) applies a first-order local linearization
  around the balance's own declared `amplitude`: dailyRate(A) = dailyRate₀
  + c·(A − A_ref). Deliberately linear, not a Duffing-style A² term:
  no source here establishes that specific functional form for this
  system, so the model doesn't claim more than "a declared local
  sensitivity," valid near the reference amplitude.
- **Where the varying amplitude comes from.** The existing energy chain
  (ASM-0026) already predicts amplitude at full wind and at let-down
  (`amplitudeFull`/`amplitudeLetDown`). Combining that with the new
  coefficient gives a wind-dependent rate prediction — the same
  phenomenon Bowman's isochronism curves measure (rate vs. hours from
  winding) — without the two models (balance dynamics, energy chain)
  becoming coupled: the combination happens at each call site that
  already has both (validation, report, UI), not inside either summary.
- **Validation.** BAL-001 rejects a non-finite coefficient (any sign or
  magnitude is otherwise valid — it's a rate of change, not a size).
  BAL-002's message now reports the isochronism-adjusted rate range when
  both a coefficient and a predicted amplitude exist, names what's
  missing when only the coefficient is declared, and says plainly when
  amplitude dependence isn't declared at all.
- **UI and outputs.** A new optional input (s/day per °, converted to
  the internal s/day-per-radian at the UI boundary) in the balance
  inspector; a "Predicted rate (full → let down)" row in the energy
  section once both the coefficient and amplitude exist; a parameter and
  a derived row in the component report; wording updated everywhere that
  previously said amplitude effects are simply "not modeled."
- **Persistence.** Schema 7 → 8: balances gain the new field, defaulted
  to null (unmodeled) for older files.
- New tests: `balance.test.ts` (isochronism-adjusted-rate unit tests,
  plus BAL-001/BAL-002 cases through `createTeachingMovement()`). 477
  unit tests pass (473 before); `tsc --noEmit` and `eslint` are clean;
  production build succeeds; full Playwright e2e suite run.

## Scoped Phase 7 (advanced escapement and balance simulation)

`docs/ROADMAP.md`'s Phase 7 was a single unscoped line ("Only after the
earlier layers are robust."). Broke it into six ordered items (7.1–7.6),
each naming the REF-ENG §9/§10/§11 physical-model target it works toward,
which current ASM-00xx simplification it would tighten or replace, and a
realistic sourcing-risk assessment — per CLAUDE.md, a validation level
can't be raised without evidence, so an item with no available source is
scoped to stay a documented assumption rather than planned as if solved:

- **7.1 Pallet/escape-wheel contact geometry** (lift, lock, draw, drop
  faces) — replaces ASM-0025's tangential-locking-point abstraction with
  real tooth/pallet-stone shapes. Standard lever-escapement geometry is
  documented in recognized watchmaking texts; moderate sourcing risk.
- **7.2 Impact and sliding-contact dynamics** at unlock/impulse — REF-ENG
  §9 names this explicitly ("a simple rigid gear mesh is not an adequate
  physical model"); SRC-0004/0005/0006 (peer-reviewed escapement
  tribology/FEM papers, already registered but unused by any
  implementation) are the candidate sources. Builds on 7.1; likely lands
  at L3 idealized momentum/energy bookkeeping before true contact
  mechanics, if ever.
- **7.3 Amplitude-dependent rate (circular error)** — replaces ASM-0024's
  "isochronous by construction" oscillator. Classical, well-documented
  physics (Airy; the Grossmann/Phillips terminal-curve literature
  SRC-0020 already touches); lowest sourcing risk of the set and the
  recommended starting point.
- **7.4 Sourced Q and escapement efficiency** — already flagged in this
  file's "Next" section. A research task, same discipline as the
  BRG-006/BRG-007/NIHS work below, not a geometry build.
- **7.5 Nonlinear mainspring torque curve and bridle slip** — REF-ENG §11
  calls for both; neither is modeled (ASM-0026 is a straight line between
  two entered points). Movement-specific curves are usually proprietary;
  research-risk, may stay a documented assumption.
- **7.6 Positional and temperature effects** — REF-ENG §10's "Physical
  model" also names these. Depends on 7.3 (no rate exists yet to
  perturb). Highest research risk; typically measured per movement, not
  looked up generically.

Ordering: 7.1 before 7.2; 7.3 is independent and the suggested first
pick; 7.4 and 7.5 can run in parallel as research; 7.6 depends on 7.3.
No code changed — this is a planning pass, recorded in `docs/ROADMAP.md`.

## Named the pending NIHS bearing-clearance standards, instead of an unqualified unknown

Continued the side-shake/endshake acceptability research begun for
BRG-006/BRG-007 (both still informational advisories off Tier 6 forum
testimony, SRC-0011/SRC-0012). Checked three more leads and closed them
without registering anything (Dewey Clark's "Watch Adjustment" article,
read in full, is about positional adjustment/isochronism, not bearing
clearances; a nobswatchmaker.com blog post repeats SRC-0011's own
uncited figure; watchrepairtutorials.com remains bot-blocked).

- Found the FHS's own current catalog of available NIHS (Normes de
  l'Industrie Horlogère Suisse) standards. It names the exact Swiss
  primary standards most likely to hold the acceptability data this
  project needs: **NIHS 04-04 "Ajustements radiaux et axiaux"** (radial
  and axial fits) and its companion **NIHS 04-03**, plus, for jewel/bore
  dimensions, **NIHSG 41-11** and **NIHS 94-10** (= ISO 1112). All four
  would be Tier 1 primary standards — a real upgrade over SRC-0011/
  SRC-0012 — but are paywalled; three further targeted searches found no
  secondary source quoting their actual values.
- Registered the catalog itself (SRC-0029, actually read) and the named
  standards as unretrieved candidates (SRC-0030, SRC-0031), the same
  pattern already used for SRC-0007/SRC-0008. No number was invented:
  BRG-006/BRG-007 and ASM-0028/ASM-0029 still describe informal figures,
  now cross-referencing the specific standard that would supersede them
  instead of an unqualified "unknown."
- Updated SOURCES.yml, SOURCE_INDEX.md, TRACEABILITY.md,
  ASSUMPTION_REGISTER.md and the `src/reference/assumptions.ts` mirror.
  No equation, test, or validation rule changed; all 469 tests pass,
  `tsc --noEmit` and `eslint` are clean.

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
  (unlike the 3D viewport, which now punches bearing and screw holes,
  ASM-0056) still exports frames as solid slabs without them.

## Next (see `docs/ROADMAP.md`)

- Elevation/plan follow-ups, if useful: a section (cut) drawing with
  filled faces, tolerances on gear placement other than a FIXED shaft's
  own coordinates (chaining through MESH_POLAR/COAXIAL), a chosen or
  auto-fit elevation projection direction instead of the fixed X-Z one.
- Escapement beyond the simplified models: sourced or measured values
  for Q and escapement efficiency; tooth and pallet faces (drop, impulse
  geometry); amplitude-dependent rate; sources for ASM-0021, ASM-0024,
  ASM-0025 and ASM-0026.
