#!/usr/bin/env python3
"""Review candidate equivalent Rust mutations separately from killed mutants.

A passing test suite is NEVER enough to label an arbitrary survivor equivalent.
Only explicitly reviewed, semantically justified rewrites are allowlisted.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1] / "content" / "samples"
CANDIDATES = [
    # module, name, original, replacement, classification, semantic argument.
    ("m08", "entry_or_insert_with_pure_tuple",
     "grouped.entry(event.service).or_insert((0, 0))",
     "grouped.entry(event.service).or_insert_with(|| (0, 0))",
     "reviewed_equivalent",
     "Both default expressions create the same pure (0, 0) tuple; the lazy closure has no side effects, and the same borrowed map entry is returned."),
    ("m08", "compound_addition_to_explicit_addition",
     "entry.1 += event.bytes;", "entry.1 = entry.1 + event.bytes;",
     "reviewed_equivalent",
     "entry.1 is a u64 field on the same mutable entry, and event.bytes is a Copy u64; both spellings evaluate one addition with identical overflow semantics."),
    ("m08", "explicit_boolean_comparison",
     "if reading.accepted {", "if reading.accepted == true {",
     "reviewed_equivalent",
     "For a bool, comparing with true is exactly the original predicate with no side effects or coercions."),
    ("m09", "empty_line_length_check",
     "if line.is_empty() {", "if line.len() == 0 {",
     "reviewed_equivalent",
     "An &str is empty iff its UTF-8 byte length is zero; both expressions are pure and decide the same lines."),
    ("m09", "strict_ascii_bytes_via_slice",
     "value.bytes().all(|byte| byte.is_ascii_digit())",
     "value.as_bytes().iter().all(|byte| byte.is_ascii_digit())",
     "reviewed_equivalent",
     "Both iterate the same underlying UTF-8 bytes in the same order; is_ascii_digit checks the same byte for each iterator item."),
    ("m09", "trim_whitespace_lines_is_not_equivalent",
     "if line.is_empty() {", "if line.trim().is_empty() {",
     "killed_non_equivalent",
     "A line containing only ASCII spaces is not empty but becomes empty after trim; the first parser must report MissingDelimiter."),
]


def cargo(project: Path, command: str, target: Path) -> tuple[int, str]:
    run = subprocess.run(
        ["cargo", command, "--offline", "--manifest-path",
         str(project / "Cargo.toml")],
        cwd=project,
        env={**os.environ, "CARGO_TARGET_DIR": str(target)},
        text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        timeout=150, check=False,
    )
    return run.returncode, run.stdout


def main() -> None:
    results = []
    with tempfile.TemporaryDirectory(prefix="rust-equivalence-review-") as name:
        temp = Path(name)
        projects = {}
        for module in ("m08", "m09"):
            project = temp / (module + "-reference")
            shutil.copytree(ROOT / (module + "-reference"), project,
                            ignore=shutil.ignore_patterns("target"))
            projects[module] = project
            code, out = cargo(project, "test", temp / (module + "-target"))
            if code or "test result: FAILED" in out:
                raise AssertionError(module + ": unmodified full test baseline failed:\n" + out[-2500:])

        for module, label, original, replacement, classification, reasoning in CANDIDATES:
            project = projects[module]
            file = project / "src" / "lib.rs"
            source = file.read_text(encoding="utf8")
            if source.count(original) != 1 or not reasoning.strip():
                raise AssertionError(label + ": ambiguous transformation or missing semantic argument")
            file.write_text(source.replace(original, replacement, 1), encoding="utf8")
            try:
                code, checked = cargo(project, "check", temp / (module + "-target"))
                if code:
                    raise AssertionError(label + ": candidate did not compile:\n" + checked[-2400:])
                code, output = cargo(project, "test", temp / (module + "-target"))
                if classification == "reviewed_equivalent":
                    if code or "test result: FAILED" in output or "test result: ok." not in output:
                        raise AssertionError(label + ": reviewed-equivalent rewrite failed tests:\n" + output[-2800:])
                elif classification == "killed_non_equivalent":
                    if code == 0 or "test result: FAILED" not in output:
                        raise AssertionError(label + ": known different behavior escaped tests:\n" + output[-2800:])
                    if "could not compile" in output or re.search(r"error\[E\d+\]", output):
                        raise AssertionError(label + ": failure must be behavioral")
                    if "test model_differential_generated_config_grammar_and_first_failure ... FAILED" not in output:
                        raise AssertionError(label + ": the documented independent grammar oracle did not reject it")
                else:
                    raise AssertionError(label + ": any unreviewed survivor needs explicit review")
                results.append({
                    "module": module,
                    "name": label,
                    "classification": classification,
                    "reasoning": reasoning,
                    "compiles": True,
                    "full_suite": "passed" if code == 0 else "failed",
                })
                print(module + ": " + label + " -> " + classification, flush=True)
            finally:
                file.write_text(source, encoding="utf8")

        for module, project in projects.items():
            code, output = cargo(project, "test", temp / (module + "-target"))
            if code or "test result: FAILED" in output:
                raise AssertionError(module + ": restored reference must stay green")

    report_dir = os.environ.get("MUTATION_REPORT_DIR")
    if report_dir:
        out = Path(report_dir)
        out.mkdir(parents=True, exist_ok=True)
        (out / "equivalence-triage.json").write_text(json.dumps({
            "schema_version": 1,
            "scope": "reviewed equivalence hypotheses backed by semantic reasoning and full-suite tests",
            "candidates": results,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"Equivalence triage: {sum(x['classification'] == 'reviewed_equivalent' for x in results)} reviewed rewrites, "
          f"{sum(x['classification'] == 'killed_non_equivalent' for x in results)} proven non-equivalent.")


if __name__ == "__main__":
    main()
