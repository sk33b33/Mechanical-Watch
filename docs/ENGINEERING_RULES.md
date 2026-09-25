# Engineering Rules

## Units
SI internally.

## Gear rules
A gear mesh requires:
- compatible module;
- compatible pressure-angle assumptions;
- valid tooth counts;
- appropriate centre distance.

## Compound trains
For a compound pair, propagate ratios stage-by-stage. Keep the identity of each shaft explicit.

## Direction
An external gear mesh reverses rotational direction.

## Validation
A warning is not an error. Errors prevent a design from being represented as valid at that validation level.

## Physical realism
A mathematically consistent ideal gear train is not proof of:
- correct tooth profile;
- correct lubrication;
- acceptable friction;
- structural strength;
- manufacturability;
- timing accuracy.
