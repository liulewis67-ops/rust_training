import type { Language } from '../features/preferences'

const phases: Record<string, [string, string]> = {
  S1: ['Development Loop and Language Basics', 'Build, test, and fix a small program independently.'],
  S2: ['Ownership and Borrowing Design', 'Design suitable parameters and return values for a text processing library.'],
  S3: ['Types, Collections, and Errors', 'Build a reusable business core with an explicit error model.'],
  S4: ['Engineering and Synchronous Concurrency', 'P1: deliver a log analysis CLI.'],
  S5: ['Tokio and Async Engineering', 'P2: implement a bounded concurrent task executor.'],
  S6: ['Axum APIs and Persistence', 'P3: complete the API and data milestones.'],
  S7: ['Security, Reliability, and Observability', 'Complete P3 acceptance and submit an incident report.'],
  S8: ['Release, Optimization, and Delivery', 'P4: deliver a deployable service and present the final review.'],
}

const modules: Record<string, [string, string]> = {
  M01: ['Development Loop and Language Basics', 'Learn the toolchain and complete a development loop from requirements to a verified program.'],
  M02: ['Values, Functions, and Control Flow', 'Use expressions, functions, and boundary checks to build reliable small calculations.'],
  M03: ['Structured Business Data', 'Express business data and states with structs, enums, and module boundaries.'],
  M04: ['Ownership and Resource Flow', 'Trace owners, moves, and Drop to design clear resource boundaries.'],
  M05: ['References, Borrowing, and Slices', 'Express access permissions through borrowing APIs and handle text and UTF-8 safely.'],
  M06: ['Lifetimes and Return Design', 'Reason about reference relationships and choose between borrowed views and owned results.'],
  M07: ['Traits and Generics', 'Build bounded, replaceable abstractions with traits and generics.'],
  M08: ['Collections, Closures, and Iteration', 'Access, transform, and aggregate collections under ownership constraints.'],
  M09: ['Errors and Boundary Modeling', 'Propagate contextual errors and separate library and application boundaries.'],
  M10: ['Testable CLI Engineering', 'Combine business logic, CLI, tests, dependencies, and docs into a deliverable tool.'],
  M11: ['Smart Pointers and Resource Management', 'Choose Box, Rc, Arc, RefCell, and Weak based on ownership relationships.'],
  M12: ['Threads and Synchronization', 'Share state safely and manage parallel work with locks and bounded channels.'],
  M13: ['Futures and Runtimes', 'Understand Futures, task scheduling, and the boundary around blocking work.'],
  M14: ['Async Coordination and Backpressure', 'Collect task results and control workloads with queues and concurrency budgets.'],
  M15: ['Cancellation, Shutdown, and Validation', 'Design cancellation safe tasks, timed shutdown, and repeatable async tests.'],
  M16: ['Routes, Requests, and Responses', 'Define clear HTTP contracts and input boundaries for Axum APIs.'],
  M17: ['State, Middleware, and Boundaries', 'Organize app state, errors, Tower middleware, and testable interfaces.'],
  M18: ['SQLx and Persistence', 'Maintain persistence invariants through SQL, migrations, transactions, and indexes.'],
  M19: ['Identity, Permissions, and Input Boundaries', 'Verify identity and resource permissions while protecting secrets, inputs, and logs.'],
  M20: ['Reliable APIs and Events', 'Handle idempotency, retries, event subscriptions, and background recovery.'],
  M21: ['Observability and Incident Diagnosis', 'Use logs, metrics, minimal reproductions, and regression evidence to diagnose failures.'],
  M22: ['Build and Release', 'Plan target platforms, secret injection, deployment, migrations, and rollbacks.'],
  M23: ['Performance and Stability', 'Prove service behavior through measurement, capacity budgets, and recovery drills.'],
  M24: ['Final Delivery and Maintenance', 'Move from requirements and review to delivery, runbooks, and maintenance decisions.'],
}

const lessonTitles: Record<string, string[]> = {
  M01: ['Problems Rust Solves and Choosing a Path', 'rustup, Cargo, Editions, and Project Structure', 'build/check/run/test and Reading Diagnostics', 'Git, Formatting, Clippy, and Minimal Tests', 'Lab: Make a Failing Project Pass Again', 'Final Check: Deliver a Tested Program from an Empty Directory'],
  M02: ['Variables, Mutability, Basic Types, and Inference', 'Expressions, Statements, Functions, and Returns', 'if, loop, while, and for', 'Arrays, Tuples, Patterns, and Bounds', 'Lab: Data Unit Converter', 'Final Check: A Sum Function with Overflow Handling'],
  M03: ['Structs, Fields, and Methods', 'Enums and match', 'Option and Missing Values', 'Modules, Visibility, and Public API Basics', 'Lab: In Memory Task List', 'Final Check: Reminder States and Missing Queries'],
  M04: ['Owners, Scopes, and Drop', 'Where Moves Happen', 'Copy, Clone, and Their Costs', 'Function Parameters, Returns, and Partial Moves', 'Lab: Repair a Text Pipeline', 'Independent Check: Audit and Deliver Support Tickets'],
  M05: ['Shared and Exclusive Borrowing', 'Borrow Scope and NLL Intuition', 'String, str, Slices, and UTF-8', 'Mutable Borrow Conflicts and API Design', 'Lab: Zero Copy Text Query API', 'Independent Check: Borrow Conflicts and Safe UTF-8 Splitting'],
  M06: ['Reference Validity and Lifetime Relationships', 'Function Lifetime Annotations and Elision', 'Structs with References and Owned Returns', "'static, Bounds, and Common Misconceptions", 'Lab: Borrowed Configuration Views and Owned Configuration', 'Independent Check: Choose Borrowing, String, or Cow for Results'],
  M07: ['Generics and Bounds', 'Traits, Implementations, and Associated Types', 'Static Dispatch, dyn, and dyn Compatibility', 'From/TryFrom, Newtypes, and Invariants', 'Replaceable Parser Interface', 'Choosing Dispatch for a Runtime Strategy Pipeline'],
  M08: ['Vec, HashMap, and Access Strategies', 'Closure Capture and the Fn Family', 'iter, iter_mut, and into_iter', 'map/filter/fold, collect, and Laziness', 'Lab: Aggregate Log Statistics', 'Statistics Under Ownership Constraints'],
  M09: ['Result, ?, and Error Propagation', 'Custom Errors and Source Chains', 'Library and Application Error Boundaries', 'panic, Recovery Strategies, and Error Messages', 'Lab: Configuration Parser with Error Locations', 'Different Error Presentations for CLI and API'],
  M10: ['Cargo Workspaces and Module Boundaries', 'Unit, Integration, and Documentation Tests', 'Arguments, Configuration, Files, and Standard Streams', 'Dependencies, Features, Lockfiles, and Docs', 'Lab: Deliver a Log Analysis CLI', 'Final Check: Support a New Log Input Format'],
  M11: ['Box<T> and Recursive Data', 'Rc<T> / Arc<T> and Shared Ownership', 'RefCell<T> and Interior Mutability', 'Weak<T>, Drop, Reference Cycles, and Cleanup', 'Lab: Repair Cache Ownership', 'Final Check: Choose the Simplest Ownership Model'],
  M12: ['Threads, move Closures, and Thread Results', 'Send / Sync and Cross Thread Type Boundaries', 'Mutex / RwLock and Lock Scope', 'Channels, Lock Order, and Bounded Queues', 'Lab: Parallel Log Statistics', 'Final Check: Fix Lock Contention'],
  M13: ['async / await and Lazy Futures', 'Tasks, Threads, and Scheduling', "Send / 'static and spawn", 'Blocking Boundaries, spawn_blocking, and Concurrency Limits', 'Lab: Diagnose a Blocked Runtime', 'Final Check: Choose Execution for Mixed Workloads'],
  M14: ['JoinHandle and Task Results', 'mpsc and oneshot Channels', 'select, Timeouts, and Completion Order', 'Semaphores, Queues, and Backpressure', 'Lab: Bounded Task Processing Pipeline', 'Final Check: Avoid Unbounded Queues at Peak Load'],
  M15: ['Cancellation Safety and Intermediate State', 'Dropping Handles, Aborting, and Cooperative Cancellation', 'Graceful Shutdown, Cleanup, and Deadlines', 'Repeatable Async Tests', 'Lab: Cancellation Safe Bounded Executor', 'Final Check: Arbitrate Cancellation, Timeouts, and Failures'],
  M16: ['HTTP Contracts, Methods, and Status Codes', 'Routers, Handlers, and Startup', 'Path/Query/Json and Extraction Order', 'IntoResponse and Input Rejection', 'Lab: In Memory Task API', 'Final Check: Implement an Unfamiliar Resource API'],
  M17: ['State, AppState, and Substates', 'Business and Service Errors', 'Tower Layers, Execution Order, and Request Tracing', 'Interface Layers, Route Tests, and Test Doubles', 'Lab: Unified Errors and Request Context', 'Final Exercise: Tracing and Authentication Middleware'],
  M18: ['SQL, Schemas, Migrations, and Seed Data', 'Connection Pools, Parameterized Queries, and Result Mapping', 'Transactions, Constraints, and Concurrent Updates', 'Pagination, Indexes, and Offline Compile Checks', 'Lab: Persistent Task API', 'Final Check: Version Conflicts and Transaction Rollback'],
  M19: ['Authentication and Authorization', 'Sessions, Secure Cookies, CSRF, and Logout', 'Resource Ownership and Role Permissions', 'Secrets, Password Hashing, Input, and Log Boundaries', 'Lab: Prevent Cross User Task Reads', 'Final Exercise: Authorization Regression for Task Exports'],
  M20: ['Idempotency Keys and Duplicate Requests', 'Timeouts, Retries, and Backoff', 'SSE/WebSocket and Connection Lifecycles', 'Background Tasks, Persistent State, and Recovery', 'Lab: Task Event Subscription and Reconnection', 'Final Exercise: Disconnects, Duplicate Events, and Cancellation Races'],
  M21: ['Structured Logs, Traces, and Request IDs', 'Metrics, SLOs, and Failure Categories', 'Connection Pools, Slow Queries, and Queue Buildup', 'Minimal Reproductions, Diagnostic Hypotheses, and Regression Tests', 'Lab: Diagnose a Simulated Incident', 'Final Exercise: Metrics, Delivery, and Incident Decisions'],
  M22: ['Release Builds, Target Platforms, and Runtime Images', 'Environment Configuration and Secret Injection', 'CI, Health Checks, and Rolling Updates', 'Data Migrations, Rollbacks, and Compatibility Windows', 'Lab: Deploy, Observe, and Roll Back in a Local Cluster', 'Final Exercise: Old Versions Meet New Schemas'],
  M23: ['Benchmarks, Sampling, Flame Graphs, and Measurement Error', 'Allocations, Clones, Serialization, and Hotspots', 'Throughput, Tail Latency, Concurrency, and Capacity', 'Backup Recovery, Resource Budgets, and Load Protection', 'Lab: Identify and Verify a Performance Bottleneck', 'Final Exercise: Evaluate a Performance Change'],
  M24: ['Define Acceptance from Business Requirements', 'Design Notes, API Docs, and Runbooks', 'Code Review, Version Upgrades, and Changelogs', 'Incident Reviews and Maintenance Priorities', 'Lab: P4 Service Delivery Package', 'Final Project: Requirements, Release, Incident, and Maintenance Review'],
}

const legacyTitles: Record<string, string> = {
  ownership: 'Ownership', borrowing: 'Borrowing', 'mutable-borrowing': 'Mutable Borrowing',
  lifetimes: 'Lifetimes', 'struct-ownership': 'Structs and Ownership', traits: 'Traits',
  'generics-dyn': 'Generics and dyn Traits', result: 'Result and Error Handling',
  capability: 'Capability Abstraction', 'agent-infra': 'Agent Infrastructure Architecture',
}

export function legacyLessonTitle(id: string, language: Language, fallback: string): string {
  return language === 'en' ? (legacyTitles[id] ?? fallback) : fallback
}

export function phaseText(id: string, language: Language, field: 'title' | 'outcome', fallback: string): string {
  return language === 'en' ? (phases[id]?.[field === 'title' ? 0 : 1] ?? fallback) : fallback
}

export function moduleText(id: string, language: Language, field: 'title' | 'outcome', fallback: string): string {
  return language === 'en' ? (modules[id]?.[field === 'title' ? 0 : 1] ?? fallback) : fallback
}

export function lessonTitle(moduleId: string, lessonId: string, language: Language, fallback: string): string {
  if (language === 'zh') return fallback
  const index = Number(lessonId.slice(1)) - 1
  return lessonTitles[moduleId]?.[index] ?? fallback
}
