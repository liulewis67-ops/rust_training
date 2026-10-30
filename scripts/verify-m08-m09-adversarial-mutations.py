#!/usr/bin/env python3
"""Record full independent test × compiling-mutant outcomes for M08/M09.

A mutation is killed only if an enumerated test fails after successful Cargo
compilation. Both integration suites always run, including for non-target tests.
"""
from __future__ import annotations

from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "content" / "samples"
SUITES = ("adversarial_contracts", "model_properties")
EXPECTED_TESTS = {"m08": 6, "m09": 7}

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
    ("m08", "skip_zero_byte_events",
     "entry.0 += 1;\n        entry.1 += event.bytes;",
     "entry.0 += usize::from(event.bytes != 0);\n        entry.1 += event.bytes;",
     "model_differential_generated_aggregation_and_reordering"),
    ("m08", "discard_blank_service_keys",
     "for event in events {",
     "for event in events { if event.service.trim().is_empty() { continue; }",
     "model_differential_generated_aggregation_and_reordering"),
    ("m08", "merge_service_case_variants",
     "grouped.entry(event.service).or_insert((0, 0))",
     'grouped.entry(if event.service == "API" { "api" } else { event.service }).or_insert((0, 0))',
     "model_differential_generated_aggregation_and_reordering"),
    ("m08", "drop_rejected_only_sensors",
     "let entry = grouped.entry(reading.sensor).or_insert((0, 0));",
     "if !reading.accepted { continue; }\n        let entry = grouped.entry(reading.sensor).or_insert((0, 0));",
     "model_differential_generated_sensor_rules_and_reordering"),
    ("m08", "cap_service_bytes_at_1024",
     "entry.1 += event.bytes;", "entry.1 += event.bytes.min(1024);",
     "model_differential_generated_aggregation_and_reordering"),
    ("m08", "ignore_negative_sensor_values",
     "entry.1 += value;", "entry.1 += value.max(0);",
     "model_differential_generated_sensor_rules_and_reordering"),
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
     '"history_unavailable",\n            "history service is temporarily unavailable; retry later.",',
     '"internal_storage_error",\n            "history service is temporarily unavailable; retry later.",',
     "l06_all_domain_variants_have_stable_exact_cli_and_http_contracts"),
    ("m09", "skip_whitespace_only_lines",
     "if line.is_empty() {\n            continue;\n        }",
     "if line.trim().is_empty() {\n            continue;\n        }",
     "model_differential_generated_config_grammar_and_first_failure"),
    ("m09", "accept_ascii_plus_prefix",
     "value.bytes().all(|byte| byte.is_ascii_digit())",
     "value.bytes().all(|byte| byte.is_ascii_digit() || byte == b'+')",
     "model_differential_generated_config_grammar_and_first_failure"),
    ("m09", "duplicate_empty_is_reported_as_invalid",
     "if duplicate {", "if duplicate && !value.is_empty() {",
     "model_differential_generated_config_grammar_and_first_failure"),
    ("m09", "lose_large_timeout_support",
     "value.parse::<u64>().map_err(|_| {",
     "value.parse::<u32>().map(u64::from).map_err(|_| {",
     "model_metamorphic_valid_field_order_blank_lines_and_limits"),
    ("m09", "off_by_one_eof_line",
     "let eof_line = input.lines().count() + 1;",
     "let eof_line = input.lines().count();",
     "l05_exact_numeric_bounds_missing_fields_and_extra_delimiters"),
    ("m09", "wrong_profile_http_status",
     '            404,\n            "profile_not_found",',
     '            409,\n            "profile_not_found",',
     "l06_all_domain_variants_have_stable_exact_cli_and_http_contracts"),
]



def cargo_test(project: Path, suite: str, target: Path) -> tuple[int, str]:
    result = subprocess.run(
        ["cargo", "test", "--offline", "--manifest-path",
         str(project / "Cargo.toml"), "--test", suite],
        cwd=project,
        env={**os.environ, "CARGO_TARGET_DIR": str(target)},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=120,
        check=False,
    )
    return result.returncode, result.stdout


def test_outcomes(output: str, suite: str) -> dict[str, str]:
    rows = re.findall(r"^test (\S+) \.\.\. (ok|FAILED)$",
                      output, flags=re.MULTILINE)
    results = {suite + "::" + name: state for name, state in rows}
    if len(results) != len(rows):
        raise AssertionError(suite + ": duplicate result names")
    return results


def run_contracts(project: Path, target: Path) -> tuple[dict[str, str], str]:
    outcomes: dict[str, str] = {}
    logs = []
    for suite in SUITES:
        code, output = cargo_test(project, suite, target)
        if ("could not compile" in output or
                re.search(r"error\[E\d+\]", output)):
            raise AssertionError(suite + ": compiler errors cannot kill mutations:\n" +
                                 output[-3000:])
        if code != 0 and "test result: FAILED" not in output:
            raise AssertionError(suite + ": Cargo did not run an assertion failure:\n" +
                                 output[-3000:])
        tests = test_outcomes(output, suite)
        if not tests:
            raise AssertionError(suite + ": no tests executed")
        outcomes.update(tests)
        logs.append(output)
    return outcomes, "\n".join(logs)


def replace_once(source: str, before: str, after: str, name: str) -> str:
    if source.count(before) != 1:
        raise AssertionError(name + ": expected exactly one mutation location")
    return source.replace(before, after, 1)


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="rust-mutation-matrix-") as dirname:
        temp = Path(dirname)
        projects = {}
        baseline_catalog: dict[str, list[str]] = {}
        for module in ("m08", "m09"):
            project = temp / (module + "-reference")
            shutil.copytree(SAMPLES / (module + "-reference"), project,
                            ignore=shutil.ignore_patterns("target"))
            projects[module] = project
            outcomes, output = run_contracts(project, temp / (module + "-target"))
            if (len(outcomes) != EXPECTED_TESTS[module] or
                    set(outcomes.values()) != {"ok"}):
                raise AssertionError(module + ": independent reference baseline failed:\n" +
                                     output[-3000:])
            baseline_catalog[module] = sorted(outcomes)

        killed: dict[str, list[dict]] = {"m08": [], "m09": []}
        for module, name, before, wrong, target in MUTANTS:
            project = projects[module]
            source = project / "src" / "lib.rs"
            pristine = source.read_text(encoding="utf8")
            source.write_text(replace_once(pristine, before, wrong, name), encoding="utf8")
            try:
                outcomes, logs = run_contracts(project, temp / (module + "-target"))
                if set(outcomes) != set(baseline_catalog[module]):
                    raise AssertionError(module + "/" + name + ": discovered test catalog changed")
                failed = sorted(k for k, status in outcomes.items() if status == "FAILED")
                scoped_target = (
                    ("model_properties" if target.startswith("model_") else "adversarial_contracts")
                    + "::" + target
                )
                if scoped_target not in failed:
                    raise AssertionError(
                        module + "/" + name + ": required behavior contract passed:\n" +
                        logs[-3400:])
                witness = re.search(r"MINIMIZED_COUNTEREXAMPLE [^\r\n]+", logs)
                if (target.startswith("model_differential_generated") and not witness):
                    raise AssertionError(module + "/" + name +
                                         ": seeded failure lacks reduced counterexample")
                entry = {
                    "name": name, "target": scoped_target, "status": "killed",
                    "detected_by": failed,
                }
                if witness:
                    entry["counterexample"] = witness.group(0)
                killed[module].append(entry)
                print(module + ": KILLED " + name + " by " + ", ".join(failed), flush=True)
            finally:
                source.write_text(pristine, encoding="utf8")

        for module, project in projects.items():
            outcomes, logs = run_contracts(project, temp / (module + "-target"))
            if (set(outcomes) != set(baseline_catalog[module]) or
                    set(outcomes.values()) != {"ok"}):
                raise AssertionError(module + ": restored full baseline failed:\n" + logs[-3000:])

    report_dir = os.environ.get("MUTATION_REPORT_DIR")
    if report_dir:
        output = Path(report_dir)
        output.mkdir(parents=True, exist_ok=True)
        for module in ("m08", "m09"):
            payload = {
                "schema_version": 1,
                "module": module,
                "reference": module + "-reference Cargo crate, all external integration suites",
                "baseline": "passed",
                "seed": "0xC0FF_EE0" + module[-1] + "_2026_1030",
                "generated_cases": 320 if module == "m08" else 384,
                "tests": baseline_catalog[module],
                "mutants": killed[module],
            }
            (output / (module + ".json")).write_text(
                json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                encoding="utf8")
    total = sum(len(rows) for rows in killed.values())
    print(f"M08/M09: {total}/{len(MUTANTS)} compiling mutants killed; full matrix captured.")


if __name__ == "__main__":
    main()
