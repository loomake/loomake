# Tasks

## 1. 仕様

- [x] 1.1 子changeを作り、親からREQ-312・050・323を既存IDのまま移す。cliのREQ-135・194・041は、現行の本文に合わせてdeltaを新しく作る。親のtasks・trace・proposalに移したことを書く。`verify --change verify-v2-scope --spec-only` が0

## 2. --scope

- [x] 2.1 `packages/cli/src/args.ts` に `SCOPES` と、verify・trace recordの `--scope local|ci` を足す。usage・help・リファレンスが同じ定義から出る。`main.ts` で値を検査し（localかci。不正と空は使い方の誤りで2）、`runVerify` と `runRecord` に渡す。`--scope local` と `--scope=local` はどちらも受理する。省いたときの既定値は渡さず、環境変数CIでは変えない（REQ-312・135・194・041）
- [x] 2.2 `runVerify` は明示したscopeを指定どおりに扱う。changeなしの明示ciを拒否する特別扱いは置かない（REQ-312）

## 3. 生成物と基準

- [x] 3.1 `pnpm build` のあと `node scripts/generate-cli-reference.mjs` で `docs/guide/3.reference/5.cli.md` を再生成し、`--check` が0（REQ-323）
- [x] 3.2 基準の差分の記録に、stderrの出力番号（entry）と複数行の新文を足し、試験を合わせる。`reference-cli-baseline-changes.json` に、変わるusageとhelpの具体差分（27例）を承認元つきで足す。原本は変えない。差分一覧をPR本文に載せて個別承認を求める（REQ-324・135）

- [x] 3.3 REQ-324：子changeのMODIFIED（specs/reference-docs/spec.md）で、基準の差分の対象を標準エラーの出力番号と複数行の新文に広げる（S8-09）。**archiveの順は `verify-v2-evidence` → `verify-v2-scope`**（scopeのMODIFIEDはevidenceのarchive後の主仕様を比べる）

## 4. 試験

- [x] 4.1 REQ-312：scopeの既定値と明示（doneはci、spec-onlyはlocal、bareはlocal、環境変数CIの影響なし）、置き残したlocalの結果をciに使えないことのCLIとAPIの一致
- [x] 4.2 REQ-135・194・041：helpの内容（verify・trace record）、`--scope` の等号・空白・空・不正値、trace record の `--scope` の受け渡し
- [x] 4.3 REQ-050：`--done --scope local --skip-commands --json` で500要件・1,000ファイル・3秒以内を保ち、skipは不足で1、coverageを出さない。既存の上限は緩めない

## 5. 受入

- [x] 5.1 lint・typecheck・全体試験・`generate-cli-reference --check`、changeset（cli minor、kit patch）。`pnpm -s verify --change verify-v2-scope --done` を通す <!-- loomake:gate=done -->
