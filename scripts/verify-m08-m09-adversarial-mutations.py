#!/usr/bin/env python3
"""Mutation sensitivity against *real M08/M09 reference crates*.

A mutation must compile and fail a named external integration assertion. No
starter is repaired, and no assertion can be considered killed by a rustc
error, test-discovery failure, or unrelated panic.
"""
from __future__ import annotations

from pathlib import Path
import os
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "content" / "samples"

# module, mutation, exact one-time source span, replacement, targeted test.
MUTANTS = [
    ("m08", "overwrite_aggregate_count",
     "entry.0 += 1;\n        entry.1 += event.bytes;",
     "entry.0 = 1;\n        entry.1 += event.bytes;",
     "l05_all_permutations_preserve_counts_totals_and_sorted_case_sensitive_keys"),
    ("m08", "overwrite_aggregate_bytes",
     "entry.1 += event.bytes;", "entry.1 = event.bytes;",
     "l05_all_permutations_preserve_counts_totals_and_sorted_case_sensitive_keys"),
    ("m08", "reverse_public_sort",
     "left.service.cmp(right.service)", "right.service.cmp(left.service)",
     "l05_empty_and_blank_are_distinct_borrowed_keys_not_missing_events"),
    ("m08", "treat_rejected_as_present",
     "if reading.accepted {", "if reading.value.is_some() {",
     "l06_never_converts_none_or_rejected_zero_into_an_accepted_reading"),
    ("m08", "convert_none_to_accepted_zero",
     "if let Some(value) = reading.value {",
     "if let Some(value) = reading.value.or(Some(0)) {",
     "l06_never_converts_none_or_rejected_zero_into_an_accepted_reading"),
    ("m08", "overwrite_sensor_total",
     "entry.1 += value;", "entry.1 = value;",
     "l06_permutations_preserve_zero_missing_rejected_and_signed_cancellation"),
    ("m09", "misclassify_missing_delimiter",
     "ConfigErrorKind::MissingDelimiter,\n                \"<line>\",",
     "ConfigErrorKind::UnknownField,\n                \"<line>\",",
     "l05_first_error_stays_first_across_crlf_unicode_and_malformed_followups"),
    ("m09", "allow_duplicate_with_invalid_value",
     "if duplicate {", "if duplicate && value.bytes().all(|byte| byte.is_ascii_digit()) {",
     "l05_first_error_stays_first_across_crlf_unicode_and_malformed_followups"),
    ("m09", "off_by_one_error_column",
     "let value_column = key.chars().count() + 2;",
     "let value_column = key.chars().count() + 1;",
     "l05_exact_numeric_bounds_missing_fields_and_extra_delimiters"),
    ("m09", "lose_internal_source_chain",
     "Self::StorageUnavailable(cause) => Some(cause),",
     "Self::StorageUnavailable(_) => None,",
     "l06_nested_error_chain_survives_multiple_public_presentations"),
    ("m09", "leak_storage_error_in_display",
     'Self::StorageUnavailable(_) => f.write_str("history storage unavailable"),',
     'Self::StorageUnavailable(cause) => write!(f, "{cause}"),',
     "l06_nested_error_chain_survives_multiple_public_presentations"),
    ("m09", "rewrite_request_id",
     "request_id: request_id.to_owned(),",
     "request_id: request_id.trim().to_owned(),",
     "l06_nested_error_chain_survives_multiple_public_presentations"),
    ("m09", "change_api_public_code",
     '"history_unavailable",', '"internal_storage_error",',
     "l06_all_domain_variants_have_stable_exact_cli_and_http_contracts"),
]


def cargo_test(project: Path, name: str, target: Path) -> tuple[int, str]:
    result = subprocess.run(
        ["cargo", "test", "--offline", "--manifest-path",
         str(project / "Cargo.toml"), "--test", "adversarial_contracts", name],
        cwd=project,
        env={**os.environ, "CARGO_TARGET_DIR": str(target)},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=120,
        check=False,
    )
    return result.returncode, result.stdout


def replace_once(source: str, before: str, after: str, name: str) -> str:
    if source.count(before) != 1:
        raise AssertionError(name + ": mutation site changed (expected exactly one)")
    return source.replace(before, after, 1)


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="rust-advanced-mutants-") as dirname:
        temp = Path(dirname)
        projects = {}
        for module in ("m08", "m09"):
            source = SAMPLES / (module + "-reference")
            project = temp / (module + "-reference")
            shutil.copytree(source, project, ignore=shutil.ignore_patterns("target"))
            projects[module] = project
            code, out = cargo_test(project, "", temp / (module + "-target"))
            if code != 0 or "test result: ok. 4 passed; 0 failed" not in out:
                raise AssertionError(module + ": baseline external tests failed:\n" + out[-3000:])

        for module, name, original, wrong, test in MUTANTS:
            project = projects[module]
            source_file = project / "src" / "lib.rs"
            unchanged = source_file.read_text(encoding="utf8")
            source_file.write_text(replace_once(unchanged, original, wrong, name), encoding="utf8")
            try:
                code, out = cargo_test(project, test, temp / (module + "-target"))
                if code == 0 or "test result: FAILED" not in out:
                    raise AssertionError(module + "/" + name + ": wrong implementation passed:\n" + out[-3000:])
                if "could not compile" in out or re.search(r"error\[E\d+\]", out):
                    raise AssertionError(module + "/" + name + ": compiler failure is not evidence:\n" + out[-3000:])
                if not re.search(
                    r"test " + re.escape(test) + r" \.\.\. FAILED",
                    out,
                ):
                    raise AssertionError(module + "/" + name + ": named assertion did not fail:\n" + out[-3000:])
                print(module + ": KILLED " + name + " via " + test)
            finally:
                source_file.write_text(unchanged, encoding="utf8")

        for module, project in projects.items():
            code, out = cargo_test(project, "", temp / (module + "-target"))
            if code != 0:
                raise AssertionError(module + ": restored reference failed:\n" + out[-3000:])
    print(f"M08/M09: {len(MUTANTS)}/{len(MUTANTS)} compiling mutants killed.")


if __name__ == "__main__":
    main()
