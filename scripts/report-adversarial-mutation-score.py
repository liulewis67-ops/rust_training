#!/usr/bin/env python3
"""Fail-closed evidence report for the *selected*, compiling Rust mutants.

The percentage is mutation sensitivity for the explicitly enumerated mutants.
It is NOT statement/branch coverage and not a claim to reject every bad program.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

# Any removal or silent omission of a known probe is a CI regression.
EXPECTED = {
    "m07": {"count": 10, "cases": 448, "seed": "0x7AB1202610300007"},
    "m08": {"count": 10, "cases": 320, "seed": "0xC0FF_EE08_2026_1030"},
    "m09": {"count": 11, "cases": 384, "seed": "0xC0FF_EE09_2026_1030"},
}


def main() -> None:
    directory = Path(os.environ.get("MUTATION_REPORT_DIR", "artifacts/mutation-report"))
    total = killed = 0
    scores: list[dict] = []
    evidence: list[dict] = []
    for module, expected in EXPECTED.items():
        path = directory / (module + ".json")
        if not path.is_file():
            raise AssertionError(f"{module}: missing independently executed mutation evidence")
        report = json.loads(path.read_text(encoding="utf8"))
        if (report.get("schema_version") != 1 or report.get("module") != module
                or report.get("baseline") != "passed"):
            raise AssertionError(f"{module}: invalid report identity/baseline")
        for field, source in (("generated_cases", "cases"), ("seed", "seed")):
            if report.get(field) != expected[source]:
                raise AssertionError(f"{module}: changed deterministic property generator {field}")
        if module == "m07" and len(report.get("archive_sha256", "")) != 64:
            raise AssertionError("m07: released ZIP digest missing")

        mutants = report.get("mutants")
        if not isinstance(mutants, list) or len(mutants) != expected["count"]:
            raise AssertionError(
                f"{module}: missing mutant probes (expected {expected['count']})"
            )
        names = set()
        for item in mutants:
            name = item.get("name")
            target = item.get("target")
            if (not isinstance(name, str) or not name or name in names or
                    not isinstance(target, str) or not target or
                    item.get("status") != "killed"):
                raise AssertionError(f"{module}: invalid or surviving mutation: {item}")
            names.add(name)
            evidence.append({"module": module, **item})

        total += len(mutants)
        killed += sum(item["status"] == "killed" for item in mutants)
        scores.append({
            "module": module,
            "killed": len(mutants),
            "selected": len(mutants),
            "score_percent": 100.0,
            "seed": report["seed"],
            "generated_cases": report["generated_cases"],
        })

    if killed != total:
        raise AssertionError(f"unexpected surviving selected mutants: {killed}/{total}")
    summary = {
        "schema_version": 1,
        "scope": "enumerated compiling mutations, not global Rust code coverage",
        "killed": killed,
        "selected": total,
        "score_percent": round(100 * killed / total, 2),
        "modules": scores,
        "evidence": evidence,
    }
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf8"
    )
    markdown = [
        "## M07–M09 adversarial sensitivity (selected mutants)",
        "",
        "| Lesson | Killed / Selected | Fixed-seed generated inputs | Seed |",
        "| --- | ---: | ---: | --- |",
    ]
    for row in scores:
        markdown.append(
            f"| {row['module'].upper()} | {row['killed']}/{row['selected']} | "
            f"{row['generated_cases']} | \`{row['seed']}\` |"
        )
    markdown.extend([
        "",
        f"**Selected mutation score: {killed}/{total} ({summary['score_percent']}%).**",
        "",
        "Only mutants that compile and fail a *named* independent test count as killed. "
        "This is not coverage of all possible incorrect implementations.",
        "",
    ])
    report_text = "\n".join(markdown)
    print(report_text)
    github_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if github_summary:
        with Path(github_summary).open("a", encoding="utf8") as handle:
            handle.write(report_text)


if __name__ == "__main__":
    main()
