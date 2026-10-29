# M09 English course translation review

## Scope

English-mode readers can now load the six original **M09-L01–M09-L06** published lesson bodies directly from `content/releases/en/`. Concept lessons **L01–L04** also have four translated exercise sheets, including hints and reference answers.

The module covers `Result` and `?`, custom error types and `Error::source()`, library-to-CLI/API mapping, `panic` versus `Result`, a strict UTF-8 configuration parser lab, and a CLI/HTTP safe-error assessment.

## Safety and behavior contracts

- Preserve all original Chinese-source fenced Rust/text examples **unchanged** and in order; students can compare English explanations against the same behavior.
- Keep `ConfigError` classifications, Unicode `char` column positions, field validation, and the L05 duplicate-field regression.
- Keep L06's exact CLI `stderr`, exit codes, API status/code/message, `retryable` and `request_id` requirements. Explicitly keep secrets and raw storage causes out of public responses while retaining controlled diagnostics.
- English L05/L06 link directly to the existing `content/samples/m09-starter` and `content/samples/m09-reference` Cargo projects. Neither a ZIP nor a hosted grader is available.
- Keep the user-selectable language mode and previously published Chinese source files unchanged.

## Verification

The M09 English regression test validates all six bodies and four exercise files, source-code fence parity, source links, actual catalog loading, accurate reader section groups, and the critical lab contracts. Existing site and M08/M09 Cargo CI still run as normal.

This is a reader-friendly English teaching adaptation; it preserves the technical contracts but is not a sentence-for-sentence translation of Chinese text. Overall published coverage is **54 bilingual lessons** with **36 bilingual concept exercise sheets**. The publication manifest and lesson count are unchanged.
