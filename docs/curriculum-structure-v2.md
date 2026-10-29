# Rust learning architecture v2 — one connected engineering path

## Diagnosis

The course had 54 released lessons with substantial examples, exercises and tests, yet learner-facing navigation mostly enumerated facts and modules. Numerous English lessons contained generic headings such as *Core concept 1/2/3*, and chapters rarely explained which previously completed artifact made the new topic necessary. Adding isolated practice questions alone did not solve this.

## Coherent thread and dependency contract

**Narrative:** Start with a reproducible Rust utility; gradually define typed values and business state, trace ownership and safe borrowed views, create reusable strategies, aggregate operational events and safely present failures through CLI and API boundaries.

These stages are **teaching connections among existing individual labs**, not a claim that the published ZIP and Cargo exercises are one integrated, runnable codebase. Each lesson states (1) the previous deliverable, (2) the new limitation, (3) the design decision, (4) the artifact and its evidence, and (5) why the next lesson depends on it.

| Module | Six-step engineering arc | Exit evidence |
| --- | --- | --- |
| M01 | Choose → reproduce → diagnose → review → repair → deliver | Small testable Cargo utility and verified build record |
| M02 | Types → functions → loops → shapes → units → total | Boundary-safe calculation API |
| M03 | Entity → states → missing lookup → encapsulation → task list → reminder | Stable domain state contract |
| M04 | Drop → move → clone decision → partial move → text pipeline → ticket | Auditable ownership and handoff |
| M05 | Shared/mutable → NLL → UTF-8 → narrow API → zero copy → split | Valid borrowed text API |
| M06 | Dangling → annotations → owned/view → static → parsed results → Cow | Lifetime-aware output choices |
| M07 | Generics → trait → dyn → newtype → parser → gate chain | Replaceable, validated behavior |
| M08 | Collections → closures → iterators → laziness → logs → sensors | Deterministic aggregation contracts |
| M09 | Result → cause → adapters → panic policy → config → history | Safe CLI/API error contract |

## Reader behavior

A concise, six-step clickable map shows the current lesson in the module's progression. The Markdown text itself also contains a bilingual engineering bridge so the rationale is visible when files are read outside the website. The established authored Rust examples, tests, source URLs, downloadable assets and course IDs remain unchanged.

## Editorial guardrails

- A problem must arise from an identifiable missing capability, not a made-up textbook prompt.
- No invented runnable workspace or unimplemented feature may be presented as available.
- State the *design choice* separately from the syntax or type-system rule.
- State an observable artifact and a nontrivial validation criterion, not merely "understand the concept".
- Carry forward the preceding lesson's artifact; make the next step depend on an unresolved constraint.
- Keep Chinese and English logically equivalent while allowing idiomatic exposition.
- Preserve all fenced code examples byte-for-byte, keep heading anchors in existing sections, and never rewrite published starter/reference contracts.
- Lesson-level tests enforce story completeness; existing contract and code parity tests remain in effect.

## Publication plan

First release the 54-step data model, reader UX and an M01 bilingual pilot. Then update M02–M09 module-by-module with the same continuity rule and full CI review. Avoid unrelated visual redesign or additional dependencies.
