#!/usr/bin/env python3
"""Audit released Rust starter ZIPs in clean temporary directories.

This verifier never rewrites the published ZIP or treats an expected compiler
error as success in the student's completed solution.
"""
from __future__ import annotations

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
    manifest_files = list(project.rglob("starter-manifest.json"))
    if INSPECT:
        for mf in manifest_files:
            print(module + " starter-manifest.json: " + mf.read_text(encoding="utf8")[:2000])
        print(module + " Cargo.toml: " + (project / "Cargo.toml").read_text(encoding="utf8")[:500])
        print(module + " src/lib.rs: " + (project / "src/lib.rs").read_text(encoding="utf8")[:6500])

    code, output = run_cargo(project, "check" if expected != "behavior" else "test", temp)
    errors = set(re.findall(r"error\\[([A-Z]\\d+)\\]", output))
    if expected == "behavior":
        if code == 0 or "test result: FAILED" not in output:
            raise AssertionError(module + " expected the starter to compile but fail public behavior tests:\\n" + output[-2500:])
    elif code == 0 or expected not in errors:
        raise AssertionError(module + " expected compiler error " + expected + ", got " + repr(errors) + ":\\n" + output[-2500:])
    print(module + ": original intentional " + expected + " failure reproduced")


def main() -> None:
    if shutil.which("cargo") is None:
        raise RuntimeError("cargo must be installed to test released starter ZIPs")
    with tempfile.TemporaryDirectory(prefix="rust-zip-audit-") as dirname:
        temp = Path(dirname)
        for module, expected in LABS.items():
            audit_one(module, expected, temp)
    print("All seven released L05 starter archives passed the initial-failure audit.")


if __name__ == "__main__":
    main()
