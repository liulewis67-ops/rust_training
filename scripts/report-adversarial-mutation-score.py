#!/usr/bin/env python3
"""Strict, machine-readable test × mutant coverage report for M07–M09.

Only named failures of successfully compiling mutants count as detections.
Matrix rows are mutants, columns are actually executed independent tests.
"""
from __future__ import annotations

import csv
import json
import os
from pathlib import Path

EXPECTED = {
    "m07": {"count": 11, "cases": 448, "tests": 7, "seed": "0x7AB1202610300007"},
    "m08": {"count": 12, "cases": 320, "tests": 6, "seed": "0xC0FF_EE08_2026_1030"},
    "m09": {"count": 13, "cases": 384, "tests": 7, "seed": "0xC0FF_EE09_2026_1030"},
}


EXPECTED_CATALOG = {
    "m07": [
        "adversarial_contracts::colon_first_delimiter_unicode_and_trimmed_fields",
        "adversarial_contracts::empty_key_has_priority_over_empty_value",
        "adversarial_contracts::equals_first_delimiter_not_last_and_canonical_label",
        "adversarial_contracts::generated_inputs_match_oracle_for_both_parsers",
        "adversarial_contracts::incompatible_delimiters_reject_even_with_other_punctuation",
        "adversarial_contracts::key_trailing_whitespace_is_trimmed_not_preserved",
        "adversarial_contracts::value_with_only_unicode_whitespace_is_not_present",
    ],
    "m08": [
        "adversarial_contracts::l05_all_permutations_preserve_counts_totals_and_sorted_case_sensitive_keys",
        "adversarial_contracts::l05_empty_and_blank_are_distinct_borrowed_keys_not_missing_events",
        "adversarial_contracts::l06_never_converts_none_or_rejected_zero_into_an_accepted_reading",
        "adversarial_contracts::l06_permutations_preserve_zero_missing_rejected_and_signed_cancellation",
        "model_properties::model_differential_generated_aggregation_and_reordering",
        "model_properties::model_differential_generated_sensor_rules_and_reordering",
    ],
    "m09": [
        "adversarial_contracts::l05_exact_numeric_bounds_missing_fields_and_extra_delimiters",
        "adversarial_contracts::l05_first_error_stays_first_across_crlf_unicode_and_malformed_followups",
        "adversarial_contracts::l06_all_domain_variants_have_stable_exact_cli_and_http_contracts",
        "adversarial_contracts::l06_nested_error_chain_survives_multiple_public_presentations",
        "model_properties::model_differential_error_boundary_preserves_cause_without_public_leaks",
        "model_properties::model_differential_generated_config_grammar_and_first_failure",
        "model_properties::model_metamorphic_valid_field_order_blank_lines_and_limits",
    ],
}
EXPECTED_MUTANTS = {
    "m07": {
        "wrong_colon_separator", "split_at_last_delimiter", "drop_value_trimming",
        "trim_only_key_start", "erase_missing_delimiter_identity",
        "misclassify_empty_key_as_value", "replace_canonical_equals_with_colon",
        "trim_only_value_end", "trim_only_key_end", "swap_stored_key_and_value",
        "trim_only_value_start",
    },
    "m08": {
        "overwrite_aggregate_count", "overwrite_aggregate_bytes", "reverse_public_sort",
        "treat_rejected_as_present", "convert_none_to_accepted_zero", "overwrite_sensor_total",
        "skip_zero_byte_events", "discard_blank_service_keys",
        "merge_service_case_variants", "drop_rejected_only_sensors",
        "cap_service_bytes_at_1024", "ignore_negative_sensor_values",
    },
    "m09": {
        "misclassify_missing_delimiter", "allow_duplicate_with_invalid_value",
        "off_by_one_error_column", "lose_internal_source_chain",
        "leak_storage_error_in_display", "rewrite_request_id", "change_api_public_code",
        "skip_whitespace_only_lines", "accept_ascii_plus_prefix",
        "duplicate_empty_is_reported_as_invalid", "lose_large_timeout_support",
        "off_by_one_eof_line", "wrong_profile_http_status",
    },
}


EXPECTED_TARGETS = {
    "m07": {
        "wrong_colon_separator": "incompatible_delimiters_reject_even_with_other_punctuation",
        "split_at_last_delimiter": "colon_first_delimiter_unicode_and_trimmed_fields",
        "drop_value_trimming": "value_with_only_unicode_whitespace_is_not_present",
        "trim_only_key_start": "key_trailing_whitespace_is_trimmed_not_preserved",
        "erase_missing_delimiter_identity": "incompatible_delimiters_reject_even_with_other_punctuation",
        "misclassify_empty_key_as_value": "empty_key_has_priority_over_empty_value",
        "replace_canonical_equals_with_colon": "equals_first_delimiter_not_last_and_canonical_label",
        "trim_only_value_end": "generated_inputs_match_oracle_for_both_parsers",
        "trim_only_key_end": "generated_inputs_match_oracle_for_both_parsers",
        "swap_stored_key_and_value": "generated_inputs_match_oracle_for_both_parsers",
        "trim_only_value_start": "generated_inputs_match_oracle_for_both_parsers",
    },
    "m08": {
        "overwrite_aggregate_count": "adversarial_contracts::l05_all_permutations_preserve_counts_totals_and_sorted_case_sensitive_keys",
        "overwrite_aggregate_bytes": "adversarial_contracts::l05_all_permutations_preserve_counts_totals_and_sorted_case_sensitive_keys",
        "reverse_public_sort": "adversarial_contracts::l05_empty_and_blank_are_distinct_borrowed_keys_not_missing_events",
        "treat_rejected_as_present": "adversarial_contracts::l06_never_converts_none_or_rejected_zero_into_an_accepted_reading",
        "convert_none_to_accepted_zero": "adversarial_contracts::l06_never_converts_none_or_rejected_zero_into_an_accepted_reading",
        "overwrite_sensor_total": "adversarial_contracts::l06_permutations_preserve_zero_missing_rejected_and_signed_cancellation",
        "skip_zero_byte_events": "model_properties::model_differential_generated_aggregation_and_reordering",
        "discard_blank_service_keys": "model_properties::model_differential_generated_aggregation_and_reordering",
        "merge_service_case_variants": "model_properties::model_differential_generated_aggregation_and_reordering",
        "drop_rejected_only_sensors": "model_properties::model_differential_generated_sensor_rules_and_reordering",
        "cap_service_bytes_at_1024": "model_properties::model_differential_generated_aggregation_and_reordering",
        "ignore_negative_sensor_values": "model_properties::model_differential_generated_sensor_rules_and_reordering",
    },
    "m09": {
        "misclassify_missing_delimiter": "adversarial_contracts::l05_first_error_stays_first_across_crlf_unicode_and_malformed_followups",
        "allow_duplicate_with_invalid_value": "adversarial_contracts::l05_first_error_stays_first_across_crlf_unicode_and_malformed_followups",
        "off_by_one_error_column": "adversarial_contracts::l05_exact_numeric_bounds_missing_fields_and_extra_delimiters",
        "lose_internal_source_chain": "adversarial_contracts::l06_nested_error_chain_survives_multiple_public_presentations",
        "leak_storage_error_in_display": "adversarial_contracts::l06_nested_error_chain_survives_multiple_public_presentations",
        "rewrite_request_id": "adversarial_contracts::l06_nested_error_chain_survives_multiple_public_presentations",
        "change_api_public_code": "adversarial_contracts::l06_all_domain_variants_have_stable_exact_cli_and_http_contracts",
        "skip_whitespace_only_lines": "model_properties::model_differential_generated_config_grammar_and_first_failure",
        "accept_ascii_plus_prefix": "model_properties::model_differential_generated_config_grammar_and_first_failure",
        "duplicate_empty_is_reported_as_invalid": "model_properties::model_differential_generated_config_grammar_and_first_failure",
        "lose_large_timeout_support": "model_properties::model_metamorphic_valid_field_order_blank_lines_and_limits",
        "off_by_one_eof_line": "adversarial_contracts::l05_exact_numeric_bounds_missing_fields_and_extra_delimiters",
        "wrong_profile_http_status": "adversarial_contracts::l06_all_domain_variants_have_stable_exact_cli_and_http_contracts",
    },
}


EXPECTED_TRIAGE = {
    "entry_or_insert_with_pure_tuple": ("m08", "reviewed_equivalent", "passed"),
    "compound_addition_to_explicit_addition": ("m08", "reviewed_equivalent", "passed"),
    "explicit_boolean_comparison": ("m08", "reviewed_equivalent", "passed"),
    "empty_line_length_check": ("m09", "reviewed_equivalent", "passed"),
    "strict_ascii_bytes_via_slice": ("m09", "reviewed_equivalent", "passed"),
    "trim_whitespace_lines_is_not_equivalent": ("m09", "killed_non_equivalent", "failed"),
}


def load_triage(directory: Path) -> dict:
    file = directory / "equivalence-triage.json"
    if not file.is_file():
        raise AssertionError("missing equivalence triage evidence")
    payload = json.loads(file.read_text(encoding="utf8"))
    if payload.get("schema_version") != 1 or not isinstance(payload.get("candidates"), list):
        raise AssertionError("invalid equivalence triage document")
    found = {}
    for item in payload["candidates"]:
        name = item.get("name")
        if name in found or name not in EXPECTED_TRIAGE:
            raise AssertionError("unexpected or duplicate equivalence candidate")
        module, classification, outcome = EXPECTED_TRIAGE[name]
        if (item.get("module") != module or
                item.get("classification") != classification or
                item.get("full_suite") != outcome or
                item.get("compiles") is not True or
                not isinstance(item.get("reasoning"), str) or
                len(item["reasoning"]) < 40):
            raise AssertionError("invalid or unreviewed equivalence evidence for " + name)
        found[name] = item
    if found.keys() != EXPECTED_TRIAGE.keys():
        raise AssertionError("missing pinned equivalence triage candidates")
    return {
        "candidates": sorted(found.values(), key=lambda item: item["name"]),
        "reviewed_equivalent": sum(
            item["classification"] == "reviewed_equivalent" for item in found.values()),
        "killed_non_equivalent": sum(
            item["classification"] == "killed_non_equivalent" for item in found.values()),
        "excluded_from_selected_mutation_score": sorted(
            item["name"] for item in found.values()
            if item["classification"] == "reviewed_equivalent"
        ),
    }


def validate(directory: Path) -> dict:
    reports = {}
    evidence = []
    all_tests = []
    module_scores = []
    for module, expected in EXPECTED.items():
        path = directory / (module + ".json")
        if not path.is_file():
            raise AssertionError(f"{module}: missing independently executed mutation evidence")
        report = json.loads(path.read_text(encoding="utf8"))
        if (report.get("schema_version") != 1 or report.get("module") != module
                or report.get("baseline") != "passed"):
            raise AssertionError(f"{module}: invalid report identity or reference baseline")
        if (report.get("seed") != expected["seed"] or
                report.get("generated_cases") != expected["cases"]):
            raise AssertionError(f"{module}: changed reproducible generator parameters")
        if module == "m07":
            import re
            if not re.fullmatch(r"[0-9a-f]{64}", report.get("archive_sha256", "")):
                raise AssertionError("M07: missing or invalid original ZIP SHA-256")

        tests = report.get("tests")
        if (not isinstance(tests, list) or len(tests) != expected["tests"]
                or len(set(tests)) != len(tests)
                or any(not isinstance(t, str) or "::" not in t for t in tests)):
            raise AssertionError(f"{module}: missing, duplicated or malformed test catalog")
        tests = sorted(tests)
        if tests != EXPECTED_CATALOG[module]:
            raise AssertionError(f"{module}: pinned independent test identities changed")
        all_tests.extend(module + "::" + test for test in tests)

        mutants = report.get("mutants")
        if not isinstance(mutants, list) or len(mutants) != expected["count"]:
            raise AssertionError(f"{module}: missing mutation probes")
        names = set()
        covered = set()
        with_reduced_witness = 0
        for row in mutants:
            if not isinstance(row, dict):
                raise AssertionError(f"{module}: invalid mutation entry")
            name, target, hit = row.get("name"), row.get("target"), row.get("detected_by")
            if (not isinstance(name, str) or not name or name in names or
                    not isinstance(target, str) or target not in tests or
                    row.get("status") != "killed" or not isinstance(hit, list)
                    or not hit or len(hit) != len(set(hit))
                    or target not in hit or any(test not in tests for test in hit)):
                raise AssertionError(f"{module}: false, missing, or unmapped mutation evidence {row}")
            if name not in EXPECTED_TARGETS[module]:
                raise AssertionError(f"{module}: unrecognized selected mutation {name}")
            expected_target = EXPECTED_TARGETS[module][name]
            if module == "m07":
                expected_target = "adversarial_contracts::" + expected_target
            if target != expected_target:
                raise AssertionError(f"{module}: changed designated assertion for {name}")
            names.add(name)
            covered.update(hit)
            witness = row.get("counterexample")
            if witness is not None:
                if (not isinstance(witness, str) or
                        not witness.startswith("MINIMIZED_COUNTEREXAMPLE ") or
                        "minimal=" not in witness):
                    raise AssertionError(f"{module}: invalid reduced witness for {name}")
                with_reduced_witness += 1
            if ("generated_inputs_match_oracle" in target or
                    "model_differential_generated_" in target) and witness is None:
                raise AssertionError(f"{module}: seeded failure lacks reduced counterexample: {name}")
            evidence.append({"module": module, **row})
        if names != EXPECTED_MUTANTS[module]:
            raise AssertionError(f"{module}: missing or substituted selected mutations")
        module_scores.append({
            "module": module, "killed": len(mutants), "selected": len(mutants),
            "seed": report["seed"], "generated_cases": report["generated_cases"],
            "test_count": len(tests), "tests_detecting_selected_mutants": len(covered),
            "reduced_witnesses": with_reduced_witness,
        })
        reports[module] = {"tests": tests, "mutants": mutants, "covered": sorted(covered)}
    selected = sum(v["selected"] for v in module_scores)
    return {
        "schema_version": 3,
        "equivalence_triage": load_triage(directory),
        "scope": "enumerated compiling mutants and executed independent tests, not total code coverage",
        "killed": len(evidence),
        "selected": selected,
        "score_percent": round(100 * len(evidence) / selected, 2),
        "modules": module_scores,
        "test_catalog": all_tests,
        "evidence": evidence,
        "test_mutation_matrix": {
            module: {
                row["name"]: {
                    test: test in row["detected_by"] for test in content["tests"]
                }
                for row in content["mutants"]
            }
            for module, content in reports.items()
        },
    }


def export(directory: Path, summary: dict) -> str:
    tests = summary["test_catalog"]
    rows = []
    for item in summary["evidence"]:
        rows.append({
            "module": item["module"], "mutant": item["name"],
            "target": item["target"],
            "detected_by_count": len(item["detected_by"]),
            "minimized_counterexample": item.get("counterexample", ""),
            **{
                test: int(test.removeprefix(item["module"] + "::") in item["detected_by"])
                if test.startswith(item["module"] + "::") else 0
                for test in tests
            },
        })
    with (directory / "matrix.csv").open("w", encoding="utf8", newline="") as file:
        writer = csv.DictWriter(
            file, fieldnames=["module", "mutant", "target", "detected_by_count",
                               "minimized_counterexample", *tests])
        writer.writeheader()
        writer.writerows(rows)

    markdown = [
        "## M07–M09 mutation sensitivity and test × mutant matrix",
        "",
        "| Module | Killed / Selected | Executed independent tests | Tests detecting selected mutants | Reduced witnesses |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for score in summary["modules"]:
        markdown.append(
            f"| {score['module'].upper()} | {score['killed']}/{score['selected']} | "
            f"{score['test_count']} | {score['tests_detecting_selected_mutants']} | "
            f"{score['reduced_witnesses']} |"
        )
    eq = summary["equivalence_triage"]
    markdown.extend([
        "",
        f"**Reviewed-equivalent candidates excluded from denominator: {eq['reviewed_equivalent']}.** "
        f"Confirmed non-equivalent triage control: {eq['killed_non_equivalent']}.",
        "",
        f"**Selected mutation score: {summary['killed']}/{summary['selected']} "
        f"({summary['score_percent']}%).**",
        "",
        "Only compiled mutations that fail named assertions count as detected. "
        "Unchecked implementation space and undetected selected mutations are not hidden.",
        "",
        "### Per-module test × mutant matrix",
        "",
    ])
    for score in summary["modules"]:
        module = score["module"]
        tests_in_module = [t for t in tests if t.startswith(module + "::")]
        aliases = {test: "T" + str(i + 1) for i, test in enumerate(tests_in_module)}
        markdown.append(f"#### {module.upper()}")
        markdown.extend([
            "| Mutation | " + " | ".join(aliases.values()) + " |",
            "| --- | " + " | ".join("---:" for _ in tests_in_module) + " |",
        ])
        for row in (item for item in summary["evidence"] if item["module"] == module):
            detected = {module + "::" + name for name in row["detected_by"]}
            cells = ["✓" if test in detected else "·" for test in tests_in_module]
            markdown.append("| `" + row["name"] + "` | " + " | ".join(cells) + " |")
        markdown.append("")
        markdown.extend("- `" + aliases[test] + "`: `" + test.split("::", 1)[1] + "`"
                        for test in tests_in_module)
        markdown.append("")
    markdown.extend([
        "A blank cell means this independent test passed against that selected mutant, "
        "**not** that the test is useless. Reduced witnesses are one-element-deletion "
        "minimal, not proven globally shortest.",
        "",
    ])
    matrix_text = "\n".join(markdown)
    (directory / "matrix.md").write_text(matrix_text, encoding="utf8")
    (directory / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    return matrix_text


def main() -> None:
    directory = Path(os.environ.get("MUTATION_REPORT_DIR", "artifacts/mutation-report"))
    summary = validate(directory)
    matrix_text = export(directory, summary)
    print(matrix_text)
    github_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if github_summary:
        with Path(github_summary).open("a", encoding="utf8") as handle:
            handle.write(matrix_text)


if __name__ == "__main__":
    main()
