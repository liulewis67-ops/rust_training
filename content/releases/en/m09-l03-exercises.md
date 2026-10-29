# M09-L03 Exercises: Library-to-CLI and HTTP error mapping

> **Exercise path:** Predict → repair → write tests. Keep business errors independent of transport and verify all public boundaries.

## Learning goals and order

The domain library reports `CoreError`; the CLI and HTTP application layers independently present it. First predict the mapping, then repair an intentionally incorrect adapter, and finally lock down both contracts with assertions.

## 1. Predict: one CoreError, two presentations

Use the lesson's `CoreError`, `map_cli`, and `map_api` to predict the results for `InvalidPort`, `ProfileNotFound`, and `Storage`.

| Domain error | CLI exit | HTTP status | Public API code |
| --- | ---: | ---: | --- |
| `InvalidPort` | 2 | 400 | `invalid_port` |
| `ProfileNotFound` | 3 | 404 | `profile_not_found` |
| `Storage` | 1 | 500 | `internal_error` |

**Predict:** Does `Storage::source()` still expose `io::Error` internally? Does the remote response contain the simulated permission-denied private path?

**Acceptance:** The cause remains inspectable within the domain error, while the API exposes only a stable sanitized message. This source lesson deliberately allows a more detailed local CLI diagnostic; production operators still require access control.

## 2. Repair: every error became HTTP 500

The intentionally faulty adapter maps invalid input and missing resources to internal server errors. Restore variant-specific matching:

- `InvalidPort` → `400 / invalid_port`
- `ProfileNotFound` → `404 / profile_not_found`
- `Storage` → `500 / internal_error`

**Hint:** Match the typed `CoreError` variant. Never infer a status by parsing the `Display` string, and never append the source error to the public message.

**Acceptance:** The initial snippet compiles but fails two assertions. The corrected adapter maps user and missing-resource cases separately from storage failure.

~~~rust
/// Maps every library error to one generic API failure.
fn map_api(error: &CoreError) -> ApiFailure {
    let _ = error;
    ApiFailure {
        status: 500,
        code: "internal_error",
        message: "internal server error",
    }
}

/// Checks business errors remain distinct from internal failures.
fn main() {
    let invalid = CoreError::InvalidPort { line: 3 };
    let missing = CoreError::ProfileNotFound {
        name: String::from("daily"),
    };
    assert_eq!(map_api(&invalid).status, 400);
    assert_eq!(map_api(&missing).status, 404);
}
~~~

## 3. Complete contract tests for both adapters

Fill in the test so all three domain errors produce their documented CLI exit codes and API statuses/codes. The original storage cause must remain `io::Error`, but the API message must not contain `private path`.

**Hint:** Assert the HTTP `status` and `code` independently. Do not reuse HTTP statuses as CLI exit codes.

**Acceptance:** Invalid port → CLI 2/API 400, missing profile → CLI 3/API 404, storage → CLI 1/API 500. The internal source is retained while the API message is redacted.

~~~rust
/// Completes assertions for three error categories at both application edges.
#[test]
fn library_errors_map_to_cli_and_api_contracts() {
    let invalid = CoreError::InvalidPort { line: 6 };
    let missing = CoreError::ProfileNotFound {
        name: String::from("daily"),
    };
    let storage = CoreError::from(std::io::Error::new(
        std::io::ErrorKind::PermissionDenied,
        "private path",
    ));

    // TODO: Assert invalid input, missing resource, and internal failure mappings.
    // TODO: Assert the library source is retained and private path is not in API output.
}
~~~

## Self-check list

- [ ] User error, missing resource, and internal failure have distinct mappings.
- [ ] SQL, connection details, and credentials do not appear in the public API.
- [ ] CLI and API each have independent behavioral assertions rather than interchangeable status codes.

Use observable behavior tests, not compilation alone.

## Exercise 4: Verified transfer — CLI/API mapping contracts and sensitive-error leakage

Predict the CLI/API outcomes of InvalidPort, ProfileNotFound and Storage, then run the two tests. Temporarily map every case to HTTP 500 and identify the failed assertion. Next expose the source message in the public response and observe the privacy assertion; restore the correct boundary.

**Acceptance:** Supply the result of `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m09_boundaries::`, an observed error or behavioral regression, and a minimal repair that preserves the contract.

## Reference answers

1. The domain layer contains only stable categories: `InvalidPort` → 2/400, `ProfileNotFound` → 3/404, `Storage` → 1/500 once adapted at the edges.
2. Map `status`, `code`, and safe `message` by enum variant. Never guess from `Display`.
3. Test every category at both boundaries, preserve `io::Error` for controlled diagnostics, and exclude `private path` from remote output.

**Deployment note:** CLI diagnostics are not automatically trustworthy just because they run locally. Review permissions, logging, and secret disclosure for terminal users as well as network clients.

## Sources

The official error handling chapter explains the lower-level error semantics used in this exercise.

- [The Rust Programming Language: Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
