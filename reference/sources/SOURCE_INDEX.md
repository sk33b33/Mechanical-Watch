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

### SDP/SI — Elements of Metric Gear Technology, spur gears/involute geometry (SRC-0024, read)
Same document family as SRC-0008, a different section, read via a mirror
host after sdp-si.com itself kept redirecting. Supplies the metric ISO
basic rack proportions (addendum m, dedendum 1.25m, 20° pressure angle),
the involute function inv(α) = tanα − α and parametric involute curve,
standard base/outside/root diameter formulas, and the minimum-tooth-count-
before-undercut formula z_c ≥ 2/sin²α. Used for GEAR-103 and ASM-0030 (the
INVOLUTE_PROFILE tooth geometry). Generic machine-gear source, not
horological — see SOURCES.yml for the full scope note.

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
