#!/usr/bin/env python3
"""Audit released Rust starter ZIPs in clean temporary directories.

This verifier never rewrites the published ZIP or treats an expected compiler
error as success in the student's completed solution.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "content" / "releases"
LABS = {
    "m01": "E0308",
    "m02": "E0308",
    "m03": "E0308",
    "m04": "E0382",
    "m05": "E0106",
    "m06": "E0308",
    "m07": "behavior",
}
INSPECT = os.environ.get("INSPECT_ZIPS") == "1"


def safe_members(archive: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
    members = archive.infolist()
    names = [info.filename for info in members]
    if len(names) != len(set(names)):
        raise AssertionError("duplicate ZIP entries")
    if len(members) > 120:
        raise AssertionError("unexpectedly large ZIP member count")
    total = 0
    for info in members:
        raw = info.filename
        path = PurePosixPath(raw)
        if (
            not raw
            or raw.startswith("/")
            or "\\" in raw
            or path.is_absolute()
            or ".." in path.parts
            or any(":" in p for p in path.parts)
        ):
            raise AssertionError("invalid ZIP path: " + raw)
        if info.flag_bits & 0x1:
            raise AssertionError("encrypted ZIP member: " + raw)
        if stat.S_IFMT(info.external_attr >> 16) == stat.S_IFLNK:
            raise AssertionError("symbolic links not allowed: " + raw)
        total += info.file_size
    if total > 8 * 1024 * 1024:
        raise AssertionError("starter uncompressed size unexpectedly large")
    broken = archive.testzip()
    if broken:
        raise AssertionError("ZIP CRC mismatch: " + broken)
    return members


def run_cargo(project: Path, action: str, temporary: Path) -> tuple[int, str]:
    result = subprocess.run(
        ["cargo", action, "--offline", "--manifest-path", str(project / "Cargo.toml")],
        cwd=project,
        env={**os.environ, "CARGO_TARGET_DIR": str(temporary / "target")},
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=120,
        check=False,
    )
    return result.returncode, result.stdout



def check_manifest(module: str, project: Path, member_names: list[str]) -> None:
    path = project / "starter-manifest.json"
    if module == "m01":
        # The first workshop predates the reproducible starter manifest convention.
        if path.exists():
            raise AssertionError("unexpected M01 manifest; update expectations")
        return
    if not path.is_file():
        raise AssertionError(module + ": starter-manifest.json is required")
    manifest = json.loads(path.read_text(encoding="utf8"))
    if manifest.get("schema_version") != "1.0.0":
        raise AssertionError(module + ": unexpected manifest schema")
    if manifest.get("course_unit") != module.upper() + "-L05":
        raise AssertionError(module + ": wrong course_unit in manifest")
    if manifest.get("version", manifest.get("starter_version")) != "0.1.0":
        raise AssertionError(module + ": wrong starter version")
    records = manifest.get("files")
    if not isinstance(records, list):
        raise AssertionError(module + ": missing file hash inventory")
    expected = set(member_names) - {"starter-manifest.json"}
    actual = set()
    for record in records:
        relative_name = record.get("path")
        digest = record.get("sha256")
        if not isinstance(relative_name, str) or relative_name not in expected:
            raise AssertionError(module + ": unexpected file in hash manifest")
        if relative_name in actual:
            raise AssertionError(module + ": duplicate hash manifest entry")
        if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
            raise AssertionError(module + ": invalid sha256 value")
        actual.add(relative_name)
        computed = hashlib.sha256((project / relative_name).read_bytes()).hexdigest()
        if computed != digest:
            raise AssertionError(module + ": checksum mismatch for " + relative_name)
    if expected != actual:
        raise AssertionError(module + ": manifest file list is not complete")
    print(module + ": ZIP SHA-256 inventory verified (" + str(len(actual)) + " files)")


def replace_once(source: str, old: str, new: str, description: str) -> str:
    if source.count(old) != 1:
        raise AssertionError(description + ": expected exactly one source location")
    return source.replace(old, new, 1)


def type_repair(module: str, source: str) -> str:
    if module == "m01":
        return replace_once(
            source, "let percent: i64 = discount_percent;",
            "let percent: i64 = i64::from(discount_percent);", module
        )
    if module == "m02":
        # A deliberately incomplete first repair, to expose behavioral errors.
        return replace_once(
            source, "let minutes: u64 = input;",
            "let minutes: u64 = input.parse().unwrap_or(0);", module
        )
    if module == "m03":
        for variant in ("Todo", "Doing", "Done"):
            source = replace_once(
                source, "=> TaskStatus::" + variant + ",",
                "=> Some(TaskStatus::" + variant + "),", module
            )
        return source
    return source


def full_repair(module: str, source: str) -> str:
    if module == "m01":
        return replace_once(source, "percent / 10;", "percent / 100;", module)
    if module == "m02":
        source = replace_once(
            source, "let minutes: u64 = input.parse().unwrap_or(0);",
            'if input.is_empty() || !input.bytes().all(|b| b.is_ascii_digit()) {\n'
            '        return Err("invalid minutes");\n'
            '    }\n'
            '    let minutes: u64 = input.parse().map_err(|_| "invalid minutes")?;',
            module
        )
        return replace_once(
            source, "let seconds = minutes * 60;",
            'let seconds = minutes.checked_mul(60).ok_or("seconds overflow")?;',
            module
        )
    if module == "m03":
        return replace_once(
            source, "let _ = id;\n        None",
            "self.tasks.iter().find(|task| task.id == id)",
            module
        )
    if module == "m04":
        return replace_once(source, "add_badge(source)", "add_badge(source.clone())", module)
    if module == "m05":
        return replace_once(
            source,
            "pub fn find_token(text: &str, query: &str) -> Option<&str>",
            "pub fn find_token<'text>(text: &'text str, query: &str) -> Option<&'text str>",
            module
        )
    if module == "m06":
        source = replace_once(source, "key: view.key,", "key: view.key.to_owned(),", module)
        return replace_once(source, "value: view.value,", "value: view.value.to_owned(),", module)
    if module == "m07":
        return replace_once(
            source,
            "parse_delimited(input, '=')\n    }\n}\n\n/// Splits at the first delimiter",
            "parse_delimited(input, ':')\n    }\n}\n\n/// Splits at the first delimiter",
            module
        )
    raise AssertionError("unexpected module " + module)


def check_repair_path(module: str, project: Path, temp: Path) -> None:
    source_path = project / "src" / "lib.rs"
    original = source_path.read_text(encoding="utf8")
    staged = type_repair(module, original)
    if module in {"m01", "m02", "m03"}:
        source_path.write_text(staged, encoding="utf8")
        check_code, _ = run_cargo(project, "check", temp)
        if check_code != 0:
            raise AssertionError(module + ": isolated type repair must compile")
        test_code, test_output = run_cargo(project, "test", temp)
        if test_code == 0 or "test result: FAILED" not in test_output:
            raise AssertionError(
                module + ": isolated type repair must expose behavioral errors:\n"
                + test_output[-2600:]
            )
        print(module + ": compiler repair exposes real failing behavior assertions")
    fixed = full_repair(module, staged)
    source_path.write_text(fixed, encoding="utf8")
    result, output = run_cargo(project, "test", temp)
    if result != 0 or "test result: ok." not in output:
        raise AssertionError(
            module + ": a cleanly repaired archive must pass the original public tests:\n"
            + output[-3800:]
        )
    print(module + ": minimal repair passes original public tests")

def audit_one(module: str, expected: str, temp: Path) -> None:
    archive_path = RELEASES / (module + "-l05-starter.zip")
    if not archive_path.is_file():
        raise AssertionError("missing starter ZIP: " + str(archive_path))
    for lang in ["", "en/"]:
        lesson = RELEASES / lang / (module + "-l05.md")
        markdown = lesson.read_text(encoding="utf8")
        expected_link = "./" + archive_path.name
        if "(" + expected_link + ")" not in markdown:
            raise AssertionError(str(lesson) + " lacks matching relative ZIP link")
        if "./public/" in markdown:
            raise AssertionError(str(lesson) + " links to obsolete public/ path")

    extracted = temp / module
    extracted.mkdir()
    with zipfile.ZipFile(archive_path) as archive:
        entries = safe_members(archive)
        archive.extractall(extracted)
        if INSPECT:
            print(module + " ZIP entries: " + repr([x.filename for x in entries]))

    tomls = list(extracted.rglob("Cargo.toml"))
    if len(tomls) != 1:
        raise AssertionError(module + " must contain exactly one Cargo.toml")
    project = tomls[0].parent
    if not (project / "src" / "lib.rs").exists():
        raise AssertionError(module + " missing src/lib.rs")
    check_manifest(module, project, [entry.filename for entry in entries if not entry.is_dir()])
    manifest_files = list(project.rglob("starter-manifest.json"))
    if INSPECT:
        for mf in manifest_files:
            print(module + " starter-manifest.json: " + mf.read_text(encoding="utf8")[:2000])
        print(module + " Cargo.toml: " + (project / "Cargo.toml").read_text(encoding="utf8")[:500])
        print(module + " src/lib.rs: " + (project / "src/lib.rs").read_text(encoding="utf8")[:6500])

    code, output = run_cargo(project, "check" if expected != "behavior" else "test", temp)
    errors = set(re.findall(r"error\[([A-Z]\d+)\]", output))
    if expected == "behavior":
        if code == 0 or "test result: FAILED" not in output:
            raise AssertionError(module + " expected the starter to compile but fail public behavior tests:\n" + output[-2500:])
    elif code == 0 or expected not in errors:
        raise AssertionError(module + " expected compiler error " + expected + ", got " + repr(errors) + ":\n" + output[-2500:])
    print(module + ": original intentional " + expected + " failure reproduced")
    check_repair_path(module, project, temp)



def audit_reference_project(temp: Path) -> None:
    archive_path = RELEASES / "m01-l06-reference.zip"
    for lang in ["", "en/"]:
        lesson = RELEASES / lang / "m01-l06.md"
        if "(./m01-l06-reference.zip)" not in lesson.read_text(encoding="utf8"):
            raise AssertionError(str(lesson) + " lacks the M01-L06 reference download")
    extracted = temp / "m01-l06-reference"
    extracted.mkdir()
    with zipfile.ZipFile(archive_path) as archive:
        safe_members(archive)
        archive.extractall(extracted)
    tomls = list(extracted.rglob("Cargo.toml"))
    if len(tomls) != 1:
        raise AssertionError("M01-L06 reference must contain exactly one Cargo manifest")
    project = tomls[0].parent
    for source in ["src/lib.rs", "src/main.rs"]:
        if not (project / source).is_file():
            raise AssertionError("M01-L06 reference missing " + source)
    code, output = run_cargo(project, "test", temp)
    if code != 0 or "test result: ok." not in output:
        raise AssertionError("M01-L06 reference must pass its published tests:\n" + output[-2800:])
    code, output = run_cargo(project, "run", temp)
    if code != 0 or "12.34" not in output:
        raise AssertionError("M01-L06 reference CLI must print its expected sample:\n" + output[-2800:])
    print("m01-l06: reference ZIP passes Cargo tests and CLI execution")



def main() -> None:
    if shutil.which("cargo") is None:
        raise RuntimeError("cargo must be installed to test released starter ZIPs")
    with tempfile.TemporaryDirectory(prefix="rust-zip-audit-") as dirname:
        temp = Path(dirname)
        for module, expected in LABS.items():
            audit_one(module, expected, temp)
        audit_reference_project(temp)
    print("All seven released L05 starter archives: integrity, initial failure, staged repair and public tests verified.")


if __name__ == "__main__":
    main()
