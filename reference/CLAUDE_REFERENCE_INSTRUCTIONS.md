# Instructions for Claude Code

Before implementing a nontrivial mechanical-watch feature:

1. Search the reference directory for an existing source or rule.
2. Determine whether the requested value is:
   - standard;
   - research-derived;
   - manufacturer-specific;
   - movement-specific;
   - derived;
   - assumption;
   - unknown.
3. Prefer the highest-quality available source.
4. Record the source ID in the implementation documentation.
5. Implement equations as pure functions where possible.
6. Add tests.
7. Add validation rules.
8. Expose important assumptions to the user.
9. Never invent missing dimensions or material properties.
10. Never use a generic machine-gear equation as proof that a horological gear is manufacturable.
11. Never use a visual simulation as proof of physical accuracy.
12. If evidence conflicts, preserve both claims, identify the scope of each, and ask for a decision when the conflict affects the design.

## Source retrieval

If internet research is needed, use authoritative sources and record:
- URL/DOI;
- title;
- date;
- relevant section;
- claim supported.

Do not paste copyrighted books or manuals into the repo. Record bibliographic metadata and concise notes instead.

## Code review questions

For every engineering PR/commit ask:

- What physical quantity is being modeled?
- What are its units?
- What equation governs it?
- Where did the equation/value come from?
- What assumptions were made?
- What validation level does this support?
- What happens at invalid inputs?
- What tests prove the implementation?
