# Task 2.1: pre-implementation native lifecycle oracle

This observation fixes the previously unasserted P27/P28/P35/P37/P41 attempt snapshots before changing the collector. The machine-readable oracle is `tests/fixtures/vitest-body-attempt-oracle.json`. Its `attempts` values are exact records; `finalStatus` is separate because the state observed by a finished callback is not necessarily the final test status.

## Conditions and preserved inputs

Observed on Node 24.21.0 / Vitest 5.0.5 / Linux arm64, at source head `966edb1bb37ccfcca42f97d72e140131edee0474`. Both batches ran the complete original 52-case fixture in four conditions: clean identity, clean original adapter, observed identity, and observed original adapter. The fixture bytes, original collector source, deadlines, skip/todo declarations, and existing assertions were not changed.

All eight actual Vitest processes exited 1 without a signal or process error. Every condition had the same 52 `(fullName, status)` pairs: 44 passed, 6 failed, 1 skipped, 1 todo. The parent timeout commands exited 0, as recorded from the actual Codex exec/write_stdin results in `parent-outcomes.json`. Per-child deadlines were 45 seconds; each batch had a real parent 60-second TERM deadline and a further 2-second KILL deadline. Neither deadline fired. These are observation outcomes, not a product completion gate or CI result.

The clean adapter used the unchanged public `createBodyRecorder(chai)` implementation. The observer adapter added no finished callback: a temporary public `TestRunner.extendTaskContext` wrapper logged the existing registrations and wrapped each existing callback exactly once. It retained registration order, `this`, callback arguments, returned values, and errors. The native identity observer added one diagnostic sentinel at the first body call, in the position where the original adapter registers its snapshot callback. Identity JSON itself contains no `loomakeBody` and is not an attempts oracle.

An independent diagnostic matcher wrapper recorded actual `toBe` invocations within the five target body callbacks. This observer was outside the product implementation. The clean/observed parity and exact clean/observed adapter snapshots were checked after each batch. Instrumentation can affect elapsed time; these observations do not establish a guarantee for arbitrary instrumentation or environments.

## Exact snapshots

All five records have `repeat: 0` and `retry: 0`, with exactly one attempt.

| Case | expectedFailure | Snapshot state | Snapshot calls | Final status |
| --- | --- | --- | --- | --- |
| P27 | true | fail | `{"toBe":1}` | passed |
| P28 | true | pass | `{"toBe":1}` | failed |
| P35 | null | fail | `{}` | failed |
| P37 | null | fail | `{"toBe":1}` | failed |
| P41 | null | pass | `{"toBe":1}` | failed |

For every row, the clean original-adapter report, observed original-adapter report, live adapter callback snapshot, and native sentinel snapshot agree. These are measured values, not values inferred from upstream source.

P27 and P28 expose the state before the expected-failure inversion. They must not be rewritten to match the final status. P37 registers the adapter callback first and the throwing user callback second; invocation order is 2 then 1. The user callback throws while state is pass, and the adapter then observes fail. P41 registers the throwing user callback first and the adapter second; invocation order is again 2 then 1. The adapter observes pass before the user callback throws. The oracle preserves the raw registration/invocation sequence and intermediate evidence.

P35's late matcher actually executes after the finished callback. In batch 2's observed-adapter condition, finished entered at `2132.391043ms`, returned at `2135.830418ms`, and the late matcher ran at `2158.960084ms` on the process performance clock. Live product evidence was already `state: fail, calls: {}` and remained empty at the late body return and in the report. The separate native identity sentinel also observed fail/empty, closed its diagnostic scope, and later logged the actual matcher with `counted: false`.

The observed-adapter `native.jsonl` event's `counted: true` and `scopeOpen: true` describe only the independent diagnostic scope, which remains open until the original async callback settles. They do not describe the product recorder's closed scope. Product evidence at that same event is empty. No report serialization timestamp was observed, so no ordering relative to serialization is inferred from a report alone.

## Evidence and remaining work

Raw local evidence is in `.loomake/collector-376-oracle/run-01/` and `run-02/`. Each contains the complete input fixture, body shim, config, optional observer, actual stdout/stderr/outcomes, JSON report, and diagnostic events. Both exact executed drivers and their hashes are retained. `proof.json` records environment, source/input hashes, child commands/exits, all fullName/status pairs, and raw reports' selected metadata; the parent directory's `inventory.json` hashes all regular evidence files while excluding dependency/cache links.

Batch 2 changed only diagnostic logging to include matcher invocations after its scope closed, and preserved batch 1. It was launched before the coordinator's later instruction to narrow additional conditions, so it includes four conditions again; no further rerun was made. The current source/fixture hashes still equal the pre-execution hashes. The compact tracked oracle contains no fixed timing assertions or environment-specific absolute paths.

Task 2.1 fixes the values to use for strict attempts assertions in task 2.4. The new runner, recorder repair, configured/unconfigured migration, package consumer, local completion gate, independent implementation review, and required CI remain unimplemented or unaccepted. The existing 52-case assertions are unchanged, and no claim is made for Node 22, other operating systems, custom Base compatibility, or preview completion.
