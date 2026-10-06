# Source Index

This is the curated starting index. Store downloaded/licensed documents only when redistribution rights permit. Otherwise store metadata and citations rather than copies.

## Foundations / units

### NIST — SI and technical units
- NIST Special Publication 330
- NIST Guide to the SI, Chapter 8
- NIST Guide to the SI, Appendix B.9

Use for SI units, angular velocity, frequency and torque unit conventions.

## Watchmaking

### Watchmaking.com
Useful specialist reference for watchmaking topics, wheel trains, escapements, balance/spring design and engineering-oriented horology material.

Use as a specialist reference, not as an automatic authority for every numerical value.

## Swiss lever escapement research

### Fu & Du — Swiss Lever Escapement Mechanism
2008, academic chapter.
DOI: 10.1201/9780849307768-3

Useful for mechanism structure, operating principle and dynamic-model concepts.

### Tribology International — Swiss lever escapement
2017 research on contact instrumentation, FEM and contact dynamics.

Useful for understanding why friction/contact modelling is substantially more complex than ideal gear kinematics.

### Wear — Experimental tribological analysis
2017 research on Swiss lever escapement contact, wear and kinematics.

Use for research context; do not copy numerical parameters into generic movements without checking applicability.

## Gear geometry

### Nie, Jiang, Han & Geng — spiral bevel gear machining, JSME 2026 (SRC-0010, read)
Peer-reviewed (Bulletin of the JSME, JAMDSM Vol.20 No.2 (2026), DOI
10.1299/jamdsm.2026jamdsm0019). §4 states, for a pinion/gear pair in
line-conjugate (bevel) mesh, i₁₂ = ψ2/ψ1 = z1/z2 — the transmission ratio
is the inverse tooth-count ratio, the same relation as for spur gears,
but here stated for an intersecting-axis pair. This is the citation for
the right-angle stem mesh ratio (ASM-0019): see SOURCES.yml.

### Wikipedia — Gear train (SRC-0009, read)
States the general tooth-count speed ratio for two meshing gears, from
the ratio of pitch-circle radii. Scoped to spur/parallel-axis gears in
the article; does not itself extend to bevel/crossed-axis meshes. Supports
part of the reasoning behind ASM-0019; SRC-0010 covers the rest.

### ISO 23509:2016 — Bevel and hypoid gear geometry (SRC-0007, candidate, superseded)
### SDP/SI — Elements of Metric Gear Technology, bevel gearing (SRC-0008, candidate, superseded)

Originally recorded as candidate citations for ASM-0019. Superseded by
SRC-0010, which states the same relation directly and was actually read.
Left here unread rather than removed, per the rule to never hide an
assumption or its evidence trail: sdp-si.com remains blocked by this
environment's network policy and ISO 23509 is paid. See SOURCES.yml.

### Toman & Abdullah — rack-cutter parametric tracing of involute gears, J. Engineering 2025 (SRC-0025, read)
Open access, peer-reviewed. States the standard construction for a gear's
root fillet: the trochoid traced by the center of a rack-type cutter's
rounded tip corner as it rolls on the gear's pitch circle, offset outward
by the corner radius. Its corner-center formula (eq. 19-20) is reproduced
independently in `src/math/trochoidFillet.ts` (`cutterCornerCenter`) and
matches exactly; its dense final combined equations (eq. 41-42) were not
transcribed (an inconsistency was found in an intermediate step when
spot-checked). An independent rederivation of the rest of the
construction (tracing the corner's trochoid and offsetting it by the
fillet radius) did not pass its own cross-checks — see SOURCES.yml notes
— so only the verified corner-center piece is implemented; the fillet
itself is still the straight-line approximation ASM-0030 describes. Not
yet used for GEAR-103 (only `cutterCornerCenter` exists, unused).

### SDP/SI — Elements of Metric Gear Technology, spur gears/involute geometry (SRC-0024, read)
Same document family as SRC-0008, a different section, read via a mirror
host after sdp-si.com itself kept redirecting. Supplies the metric ISO
basic rack proportions (addendum m, dedendum 1.25m, 20° pressure angle),
the involute function inv(α) = tanα − α and parametric involute curve,
standard base/outside/root diameter formulas, and the minimum-tooth-count-
before-undercut formula z_c ≥ 2/sin²α. Used for GEAR-103 and ASM-0030 (the
INVOLUTE_PROFILE tooth geometry). Generic machine-gear source, not
horological — see SOURCES.yml for the full scope note.

### Hugh Sparks — Designing Cycloidal Gears (SRC-0026, read)
Tier 5 practitioner page deriving British Standard 978 Part 2 (≡ Swiss
NIHS 26702) cycloidal horological gear design into worked equations and
standardized tables, citing BS 978 Pt 2 itself plus Grossmann, Britten &
Good, Wild (2001, the standard modern reference on horological wheel and
pinion cutting) and Saunier. Covers: why horology uses cycloidal, not
involute, gearing (undercut at clock/watch pinions' typically low leaf
counts); "clock toothing" (generating circle diameter = the pinion's own
pitch radius, giving a straight-line pinion dedendum); the standard's
own circular-arc approximation of the addendum tip, tabulated by leaf
count and profile style (round/medium/high ogival) with a practical 5%
clearance reduction; pinion dedendum depth and narrowed tooth-width
conventions. BS 978 Pt 2 / NIHS 26702 itself is paywalled and was not
accessed — this is a secondary, derived source. Used for ASM-0032,
ASM-0033 and GEAR-104 (WATCH_SPECIFIC_PROFILE tooth geometry).

### Jacob Cowdrey (Oakland University honors thesis) — Analysis of Gear Tooth Profiles for Use in a Mechanical Clock (SRC-0027, read)
Tier 4 undergraduate honors thesis, faculty-mentored. Corroborates
SRC-0026 independently: cycloidal gearing's history and continued
standard use in mechanical clocks/watches, the ~18-tooth involute
undercut threshold vs. cycloidal gears working with very few teeth, the
"clock toothing" straight-dedendum special case in the author's own
words, and that cycloidal tooth shape (unlike involute) is specific to
the gear pair it meshes with. Used only for corroboration, never as a
sole source for a numeric value.

### Wikipedia — Hypocycloid (SRC-0028, read)
Tier 6 (encyclopedia), used only for the standard parametric
roulette-curve formula (a circle rolling inside a fixed circle), not
for any horological claim. Supplies the x(θ), y(θ) equations and the
r=R/2 degenerate straight-line special case (the Tusi couple) that
ASM-0032's "clock toothing" dedendum already relies on; used to extend
that straight-line special case into the general mesh-aware curved
dedendum (`hypocycloidPoint` in src/math/cycloidTooth.ts). The
degenerate case was independently re-derived and checked numerically
before being trusted.

## Bearing clearances

### NAWCC Forums — Watchmaking tolerances thread (SRC-0011, read)
Forum testimony (Tier 6, like Watchmaking.com), not a published standard.
Gives the .05mm (escapement) / .10mm (train) endshake figures used for
the BRG-006 informational advisory (ASM-0028). Also gives a
balance-staff-specific side-shake figure (~.01mm), too narrow on its own
(one component, one poster, a single value) — superseded for side shake
by SRC-0012 below. See SOURCES.yml for the full notes and quoted claims.

### NAWCC Forums — Jewel hole dimensions thread (SRC-0012, read)
Forum testimony (Tier 6), not a published standard, but more specific
and better attributed than SRC-0011's side-shake figure: a two-band rule
(0.01mm side shake for pivots up to 0.30mm, 0.02mm above that) credited
to Hans Jendritzki, a named, real, WOSTEP-connected watchmaking
instructor and author of "Watch Adjustment" — not read directly (this is
still a forum paraphrase of it), but independently corroborated by
SRC-0013's unrelated data point. Used for the BRG-007 informational
advisory (ASM-0029). `watchrepairtutorials.com`'s directly relevant
articles were found but still not read (bot-challenge page, not a
network block) — worth another attempt if a stronger source is needed.

### Watch Repair Talk — end-shake/side-shake thread (SRC-0013, read)
A single corroborating data point (0.01mm side shake for a 0.15mm
pivot), not registered as its own citation — recorded because it agrees
with SRC-0012's Jendritzki rule from an unconnected thread and poster.

### FHS — NIHS standards catalog (SRC-0029, read) and the standards it names (SRC-0030, SRC-0031, both unretrieved)
The FHS's own current catalog of available NIHS (Normes de l'Industrie
Horlogère Suisse) standards names the exact primary standards most
likely to hold acceptable side-shake/endshake clearance data: **NIHS
04-04 "Ajustements radiaux et axiaux"** (radial and axial fits, with
companion **NIHS 04-03 "Application des tolérances"**, SRC-0030), and,
for jewel/bore dimensions specifically, **NIHSG 41-11 "Dimensions des
pierres"** and **NIHS 94-10 (= SN ISO 1112)** (SRC-0031). All four would
be Tier 1 primary standards — a real upgrade over SRC-0011/SRC-0012's
Tier 6 forum testimony — but are paywalled; no secondary source quoting
their actual values was found despite three targeted searches. BRG-006/
BRG-007 remain informational advisories pending access to SRC-0030 or
SRC-0031, or a secondary source that quotes them.

## Balance rate vs. amplitude (isochronism / circular error)

### Bowman — Determination of Very Small Changes in Rate..., J. Research NBS 1950 (SRC-0032, read)
NIST/NBS research-journal paper describing a lab instrument for plotting
isochronism curves; used here as a secondary citation of Phillips' 1861
geometric zero-error conditions for a hairspring terminal curve, and as
genuine evidence the phenomenon (rate varying with amplitude as the
mainspring runs down) is real and significant — not as a quantitative
rate-vs-amplitude formula, since it doesn't give one (its own figures are
measured curves, not an equation). This project's `isochronismCoefficient`
(ASM-0034) is a declared/measured per-movement input for exactly this
reason: no general formula was found.

### Phillips — Mémoire sur le spiral réglant..., 1861 (SRC-0033, unretrieved, cited via SRC-0032)
The historical source of the hairspring terminal-curve (overcoil)
isochronism theory. Not read directly — recorded because SRC-0032 quotes
it, so the citation trail says so rather than implying this project read
the 1861 memoir itself.

## Balance quality factor Q and escapement efficiency (ASM-0026)

### Douglas Bateman, via Jack Forster and watchprosite.com (SRC-0034, read, secondhand)
Two independent professional watch writers credit Douglas Bateman with a
1970s finding that Q, not escapement type, is the dominant predictor of
a timekeeper's accuracy, and both independently cite "~300" for a good
mechanical wristwatch balance (a third source gives a broader "~100 to
300" range across grades). Bateman's own paper was not located or read —
Tier 6, like SRC-0011/SRC-0012. Used for the SPR-004 informational
advisory (ASM-0035) only; never applied to any specific movement's own Q.

### SJX — The Geometric Efficiency of Escapements, 2024 (SRC-0035, read)
Derives 91% (15-tooth) and 88% (20-tooth) Swiss lever escapement
*geometric* efficiency from impulse-angle data in Defossez's "Théorie
générale de l'horlogerie" (corroborated by Daniels' "Watchmaking") and
Vermot & Dordor's "Mécanique & Construction" — real, named, recognized
horological references. Explicitly geometric-only (excludes friction and
dynamic losses), so it bounds but doesn't supply this project's
`escapementEfficiency` (the full fraction reaching the balance). Not
implemented as a rule: only two data points were obtained, not the
general formula, so no accurate bound for an arbitrary tooth count can
yet be computed. A genuine partial finding, recorded rather than dropped.

## Lever escapement geometry (drop, lock, draw, run, lift)

### Playtner — An Analysis of the Lever Escapement, 1908 (SRC-0036, read)
Tier 4, a recognized book-length primary watchmaking text on lever-
escapement geometry specifically, freely available via Project Gutenberg.
Gives, with worked examples: drop is 1½° (club tooth) to 2° (ratchet
tooth), converted to a linear tip-circle clearance by arc length (radius
× angle); for two beats per tooth, each beat's wheel-angle budget (tooth
width + pallet width + drop, all measured at the escape wheel's own
axis) is half the tooth pitch (12° for a 15-tooth wheel); drop, lock,
draw and lift are all measured in different angle frames (wheel-center
vs. pallet-center); the equidistant pallet construction is exactly the
tangent-intersection ("tangential") construction this codebase's
`tangentialCentreDistance`/`lockingPoints` already build, while the
circular pallet construction (equal lifting lever arms, two locking
circles) locks off the tangent by a pallet-width-dependent amount with
no closed-form offset given. Also corroborates this project's existing
teaching-movement lock (2°) and draw (12°) angles as the right order of
magnitude. Used for ASM-0036 (`PalletGeometry.dropAngle`), ASM-0037
(`PalletGeometry.kind`/`widthAngle`, `toothWidthAngle`), ASM-0038
(`EscapeWheel.toothKind`, CLUB | RATCHET — CLUB has its own impulse face
so the derived tooth width must stay positive, RATCHET is "a metal point
passing over a jeweled plane" with the entire lift on the pallet so the
tooth width may be exactly zero; the drop advisory also splits by type,
1.5° club / 2° ratchet) and ASM-0039 (`drawAngle` is the pallet locking
face's inclination from the radial line through the locking point,
"inclined 12° from EB, and FB"; the escape tooth's own locking face is
derived, not declared, as conventionally double the pallet's draw, for
point contact — "we could make it a little less or a little more", with
a cited practical working range of 20°-28°) and the ESC-106/ESC-107/
ESC-108 rules. Now also used for ASM-0040: the escape wheel's teeth and
pallet stones are drawn as real 2D outlines (`generateEscapeWheelOutline`/
`generatePalletStoneOutline`, `src/geometry/assemblyGeometry3d.ts`) using
the model's own derived angles — straight-edged quadrilaterals, the
locking edge found by an exact ray–circle intersection at the declared/
derived draw angle, not an arbitrary visual lean; still visual only,
not a manufacturing claim. Two of the chapter's own figures (Fig. 5,
Fig. 28) were fetched and viewed to ground the pallet stone's general
shape, without reverse-engineering their full construction. CIRCULAR is
named but not implemented (no closed-form locking offset available).
The book's remaining treatment of true lifting-face curvature, the
tooth/pallet FACE contact geometry itself, the real/primitive-circle
correction, the engaging/disengaging asymmetry and the locked-vs-
unlocked position correction is out of scope for this pass.

Now also used for ASM-0041, the first piece of this book's separate
"Fork and Roller Action" chapter: `Balance.impulseRadius` ("the ruby
pin, or strictly speaking, the 'impulse radius,' is a lever arm, whose
length is measured from the center of the balance staff to the face of
the ruby pin"), entered directly like `inertia`/`hairspringStiffness`.
The fork's real acting length is derived, not declared
(`forkActingLength`, ESC-109), via Playtner's own stated law — "the
angles are in the inverse ratio to the radii" — and a worked example,
"the acting length of fork = 4.5 mm", divided by the teaching
movement's own cited 5:1 impulse/lever-angle proportion ("some might
use a proportion of... even 5 to 1") to choose its 0.9 mm impulse
radius.

Now also used for ASM-0042, the second piece of this same chapter:
`PalletGeometry.rubyPinEntryFreedom` ("the ruby pin in entering the
fork must have a certain amount of freedom for action, from 1 to 1¼°")
must be strictly less than the total lock (lock + run) — "it is
important that the angular freedom... be less than the total locking
angle on the pallets", a hard necessity, not just cited, so a
premature strike leaves the pallets still locked (ESC-110);
`rubyPinSlotShake` ("it varies from ¼° to ½°, according to length of
fork and shape of ruby pin") is a simple positive-when-declared check
with the figure cited as an advisory. The ruby pin's own suggested
width is derived, not declared (`suggestedRubyPinWidth` = lever angle
÷ 2, "we would choose a ruby pin of a width equal to half the angular
motion of the fork") — a cited convention, not a strict formula. The
teaching movement's own 1¼° entry freedom is Playtner's exact cited
number from his total-lock worked example. The rest of this chapter
(the fuller width/freedom/impulse-radius relationship in Figs. 17-20,
the Savage pin roller) remains unmodeled, as do "The Crescent" and "The
Horn" (angular opening, length and freedom) chapters, scoped as Phase
7.1.5's later sub-items (`docs/ROADMAP.md`).

Now also used for ASM-0043, from the book's "The Safety Action" chapter:
`Balance.rollerKind` (SINGLE | DOUBLE) names the trade-off Playtner
draws — "in the single roller the safety action is at the mercy of the
impulse and pallet angles... in order to favor the impulse we require a
large roller, and for the safety action a small one, therefore
escapements made on fine principles are supplied with two rollers, one
for each action." When SINGLE, a fork ratio below his own hedged floor
("a proportion between the fork and impulse angles in 10° pallets of 3
or 3½ to 1, depending upon the size of the escapement, is the lowest
which should be made in single roller") is a non-blocking advisory
(ESC-111), not checked for DOUBLE. `PalletGeometry.guardPointFreedom`
and `guardPointRadius` are entered directly, the same pattern as the
ruby-pin fields; guard-point freedom must be strictly less than the
total lock, the same hard necessity as entry freedom — "when the guard
point is pressed against the roller the escape tooth must still rest
on the locking face of the pallet" (ESC-111). The two together derive a
linear clearance at the bank (`guardPointClearance`, arc length =
radius × angle, the same formula as `dropClearance`); the teaching
movement's own 1¼° freedom and 4 mm radius are Playtner's own worked
numbers, reproducing his own computed clearance, 0.0873 mm, exactly.
No separate roller geometry (diameter, the dart's own shape) is
modeled for either roller kind — unmodeled, same as the rest of "The
Safety Action", "The Crescent" and "The Horn" chapters.

## Mainspring torque curve and bridle slip (REF-ENG §11)

### Roymech — Springs Spiral (SRC-0037, read)
Mechanical-engineering reference for spiral/clock springs. Its spring-rate
formula (k = M/θ, k = E·b·t³/12·L) treats the spring as a plain linear
torsion spring — narrower than, not an improvement on, this project's own
two-point-line model. No discussion of friction or barrel-wall contact.
Its own formulas are images with no alt text; fetched and read as images
directly to get the quoted values — a new variant of this project's
"WebFetch can't extract this" workaround.

### hourstriker.com and watchtime.com mainspring articles (SRC-0038, unread — both 403)
Both sites blocked WebFetch and a direct `curl` alike. Recorded, per the
SRC-0023 precedent, as unread search-engine snippets only: an "ideal peak
estimate, not a full real-world torque curve" formula, and a ~1.3-1.5×
bridle slip-torque ratio scoped (by other unread snippets) to automatic
winding specifically — a mechanism this project doesn't model at all.
Nothing here was used to implement anything.

### US8950552B2 patent, background section (SRC-0039, read)
Confirms, independently of SRC-0037, that real mainsprings have a
non-constant torque curve — but gives no formula or shape, just states
the problem. A third source landing on the same negative result.

## Movement-specific sources

Movement-specific measurements must live under:

reference/sources/09-movement-specific/

Each movement should have its own record and evidence trail.

Example:

reference/sources/09-movement-specific/
  ETA-2824/
    README.md
    dimensions.md
    sources.yml
    notes.md

Do not mix movement-specific data with generic watchmaking constants.
