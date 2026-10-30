#!/usr/bin/env python3
"""Negative tests: the mutation matrix must reject dishonest or incomplete data."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "mutation_report", ROOT / "scripts" / "report-adversarial-mutation-score.py"
)
if spec is None or spec.loader is None:
    raise RuntimeError("cannot load mutation report validator")
reporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reporter)


def fixture() -> dict:
    evidence = {}
    for module, spec in reporter.EXPECTED.items():
        mutants = []
        for name in sorted(reporter.EXPECTED_MUTANTS[module]):
            target = reporter.EXPECTED_TARGETS[module][name]
            if module == "m07":
                target = "adversarial_contracts::" + target
            mutant = {
                "name": name,
                "target": target,
                "status": "killed",
                "detected_by": [target],
            }
            if ("generated_inputs_match_oracle" in target or
                    "model_differential_generated_" in target):
                mutant["counterexample"] = "MINIMIZED_COUNTEREXAMPLE synthetic minimal=sample"
            mutants.append(mutant)
        payload = {
            "schema_version": 1,
            "module": module,
            "reference": "synthetic negative-testing fixture",
            "baseline": "passed",
            "seed": spec["seed"],
            "generated_cases": spec["cases"],
            "tests": list(reporter.EXPECTED_CATALOG[module]),
            "mutants": mutants,
        }
        if module == "m07":
            payload["archive_sha256"] = "a" * 64
        evidence[module] = payload
    return evidence


class StrictEvidenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="mutation-evidence-negative-")
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.records = fixture()

    def validate(self, records: dict | None = None) -> dict:
        for module, payload in (records or self.records).items():
            (self.folder / (module + ".json")).write_text(
                json.dumps(payload, ensure_ascii=False), encoding="utf8"
            )
        triage = {"schema_version": 1, "candidates": [
            {
                "name": name, "module": module, "classification": classification,
                "full_suite": status, "compiles": True,
                "reasoning": "Synthetic reasoning recorded to verify that the report is fail-closed and must not silently ignore reviewed candidates.",
            }
            for name, (module, classification, status)
            in reporter.EXPECTED_TRIAGE.items()
        ]}
        (self.folder / "equivalence-triage.json").write_text(
            json.dumps(triage, ensure_ascii=False), encoding="utf8"
        )
        return reporter.validate(self.folder)

    def test_complete_known_fixture_exports_full_rectangular_matrix(self) -> None:
        summary = self.validate()
        self.assertEqual(summary["selected"], 36)
        self.assertEqual(len(summary["test_catalog"]), 20)
        self.assertEqual(summary["score_percent"], 100.0)
        reporter.export(self.folder, summary)
        csv = (self.folder / "matrix.csv").read_text(encoding="utf8")
        self.assertIn("minimized_counterexample", csv)
        self.assertIn("wrong_colon_separator", csv)
        self.assertIn("lose_large_timeout_support", csv)
        self.assertIn("Per-module test", (self.folder / "matrix.md").read_text(encoding="utf8"))

    def test_missing_or_forged_test_rejected(self) -> None:
        self.records["m08"]["tests"][0] = "adversarial_contracts::forged"
        with self.assertRaisesRegex(AssertionError, "pinned independent test"):
            self.validate()

    def test_missing_mutant_rejected(self) -> None:
        self.records["m09"]["mutants"].pop()
        with self.assertRaisesRegex(AssertionError, "missing mutation probes"):
            self.validate()

    def test_substituted_mutant_rejected(self) -> None:
        self.records["m07"]["mutants"][0]["name"] = "fake"
        with self.assertRaises(AssertionError):
            self.validate()

    def test_changed_designated_target_rejected(self) -> None:
        item = next(x for x in self.records["m08"]["mutants"]
                    if x["name"] == "overwrite_aggregate_count")
        item["target"] = "model_properties::model_differential_generated_aggregation_and_reordering"
        item["detected_by"] = [item["target"]]
        item["counterexample"] = "MINIMIZED_COUNTEREXAMPLE synthetic minimal=sample"
        with self.assertRaisesRegex(AssertionError, "changed designated assertion"):
            self.validate()

    def test_target_passed_even_if_unrelated_test_failed_is_not_a_kill(self) -> None:
        item = self.records["m09"]["mutants"][0]
        item["detected_by"] = ["adversarial_contracts::l05_exact_numeric_bounds_missing_fields_and_extra_delimiters"]
        if item["target"] == item["detected_by"][0]:
            item["detected_by"] = ["model_properties::model_metamorphic_valid_field_order_blank_lines_and_limits"]
        with self.assertRaisesRegex(AssertionError, "unmapped mutation evidence"):
            self.validate()

    def test_missing_reduced_witness_rejected_for_generated_failure(self) -> None:
        candidate = next(item for item in self.records["m07"]["mutants"]
                         if "generated_inputs_match_oracle" in item["target"])
        del candidate["counterexample"]
        with self.assertRaisesRegex(AssertionError, "lacks reduced counterexample"):
            self.validate()

    def test_missing_equivalence_triage_rejected(self) -> None:
        self.validate()
        (self.folder / "equivalence-triage.json").unlink()
        with self.assertRaisesRegex(AssertionError, "missing equivalence triage"):
            reporter.validate(self.folder)

    def test_forged_equivalence_review_rejected(self) -> None:
        self.validate()
        file = self.folder / "equivalence-triage.json"
        data = json.loads(file.read_text(encoding="utf8"))
        item = next(item for item in data["candidates"]
                    if item["classification"] == "killed_non_equivalent")
        item["classification"] = "reviewed_equivalent"
        item["full_suite"] = "passed"
        file.write_text(json.dumps(data), encoding="utf8")
        with self.assertRaisesRegex(AssertionError, "invalid or unreviewed equivalence"):
            reporter.validate(self.folder)

    def test_invalid_zip_digest_rejected(self) -> None:
        self.records["m07"]["archive_sha256"] = "not-a-digest"
        with self.assertRaisesRegex(AssertionError, "SHA-256"):
            self.validate()


if __name__ == "__main__":
    unittest.main()
