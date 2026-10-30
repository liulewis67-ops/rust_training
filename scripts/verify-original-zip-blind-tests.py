#!/usr/bin/env python3
"""Blind-test repaired *published ZIP starter* code, not companion capstones.

Temporarily repair the real M01-M07 starter ZIP, inject a compiling business
defect, and require its own unchanged public tests to catch the defect.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "starter_audit", ROOT / "scripts" / "verify-starter-zips.py"
)
if spec is None or spec.loader is None:
    raise RuntimeError("cannot load starter ZIP verification")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

# One localized, plausible wrong implementation per *actual released ZIP*.
# Both the initially repaired state and each mutated state must compile.
MUTATIONS = {
    "m01": (
        "let discount_cents = subtotal_cents * percent / 100;",
        "let discount_cents = subtotal_cents * percent / 10;",
    ),
    "m02": (
        'let seconds = minutes.checked_mul(60).ok_or("seconds overflow")?;',
        'let seconds = minutes.checked_mul(59).ok_or("seconds overflow")?;',
    ),
    "m03": (
        "self.tasks.iter().find(|task| task.id == id)",
        "self.tasks.iter().find(|task| task.id != id)",
    ),
    "m04": (
        "text.push('.');",
        "text.push('!');",
    ),
    "m05": (
        "text.split_whitespace().find(|token| *token == query)",
        "text.split_whitespace().find(|token| *token != query)",
    ),
    "m06": (
        "key: view.key.to_owned(),",
        "key: view.value.to_owned(),",
    ),
    "m07": (
        "parse_delimited(input, ':')",
        "parse_delimited(input, '=')",
    ),
}


def test_one(module: str, temporary: Path) -> None:
    extracted = temporary / module
    extracted.mkdir()
    path = audit.RELEASES / (module + "-l05-starter.zip")
    with zipfile.ZipFile(path) as archive:
        audit.safe_members(archive)
        archive.extractall(extracted)
    tomls = list(extracted.rglob("Cargo.toml"))
    if len(tomls) != 1:
        raise AssertionError(module + ": expected exactly one Cargo manifest")
    project = tomls[0].parent
    source_path = project / "src" / "lib.rs"
    original = source_path.read_text(encoding="utf8")
    fixed = audit.full_repair(module, audit.type_repair(module, original))
    source_path.write_text(fixed, encoding="utf8")
    if module == "m07":
        print("M07_REPAIRED_SOURCE_BEGIN\\n" + fixed + "\\nM07_REPAIRED_SOURCE_END", flush=True)

    code, output = audit.run_cargo(project, "test", temporary)
    if code != 0 or "test result: ok." not in output:
        raise AssertionError(module + ": repaired baseline is not green:\n" + output[-2500:])

    old, wrong = MUTATIONS[module]
    changed = audit.replace_once(fixed, old, wrong, module + " mutation")
    source_path.write_text(changed, encoding="utf8")
    try:
        code, output = audit.run_cargo(project, "check", temporary)
        if code != 0:
            raise AssertionError(
                module + ": a blind-test mutation must compile before testing:\n"
                + output[-2500:]
            )
        code, output = audit.run_cargo(project, "test", temporary)
        if code == 0 or "test result: FAILED" not in output:
            raise AssertionError(
                module + ": original public tests failed to catch wrong behavior:\n"
                + output[-3000:]
            )
        if "could not compile" in output:
            raise AssertionError(module + ": not a valid behavioral mutation")
        print(module + ": original ZIP public tests reject a compiling wrong fix")
    finally:
        source_path.write_text(fixed, encoding="utf8")


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="rust-original-blind-") as name:
        temporary = Path(name)
        for module in MUTATIONS:
            test_one(module, temporary)
    print("Seven independently repaired published starter ZIPs reject wrong solutions.")


if __name__ == "__main__":
    main()
