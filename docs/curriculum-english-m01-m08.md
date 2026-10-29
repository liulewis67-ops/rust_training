# English course synchronization: M01–M08

## Scope

The repository originally had an English UI and translated navigation metadata, but no independent published English lesson Markdown. English reading routes therefore fell back to Chinese. This change introduces **48 English lesson pages** (M01–M08) and **32 accompanying English exercise sheets**.

Each English page keeps the original Chinese source's Rust fenced-code samples and available public archive URLs, while providing English learning objectives, topic explanation, Java/Go comparisons, practice transfer and acceptance evidence. The English text is a **concise pedagogical adaptation**, not a paragraph-for-paragraph translation of the longer Chinese course.

## Review and release

| Module | Topics | PR |
| --- | --- | --- |
| M01 | Toolchain and development loop | #32 |
| M02 | Types, control flow and arithmetic limits | #33 |
| M03 | Structs, enums, Option and encapsulation | #34 |
| M04 | Ownership, move, Copy/Clone, Drop | #35 |
| M05 | Borrowing, NLL, UTF-8 slicing | #36 |
| M06 | Lifetimes, borrowed/owned views, Cow | #37 |
| M07 | Generics, traits, dyn dispatch and newtypes | #38 |
| M08 | Collections, closures, iterators, aggregations | #39 |

- The bilingual parity test checks 48 matching lesson IDs, 32 exercise sheets, preserved original code fences, ZIP download references, English learning sections and correct practice grouping in the reading UI.
- M09's six currently published lessons still have no English lesson Markdown and intentionally fall back to Chinese. The total number of public courses stays **54**, not 48.
- The tests cannot claim exhaustive translation equivalence or that every new optional learner task has been run against its own Cargo fixture. Do not advertise a hosted grader or translated binary ZIPs.

## Next editorial pass

Review learner feedback on the concise English explanations, and expand individual topics where deeper step-by-step explanations are necessary. Any future parity claims should refer to the structural/code and learning-outcome contracts, not a one-to-one sentence translation.
