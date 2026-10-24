# Loomake

[日本語](README.md)

Loomake is a toolkit for AI-driven development that starts from requirement documents. It builds on [OpenSpec](https://github.com/Fission-AI/OpenSpec) and adds two things: an entry point from customer requirements, and gates that the AI agent has to pass.

- Turn a requirements document into an OpenSpec change with sources for every requirement (the `req-to-openspec` skill)
- Give AI agents one set of rules to follow (`AGENTS.md`)
- Refuse to start implementation while blocking questions are unanswered, and check that every requirement has a passing test (`loomake verify`)
- Record the results as evidence and produce an acceptance report for the customer (`loomake trace`)
- Let an AI engine implement the tasks, fix them until the done gate passes, and open a pull request (`loomake run`)

> **Status:** not yet published to npm. CLI messages and most documents are in Japanese.

## Commands

```sh
npx loomake init                                  # place AGENTS.md, the config file and the skill
npx loomake doctor                                # check the setup and print what is missing
npx loomake verify --change <id> --spec-only      # spec gate: may implementation start?
npx loomake verify --change <id> --done           # done gate: tests per requirement and quality commands
npx loomake run --change <id>                     # let the AI engine implement the change and open a PR
npx loomake trace record --change <id>            # record evidence
npx loomake trace report --change <id>            # produce the acceptance report
```

Options that take a value accept both `--change <id>` and `--change=<id>`. Run `npx loomake --help` or `npx loomake <command> --help` for details.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | All checks passed (warnings included) |
| 1 | At least one check failed, or `run` stopped safely |
| 2 | Usage or configuration error |
| 3 | Runtime failure: an external command (git, OpenSpec CLI, gh, …) hit a time or output limit, or was interrupted |

`verify --json` prints a result that follows the JSON schema in `@loomake/core`. With `--skip-commands`, the quality commands are not run; the result then contains a `skip` entry named `品質コマンド` ("quality commands"), and such a result must not be used to claim that a change is done.

### What the done gate does and does not prove

A requirement counts as tested when a **passing** test has its ID in the name, for example `it('[REQ-012] returns 401 when not logged in', ...)`. Loomake does not judge whether the test body is sufficient. Review the tests themselves.

## Requirements

- Node.js 20.19 or later (development uses Node.js 24)
- A test runner that writes a JSON report (Vitest and Jest are supported)
- `loomake run` uses Claude Code and the GitHub CLI, and should run inside a container

## Packages

| Package | Role |
|---|---|
| `@loomake/core` | Parsers for trace.md, spec.md, tasks.md and test reports, and the JSON schema of the verify result (no runtime dependencies) |
| `@loomake/kit` | `verify`, `init` and `doctor`, and the templates that `init` places |
| `@loomake/trace` | Evidence records and acceptance reports |
| `@loomake/runner` | `loomake run` |
| `loomake` | The CLI |

## Development

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test             # pnpm test:coverage also checks the coverage thresholds
pnpm build
pnpm -s verify --change <id> --done
```

The rules for contributors, including AI agents, are in [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) (Japanese). Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
