# Loomakeへの貢献

不具合報告は[SUPPORT.md](SUPPORT.md)、秘密に扱う必要がある報告は[SECURITY.md](SECURITY.md)を参照する。実装する振る舞いと承認の扱いは[AGENTS.md](AGENTS.md)に従う。

## 開発を始める

開発にはNode.js 24とpackage.jsonに指定されたpnpmを使う。リポジトリを取得し、次を実行する。

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

配布物のNode下限と開発用ツールの要件は異なる。[互換性](docs/guide/3.reference/1.compatibility.md)と[テストの手順](docs/testing.md)も確認する。

## 仕様から変更する

1. 現行の`openspec/specs/`、関連する進行中のchange、trace.mdの出典を読む。
2. 振る舞いを変える場合はchangeのproposal・差分仕様・design・tasks・traceを揃える。曖昧な点はtraceの確認事項に残し、ブロッキングな回答がないまま実装しない。
3. `pnpm -s verify --change <id> --spec-only`を通す。
4. 仕様を確かめるテストを先に書き、不具合修正では修正前の失敗を確認する。テスト名にREQ-IDを入れ、RedとGreenをchangeのtdd.mdに残す。
5. タスクごとに実装とテストを確認し、小さくコミットしてtasks.mdをチェックする。
6. 利用者に影響するパッケージにはchangesetを追加し、文書を実装と揃える。文書や開発用ツールだけの場合は、空のchangesetで公開対象がないことを示す。
7. 全タスクと全Requirementのテスト対応を確認し、`pnpm -s verify --change <id> --done`を通す。

現行仕様を直接書き換えない。完了したchangeの差分は、archiveの手順で反映する。文書だけの修正で新しい製品の振る舞いがない場合は、そのためだけに製品のRequirementを作らない。

## レビューに必要な内容

PRには、変更する問題と結果の動作、対象change、実行したゲートとテスト、未確認の環境と残る確認事項を書く。配布物の変更はtarballからの検査も行う。コマンドが失敗した場合は、その理由と解消した結果を記録する。

既存テストの削除・skip・期待値の変更、品質設定の緩和は承認なしに行わない。テストが要件に合っていないと思う場合も、実装へ合わせて書き換える前に、仕様と変更理由を示す。日本語の文書はyomiyasuで推敲する。

PR本文には対象を `loomake-change: <change-id>` の行で明示する。対象がなければ `loomake-change: none` と書く。CIはUbuntu・macOS・Windowsで検査する。

## 版と互換性

パッケージの版はchangesetsで管理し、パッケージごとに独立して上げる。利用者に影響する変更にはchangesetを足し、文書や開発用ツールだけの変更には空のchangesetを足す。決めた理由は[ADR 0001](docs/adr/0001-versioning-with-changesets.md)にある。

`0.x`の間は、破壊的変更をminor、それ以外をpatchで公開し、破壊的変更には移行の方法を添える。パッケージの版と形式の版は独立させ、verifyのJSONを壊すときはschemaVersionのmajorを上げる。決めた理由は[ADR 0002](docs/adr/0002-breaking-changes-in-0x.md)にある。設計の判断は[docs/adr/](docs/adr/README.md)に残す。

## コードの境界

関数はnamed exportにする。設定や使い方の誤りはUsageErrorとし、CLIは終了コード2を返す。利用者へのメッセージは日本語にする。coreの外部の実行時依存はzodだけ、kitはcoreとyamlだけ、traceはcoreとkit、runnerはcore・kit・trace、CLIはこの4パッケージだけに依存する。

モデルと判定はI/Oから分け、重要な異常・境界をテストする。要件名の存在だけで十分な検証とは判断しない。[アーキテクチャ](docs/architecture.md)と[mutation試験の範囲](docs/testing.md)を参照する。
