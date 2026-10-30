#!/usr/bin/env python3
"""Prove that contract tests reject plausible but incorrect Rust implementations.

Every mutation is introduced in a temporary copy, must compile, and must fail
the targeted contract test. The checked-in examples are never altered.
"""
from __future__ import annotations

from pathlib import Path
import os
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / "content" / "samples" / "verified-lesson-drills"
# (source, original expression, incorrect-but-compilable expression, lesson)
MUTATIONS = [
    ("m01", "subtotal_cents - subtotal_cents * i64::from(discount_percent) / 100",
     "subtotal_cents", "l05_"),
    ("m02", "base.checked_add(adjustment).ok_or(\"sum overflow\")",
     "Ok(base.saturating_add(adjustment))", "l06_"),
    ("m03", 'None => "not found",', 'None => "claim",', "l06_"),
    ("m04", "let bytes = source.len();", "let bytes = 0;", "l06_"),
    ("m05", "if separator.is_empty() { return None; }",
     'if separator.is_empty() { return Some((text, "")); }', "l06_"),
    ("m06", "Cow::Borrowed(rest)", "Cow::Owned(rest.to_owned())", "l06_"),
    ("m07", "for gate in gates { gate.evaluate(b)?; }",
     "for gate in gates { let _ = gate.evaluate(b); }", "l06_"),
    ("m08", "entry.0 += 1;", "entry.0 = 1;", "l05_"),
    ("m09", 'retryable: true, request_id: request_id.into()',
     'retryable: false, request_id: request_id.into()', "l06_"),
]


def run_test(project: Path, filter_name: str, target: Path) -> tuple[int, str]:
    result = subprocess.run(
        ["cargo", "test", "--offline", "--lib", "--manifest-path",
         str(project / "Cargo.toml"), filter_name],
        cwd=project,
        env={**os.environ, "CARGO_TARGET_DIR": str(target)},
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=120,
        check=False,
    )
    return result.returncode, result.stdout


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="rust-mutation-check-") as dirname:
        temp = Path(dirname)
        project = temp / "verified-lesson-drills"
        shutil.copytree(ORIGINAL, project, ignore=shutil.ignore_patterns("target"))
        target = temp / "target"
        for module, original, mutant, lesson in MUTATIONS:
            source = project / "src" / (module + "_capstone.rs")
            content = source.read_text(encoding="utf8")
            if content.count(original) != 1:
                raise AssertionError(
                    module + ": mutation precondition changed; inspect the Rust source"
                )
            source.write_text(content.replace(original, mutant, 1), encoding="utf8")
            name = module + "_capstone::tests::" + lesson
            try:
                code, output = run_test(project, name, target)
                if code == 0 or "test result: FAILED" not in output:
                    raise AssertionError(
                        module + ": wrong implementation was not detected by contract tests:\n"
                        + output[-3000:]
                    )
                if "error[" in output or "could not compile" in output:
                    raise AssertionError(
                        module + ": mutation must produce a behavioral test failure, not "
                        "a compiler error:\n" + output[-3000:]
                    )
                if "FAILED" not in output:
                    raise AssertionError(module + ": missing explicit failed assertion")
                print(module + ": behavior mutation rejected by " + name)
            finally:
                source.write_text(content, encoding="utf8")
        code, output = run_test(project, "", target)
        if code != 0 or "test result: ok." not in output:
            raise AssertionError(
                "restored unmodified reference failed its test suite:\n" + output[-3000:]
            )
        print("Original unmodified Rust contract suite also passes.")


if __name__ == "__main__":
    main()
