# Design

## Context

動機と変更範囲は proposal.md、出力の契約は specs/ci-test-diagnostics/spec.md に示す。調査の基準は main の `56bd425`。Vitest は `.loomake/test-report.json` を生成するが、quality はレポートの保存もジョブ要約の生成も行っていない。PR #109 の試験修正と PR #115 の archive とは別の担当範囲である。

## Goals / Non-Goals

診断は quality のテスト1回分を扱う。gate は複数の change を順に検証して同じレポートを上書きするため、今回の対象にしない。既知の失敗との自動照合、性能の合否判定、実行結果の再利用も行わない。

## Decisions

### 既存の JSON を読む

`vitest.config.ts` と `loomake.config.json` は変えず、`scripts/ci-test-diagnostics.mjs` を追加する。JSON 解析と要約は名前付き export の関数に分け、fixture から直接テストする。Actions ログの文字列を解析する案は、ログの装飾や改行に左右されるため採らない。

テストステップに ID を付ける。シャードの `pnpm test --shard=...` と Ubuntu の `pnpm test --coverage` はそのまま保つ。スクリプトは両ステップの outcome から、実行・失敗・未実行を区別する。JSON の最小構造と状態を検査し、欠損・不正・空の結果を成功とは表さない。読める JSON とテストステップの成否も別々に表示する。

### 実行情報と出力

診断の JSON は `schemaVersion: 1` と、run URL・ID・attempt、checkout SHA、OS、Node、shard、testOutcome、reportState、状態別件数を持つ。shard なしは `all` とする。SHA は `git rev-parse HEAD` で取得し、PR の head SHA を代用しない。

保存先は `$RUNNER_TEMP/loomake-ci-test-diagnostics`。`metadata.json`、`summary.md`、元レポートがあれば `test-report.json` だけを置く。artifact 名は `ci-tests-<run-id>-<attempt>-<os>-<shard>` とし、シャードの `/` を `-` にする。保存期間は調査用の初期値として7日を提案する。

要約は失敗20件と所要時間上位10件を表示し、各ファイル名・テスト名を200文字、全体を32KiB以内に収める。超過分の省略を表示する。状態別件数は全結果で計算し、一覧の省略で変えない。所要時間がない項目は値を推測しない。失敗メッセージの全文は要約へ転記せず、元レポートを参照する。

### 失敗後にも保存する

checkout と Node 準備の完了、文書判定の結果を条件に、キャンセルされていない実行でテスト後の診断処理を試みる。lint や型検査で止まった場合は、testOutcome が未実行でレポートがないことを記録する。checkout や Node 準備が失敗した場合とキャンセルされた実行について、診断の生成を保証しない。

生成と upload は別ステップにし、生成が失敗しても upload を試みる。保存対象がなければ警告を出す。品質コマンドに `continue-on-error` や再試行は付けない。CI 構成の既存試験は、本会話の明示承認に基づき、既存8条件を維持して診断2条件を加えるように期待値を更新する。品質を検査するテストの期待値は維持する。upload は既存の `.github/action-pins.json` にある固定 SHA の Action を使い、権限は増やさない。レポート以外の `.loomake` 内のファイルは保存しない。

checkout は毎回新しい作業ツリーで行い、レポートを cache や artifact から復元しない。もし実装時に古いレポートが残る経路が見つかった場合は、テスト開始前に対象ファイルを消す処理を入れ、回帰試験を追加する。

## Risks / Trade-offs

- ジョブの強制停止ではレポートを保存できない場合がある。通常のテスト失敗と区別し、保存がないことを成功の証拠にしない。
- テスト名は信頼せず、改行・表の区切り・HTML・Markdown の記号をエスケープして要約を作る。
- CI 全体の待ち時間の削減量は未計測。この変更では情報を保存し、実装後の調査で効果を確認する。

## Migration Plan

1. 診断スクリプトと fixture のテストを追加する。
2. quality に保存処理を接続し、`docs/dev/ci.md` に参照方法と保存期間を書く。
3. fixture を使うワークフローの契約試験で、テスト失敗後の生成と upload の条件を確かめる。
4. 変更を PR にした場合は `ci:all-os` で3OSの出力を確認する。リモートで未実行の確認は成功と報告しない。

戻すときは診断ステップとスクリプトを外す。テストコマンドと品質判定は元のままである。
