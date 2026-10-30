#!/usr/bin/env python3
"""Kill independently chosen incorrect fixes in the *released* M07-L05 ZIP.

No re-created classroom API, no changes to the published binary, and no
reference capstone substituted for the original starter.
"""
from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "zip_audit", ROOT / "scripts" / "verify-starter-zips.py"
)
if spec is None or spec.loader is None:
    raise RuntimeError("cannot import released ZIP checker")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

# These tests are inserted into a *temporary extracted copy* of the actual
# released Cargo library, allowing us to inspect even its private behavior
# without shipping a second, subtly different replacement library.
EXTERNAL_CONTRACTS = r"""
#[cfg(test)]
mod adversarial_contracts {
    use super::*;

    #[test]
    fn colon_first_delimiter_unicode_and_trimmed_fields() {
        assert_eq!(
            ColonParser.parse("  中文  :  值:two:三  "),
            Ok(Entry { key: "中文".into(), value: "值:two:三".into() }),
        );
        assert_eq!(
            render_label(&ColonParser, "  env  :  stable:next  "),
            Ok("env=stable:next".into()),
        );
    }

    #[test]
    fn equals_first_delimiter_not_last_and_canonical_label() {
        assert_eq!(
            EqualsParser.parse(" x = a=b=c "),
            Ok(Entry { key: "x".into(), value: "a=b=c".into() }),
        );
        assert_eq!(render_label(&EqualsParser, " x = 1=2 "), Ok("x=1=2".into()));
        assert_eq!(render_label(&ColonParser, "x:y"), Ok("x=y".into()));
    }

    #[test]
    fn incompatible_delimiters_reject_even_with_other_punctuation() {
        assert_eq!(ColonParser.parse("x=y"), Err(ParseError::MissingDelimiter(':')));
        assert_eq!(ColonParser.parse(""), Err(ParseError::MissingDelimiter(':')));
        assert_eq!(EqualsParser.parse("x:y"), Err(ParseError::MissingDelimiter('=')));
        assert_eq!(EqualsParser.parse(""), Err(ParseError::MissingDelimiter('=')));
    }

    #[test]
    fn empty_key_has_priority_over_empty_value() {
        assert_eq!(ColonParser.parse("  :  "), Err(ParseError::EmptyKey));
        assert_eq!(EqualsParser.parse(" =x"), Err(ParseError::EmptyKey));
        assert_eq!(ColonParser.parse(":x"), Err(ParseError::EmptyKey));
    }

    #[test]
    fn value_with_only_unicode_whitespace_is_not_present() {
        assert_eq!(ColonParser.parse("x:\u{3000}\t"), Err(ParseError::EmptyValue));
        assert_eq!(EqualsParser.parse("x=  "), Err(ParseError::EmptyValue));
        assert_eq!(ColonParser.parse("x:"), Err(ParseError::EmptyValue));
    }

    #[test]
    fn key_trailing_whitespace_is_trimmed_not_preserved() {
        assert_eq!(
            ColonParser.parse("  key \t:ok"),
            Ok(Entry { key: "key".into(), value: "ok".into() }),
        );
        assert_eq!(
            EqualsParser.parse("  key \t=ok"),
            Ok(Entry { key: "key".into(), value: "ok".into() }),
        );
    }
}
"""

# Name, exact original span, compiling wrong replacement, targeted public
# acceptance assertion. A vacuous test or a compile error NEVER kills a mutant.
MUTANTS = [
    (
        "wrong_colon_separator",
        "parse_delimited(input, ':')", "parse_delimited(input, '=')",
        "incompatible_delimiters_reject_even_with_other_punctuation",
    ),
    (
        "split_at_last_delimiter",
        ".split_once(delimiter)", ".rsplit_once(delimiter)",
        "colon_first_delimiter_unicode_and_trimmed_fields",
    ),
    (
        "drop_value_trimming",
        "let value = value.trim();", "let value = value;",
        "value_with_only_unicode_whitespace_is_not_present",
    ),
    (
        "trim_only_key_start",
        "let key = key.trim();", "let key = key.trim_start();",
        "key_trailing_whitespace_is_trimmed_not_preserved",
    ),
    (
        "erase_missing_delimiter_identity",
        "MissingDelimiter(delimiter)", "MissingDelimiter('=')",
        "incompatible_delimiters_reject_even_with_other_punctuation",
    ),
    (
        "misclassify_empty_key_as_value",
        "return Err(ParseError::EmptyKey);", "return Err(ParseError::EmptyValue);",
        "empty_key_has_priority_over_empty_value",
    ),
    (
        "replace_canonical_equals_with_colon",
        'Ok(format!("{}={}", entry.key, entry.value))',
        'Ok(format!("{}:{}", entry.key, entry.value))',
        "equals_first_delimiter_not_last_and_canonical_label",
    ),
]


def main() -> None:
    released = audit.RELEASES / "m07-l05-starter.zip"
    original_digest = hashlib.sha256(released.read_bytes()).hexdigest()
    with tempfile.TemporaryDirectory(prefix="m07-zip-adversarial-") as tmp:
        root = Path(tmp)
        with zipfile.ZipFile(released) as archive:
            entries = audit.safe_members(archive)
            archive.extractall(root)
        projects = list(root.rglob("Cargo.toml"))
        if len(projects) != 1:
            raise AssertionError("published M07 ZIP must contain one Cargo project")
        project = projects[0].parent
        audit.check_manifest(
            "m07", project, [entry.filename for entry in entries if not entry.is_dir()]
        )
        library = project / "src" / "lib.rs"
        starter = library.read_text(encoding="utf8")

        # The actual exercise must start with its intentionally failing behavior.
        code, out = audit.run_cargo(project, "test", root)
        if code == 0 or "test result: FAILED" not in out:
            raise AssertionError("original published starter no longer fails as an exercise")

        repaired = audit.full_repair("m07", audit.type_repair("m07", starter))
        baseline = repaired + "\n" + EXTERNAL_CONTRACTS
        library.write_text(baseline, encoding="utf8")
        code, out = audit.run_cargo(project, "test", root)
        if code != 0 or "test result: ok." not in out:
            raise AssertionError("real repaired ZIP fails independent contracts:\n" + out[-4000:])
        print("m07: original ZIP repaired; six external behavioral contracts pass")

        for name, old, wrong, case in MUTANTS:
            mutant = audit.replace_once(baseline, old, wrong, name)
            library.write_text(mutant, encoding="utf8")
            code, out = audit.run_cargo(project, "test", root)
            if code == 0 or "test result: FAILED" not in out:
                raise AssertionError(name + ": accepted an incorrect implementation:\n" + out[-3000:])
            if "could not compile" in out or "error[" in out:
                raise AssertionError(name + ": compile failure is not a valid mutation kill:\n" + out[-3000:])
            if not any(
                "adversarial_contracts::" + case + " ... FAILED" in line
                for line in out.splitlines()
            ):
                raise AssertionError(name + ": targeted independent assertion did not fail:\n" + out[-3000:])
            print("m07: KILLED " + name + " via " + case)

        library.write_text(baseline, encoding="utf8")
        code, out = audit.run_cargo(project, "test", root)
        if code != 0:
            raise AssertionError("restored real ZIP must remain green:\n" + out[-3000:])

    if hashlib.sha256(released.read_bytes()).hexdigest() != original_digest:
        raise AssertionError("published starter archive was modified")
    print("M07 original ZIP: 7/7 compiling mutants killed; archive unchanged.")


if __name__ == "__main__":
    main()
