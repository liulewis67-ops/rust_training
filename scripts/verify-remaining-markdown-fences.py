#!/usr/bin/env python3
"""Check every remaining published bilingual Rust fence with real rustc.

Fences are checked as written. Only explicitly listed *teaching context* is
prepended/appended when the lesson intentionally splits a definition over
several fences. Never silently patch a broken user-facing example.
"""
from __future__ import annotations

import re
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "content" / "releases"
SAMPLES = ROOT / "content" / "samples" / "verified-lesson-drills"

# Modes: ok (compile/execute), signature (declaration), todo (expected failing
# exercise), placeholder (empty starter assertion), or an expected E-code.
# Empty arrays mean the lesson deliberately uses linked Rust projects instead
# of inline Rust fences. In particular M08/M09 project tests run separately.
CASES = {
    "m01-l02": [],
    "m01-l05": ["signature", "ok"],
    "m01-l06": ["signature", "ok"],
    "m02-l05": ["ok"],
    "m02-l06": ["todo", "ok", "ok"],
    "m03-l05": ["ok"],
    "m03-l06": ["todo", "ok"],
    "m04-l05": ["ok"],
    "m04-l06": ["todo", "ok"],
    "m05-l03": [],
    "m05-l04": [],
    "m05-l05": ["ok"],
    "m05-l06": ["ok"],
    "m06-l03": ["ok", "ok", "E0515"],
    "m06-l05": ["ok"],
    "m06-l06": ["todo", "placeholder", "ok"],
    "m07-l02": ["ok", "ok", "ok", "E0046"],
    "m07-l03": ["ok", "ok", "ok", "E0038", "ok"],
    "m07-l04": ["ok", "ok", "ok", "ok"],
    "m07-l05": ["ok"],
    "m07-l06": ["todo", "ok"],
    "m08-l01": [],
    "m08-l02": [],
    "m08-l03": [],
    "m08-l04": [],
    "m08-l05": ["ok"],
    "m08-l06": ["signature", "ok"],
    "m09-l01": [],
    "m09-l02": [],
    "m09-l03": [],
    "m09-l04": [],
    "m09-l05": ["ok"],
    "m09-l06": ["ok"],
}

STDOUT = {
    ("m05-l06", 0): "parts: 部署 / 完成\nupdated: 部署：完成!\n",
    ("m06-l03", 0): "view: A17 / queue delayed\nsource remains: A17|queue delayed\n",
    ("m06-l03", 1): "owned: A18 / cache rebuilt\n",
}

ADDED_TESTS = {
    ("m01-l05", 1): 'assert_eq!(discounted_total_cents(100, 10), 90); assert_eq!(discounted_total_cents(1, 50), 1);',
    ("m01-l06", 1): 'assert_eq!(format_cents(0), "0.00"); assert_eq!(format_cents(7), "0.07"); assert_eq!(format_cents(u32::MAX), "42949672.95");',
    ("m02-l05", 0): 'assert_eq!(minutes_to_seconds("12"), Ok(720)); assert!(minutes_to_seconds("bad").is_err()); assert!(minutes_to_seconds(&(u64::MAX / 60 + 1).to_string()).is_err());',
    ("m03-l05", 0): 'let mut list = TaskList::new(); let id = list.add_task("one"); assert_eq!(id, 1); assert_eq!(list.get(id).unwrap().title(), "one"); assert_eq!(list.set_status(id, "done"), UpdateOutcome::Updated); assert_eq!(list.get(id).unwrap().status(), TaskStatus::Done); assert_eq!(list.set_status(99, "done"), UpdateOutcome::TaskNotFound);',
    ("m03-l06", 1): 'assert_eq!(next_action(None), "not found"); assert_eq!(next_action(Some(AlertStatus::Delivered { attempts: 1 })), "retry"); assert_eq!(next_action(Some(AlertStatus::Cancelled { by_user: false })), "review");',
    ("m04-l05", 0): 'assert_eq!(render("build".into()), ("build".into(), "[ready] build.".into()));',
    ("m04-l06", 1): 'assert_eq!(publish_ticket("é".into()), (2, "[ticket] é".into()));',
    ("m05-l05", 0): 'assert_eq!(find_token("hello world", "world"), Some("world")); assert_eq!(find_token("a b", "c"), None);',
    ("m06-l05", 0): 'assert_eq!(parse_view("a=b").unwrap().key, "a"); assert_eq!(queued_config().value, "cache"); assert!(parse_view("wrong").is_none());',
    ("m07-l05", 0): 'assert_eq!(ColonParser.parse("key:value"), Ok(Entry { key: "key".into(), value: "value".into() })); assert!(ColonParser.parse("key=value").is_err());',
    ("m07-l06", 0): 'let build = Build { number: 1, channel: "dev".into() }; let gates: Vec<Box<dyn Gate>> = vec![Box::new(MinimumNumber(2))]; assert!(evaluate_pipeline(&gates, &build).is_err());',
    ("m07-l06", 1): 'let build = Build { number: 1, channel: "dev".into() }; let gates: Vec<Box<dyn Gate>> = vec![Box::new(MinimumNumber(2)), Box::new(ChannelIs("prod".into()))]; assert_eq!(evaluate_pipeline(&gates, &build), Err("build 1 is below minimum 2".into())); assert!(evaluate_pipeline(&[], &build).is_ok());',
    ("m08-l05", 0): 'let result = totals(&[Event { service: "api", bytes: 10 }, Event { service: "api", bytes: 5 }, Event { service: "web", bytes: 2 }]); assert_eq!(result, vec![("api", (2, 15)), ("web", (1, 2))]);',
    ("m08-l06", 1): 'let result = totals(&[Reading { sensor: "a", accepted: true, value: Some(0) }, Reading { sensor: "a", accepted: true, value: None }, Reading { sensor: "z", accepted: false, value: Some(8) }]); assert_eq!(result, vec![("a", (1, 0)), ("z", (0, 0))]);',
    ("m09-l05", 0): 'assert!(validate_duplicate(true, "retry_limit", 2).is_err()); assert!(validate_duplicate(false, "retry_limit", 2).is_ok());',
    ("m09-l06", 0): 'let mapped = map_error(HistoryError::StorageUnavailable("internal-secret".into())); assert_eq!(mapped.0, 503); assert_eq!(mapped.1, "history_unavailable"); assert!(mapped.3); assert!(!mapped.2.contains("internal-secret"));',
}


def extract_rust(markdown: str) -> list[str]:
    tick = chr(96) * 3
    return [
        match.group(2)
        for match in re.finditer(
            r"^" + tick + r"([^\r\n]*)\r?\n(.*?)^" + tick + r"[ \t]*$",
            markdown, flags=re.M | re.S
        )
        if match.group(1).strip() == "rust"
    ]


def contextualize(lesson: str, index: int, pieces: list[str]) -> tuple[str, str]:
    before, after = "", ""
    if lesson == "m06-l03" and index == 2:
        before = pieces[0].split("/// Keeps the source String alive")[0]
    elif lesson == "m06-l05":
        before = """
struct ConfigView<'a> { key: &'a str, value: &'a str }
struct Config { key: String, value: String }
"""
    elif lesson == "m07-l02":
        if index in (1, 2):
            before = pieces[0] + (pieces[1] if index == 2 else "")
        elif index == 3:
            before = pieces[0] + pieces[1].split("/// Implements the shared summary")[0]
    elif lesson == "m07-l03" and index in (1, 2):
        before = pieces[0]
    elif lesson == "m07-l04":
        if index == 1:
            before = pieces[0]
        elif index == 2:
            before = "#[derive(Debug, PartialEq, Eq)]\nstruct RetryCount(u8);\n"
        elif index == 3:
            before = pieces[0] + pieces[1] + pieces[2]
    elif lesson == "m07-l05":
        before = """
#[derive(Debug, PartialEq, Eq)]
struct Entry { key: String, value: String }
#[derive(Debug, PartialEq, Eq)]
enum ParseError { MissingSeparator, EmptyKey, EmptyValue }
trait EntryParser { fn parse(&self, text: &str) -> Result<Entry, ParseError>; }
struct ColonParser;
fn parse_delimited(text: &str, sep: char) -> Result<Entry, ParseError> {
    let (key, value) = text.split_once(sep).ok_or(ParseError::MissingSeparator)?;
    if key.is_empty() { return Err(ParseError::EmptyKey); }
    if value.is_empty() { return Err(ParseError::EmptyValue); }
    Ok(Entry { key: key.into(), value: value.into() })
}
"""
    elif lesson == "m07-l06":
        if index == 0:
            after = pieces[1].split("\nfn evaluate_pipeline(")[0]
        else:
            before = pieces[0].split("/// Checks a configured heterogeneous gate pipeline.")[0]
    elif lesson == "m08-l05":
        before = """
use std::collections::HashMap;
struct Event { service: &'static str, bytes: u64 }
fn totals(events: &[Event]) -> Vec<(&str, (u32, u64))> {
    let mut grouped: HashMap<&str, (u32, u64)> = HashMap::new();
    for event in events {
"""
        after = """
    }
    let mut sorted: Vec<_> = grouped.into_iter().collect();
    sorted.sort_by_key(|entry| entry.0);
    sorted
}
"""
    elif lesson == "m08-l06":
        structs = """
use std::collections::HashMap;
struct Reading<'a> { sensor: &'a str, accepted: bool, value: Option<i64> }
struct SensorSummary<'a> { sensor: &'a str, accepted_count: u32, total: i64 }
"""
        if index == 0:
            before = structs
        else:
            before = structs + """
fn totals<'a>(readings: &[Reading<'a>]) -> Vec<(&'a str, (u32, i64))> {
    let mut grouped: HashMap<&str, (u32, i64)> = HashMap::new();
    for reading in readings {
"""
            after = """
    }
    let mut sorted: Vec<_> = grouped.into_iter().collect();
    sorted.sort_by_key(|entry| entry.0);
    sorted
}
"""
    elif lesson == "m09-l05":
        before = """
#[derive(Debug, PartialEq)]
enum ConfigErrorKind { DuplicateField }
#[derive(Debug)]
struct ConfigError { kind: ConfigErrorKind, field: String, line: usize, column: usize }
fn config_error(kind: ConfigErrorKind, field: &str, line: usize, column: usize) -> ConfigError {
    ConfigError { kind, field: field.into(), line, column }
}
fn validate_duplicate(duplicate: bool, field: &str, line_no: usize) -> Result<(), ConfigError> {
"""
        after = "\nOk(())\n}\n"
    elif lesson == "m09-l06":
        before = """
enum HistoryError { StorageUnavailable(String) }
fn map_error(error: HistoryError) -> (u16, &'static str, &'static str, bool) {
    match error {
"""
        after = "    }\n}\n"
    return before, after


def prepare(lesson: str, index: int, pieces: list[str], mode: str) -> str:
    snippet = pieces[index]
    before, after = contextualize(lesson, index, pieces)
    if mode == "signature":
        if "{" in snippet or not snippet.rstrip().endswith(("String", "i64", "str>", ">")):
            raise AssertionError(lesson + ": expected an unfinished signature")
        after += " { unimplemented!() }\n"
    if lesson == "m02-l06" and index == 1:
        snippet = pieces[2] + "\n" + snippet
    if mode == "todo":
        if "todo!()" not in snippet and not (lesson == "m07-l06" and index == 0):
            raise AssertionError(lesson + ": exercise no longer has a TODO")
    if mode == "placeholder" and "TODO" not in snippet:
        raise AssertionError(lesson + ": empty student test placeholder changed")
    if (lesson, index) in ADDED_TESTS:
        after += "\n#[test]\nfn verify_public_contract() {\n    " + ADDED_TESTS[(lesson, index)] + "\n}\n"
    if mode == "todo" and (lesson, index) not in ADDED_TESTS:
        assertion = {
            ("m02-l06", 0): 'assert_eq!(checked_total(1, 2), Ok(3));',
            ("m03-l06", 0): 'assert_eq!(next_action(None), "not found");',
            ("m04-l06", 0): 'assert_eq!(publish_ticket("é".into()), (2, "[ticket] é".into()));',
            ("m06-l06", 0): 'assert_eq!(normalize_topic("rust").as_ref(), "#rust");',
        }.get((lesson, index))
        if assertion is None:
            raise AssertionError(lesson + ": unclassified starter test")
        after += "\n#[test]\nfn rejected_unfinished_exercise() {\n    " + assertion + "\n}\n"
    return before + snippet + after


def compile_snippet(source: str, mode: str, directory: Path, file_label: str):
    binary = directory / file_label
    has_main = bool(re.search(r"\bfn\s+main\s*\(", source))
    has_tests = "#[test]" in source
    args = ["rustc", "--edition=2024", "--crate-name", "markdown_lesson"]
    if has_tests:
        args += ["--test"]
    elif has_main:
        args += ["--crate-type=bin"]
    else:
        args += ["--crate-type=lib", "--emit=metadata"]
    args += ["-o", str(binary), "-"]
    compiled = subprocess.run(args, input=source, text=True, capture_output=True, timeout=30)
    if mode.startswith("E"):
        if compiled.returncode == 0 or "error[" + mode + "]" not in compiled.stderr:
            raise AssertionError(file_label + ": expected " + mode + ":\n" + compiled.stderr)
        return "compiler rejection"
    if compiled.returncode:
        raise AssertionError(file_label + ": unexpected rustc rejection:\n" + compiled.stderr)
    if not (has_main or has_tests):
        return "compiled"
    executed = subprocess.run([str(binary)], text=True, capture_output=True, timeout=30)
    if mode == "todo":
        if executed.returncode == 0 or "FAILED" not in executed.stdout:
            raise AssertionError(file_label + ": unfinished exercise was not caught:\n" + executed.stdout + executed.stderr)
        return "unfinished exercise detected"
    if executed.returncode:
        raise AssertionError(file_label + ": runnable example failed:\n" + executed.stdout + executed.stderr)
    if mode == "placeholder":
        return "vacuous starter test (not behavior evidence)"
    return executed.stdout


def main() -> None:
    all_lessons = {
        "m" + str(m).zfill(2) + "-l" + str(l).zfill(2)
        for m in range(1, 10) for l in range(1, 7)
    }
    prior = (ROOT / "scripts" / "verify-markdown-rust-fences.mjs").read_text(encoding="utf8")
    previously_audited = set(re.findall(r"'(m\d\d-l\d\d)': \[", prior.split("const stdoutContracts")[0]))
    if set(CASES) & previously_audited or set(CASES) | previously_audited != all_lessons:
        raise AssertionError("Markdown coverage mapping must partition all 54 published lessons")
    total, compiled, failures, placeholders, zero = 0, 0, 0, 0, 0
    with tempfile.TemporaryDirectory(prefix="rust-remaining-fences-") as temp:
        for lesson, modes in CASES.items():
            zh = extract_rust((RELEASES / (lesson + ".md")).read_text(encoding="utf8"))
            en = extract_rust((RELEASES / "en" / (lesson + ".md")).read_text(encoding="utf8"))
            if len(zh) != len(modes) or len(en) != len(modes):
                raise AssertionError(lesson + ": fence count changed; zh=" + str(len(zh)) + ", en=" + str(len(en)))
            if zh != en:
                raise AssertionError(lesson + ": Chinese and English Rust snippets diverge")
            if not modes:
                zero += 1
                print(lesson + ": no inline Rust fence; linked project/other syntax reviewed separately")
                continue
            for index, mode in enumerate(modes):
                source = prepare(lesson, index, zh, mode)
                outcome = compile_snippet(source, mode, Path(temp), lesson + "-" + str(index + 1))
                expected_stdout = STDOUT.get((lesson, index))
                if expected_stdout is not None and outcome != expected_stdout:
                    raise AssertionError(lesson + ":" + str(index + 1) + ": expected stdout " + repr(expected_stdout) + "; got " + repr(outcome))
                total += 1
                if mode in ("todo",) or mode.startswith("E"):
                    failures += 1
                elif mode == "placeholder":
                    placeholders += 1
                else:
                    compiled += 1
            print(lesson + ": " + str(len(modes)) + " bilingual Rust fences checked")
    print(
        "Remaining " + str(len(CASES)) + " lessons audited; " + str(total) +
        " inline Rust fences: " + str(compiled) + " compiling/running, " +
        str(failures) + " intentionally rejected or unfinished, " +
        str(placeholders) + " vacuous student test; " +
        str(zero) + " lessons without inline Rust."
    )


if __name__ == "__main__":
    main()
