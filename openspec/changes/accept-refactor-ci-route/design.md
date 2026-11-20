# Design

## Context

動機と範囲は proposal.md にある。先例は spec-fix の経路（archive の `2026-11-05-accept-spec-fix-ci-route`）で、宣言の読み方・評価する段階・失敗の案内の形をそろえる。新しい依存やワークフローの変更は要らない。

## Goals / Non-Goals

条件の判定を `scripts/ci-refactor.mjs` に分け、gate の L3 の拒否分岐から呼ぶ。L1・L2 と change のある L3 の処理は変えない。振る舞いが変わっていないことは機械では判定せず、独立レビューで確かめる。

## Decisions

- **評価する段階**：spec-fix と同じく、L3 で `loomake-change: none` を明示したときだけ評価する。L2 はもともと change なしで進められるので、宣言があっても判定を変えない。
- **経路の選び方**：`loomake-route:` の行のどれかが大文字小文字を区別せず `refactor` なら、リファクタの判定に進む。ほかの値（`spec-fix` や空を含む）が混じれば、食い違いとして理由に示して拒む。`refactor` が一つもなければ、今までどおり spec-fix の判定に進む。こうすると、spec-fix と同時に名乗る宣言はどちらの経路でも通らない。
- **`openspec/` の変更**：spec-fix と同じく、raw diff の変更前と変更後のパスのどちらかが `openspec/` で始まれば拒む。
- **テストファイルの範囲**：`tests/` と `packages/<名前>/test/` の下のすべてのファイルに、ルートの `vitest.config.ts` を加える。根拠は次のとおり。
  - vitest が実行する試験は `tests/**/*.test.ts` と `packages/*/test/**/*.test.ts` にある（`vitest.config.ts` の include）。
  - 同じ場所に、試験の結果を左右する補助と fixture が置かれている。例：`tests/helpers/`、`tests/fixtures/`、`packages/kit/test/project.ts`、`packages/runner/test/helpers.ts`、`packages/cli/test/cli-baseline.ts`、`packages/*/test/fixtures/`。隔離一覧 `tests/quarantine.json` と分割の一覧 `tests/test-partition.json` も `tests/` にある。
  - `vitest.config.ts` は実行する試験の範囲と除外を決める。変えれば、試験ファイルに触れずに試験を実行から外せる。
  - 承認の趣旨は、既存の試験を弱めずに振る舞いが変わらないことを示すことにある。`*.test.ts` に限ると、補助や fixture、設定の書き換えで期待値を緩められる。
- **既存かどうかの判定**：raw diff の状態が `A`（追加）以外で、変更前のパス（名前の変更なら元のパス）がテストファイルの範囲にあれば、既存のテストファイルを変えたと数える。`M`・`T`・`D` と範囲内からの `R` が当たる。範囲外から範囲内への名前の変更は、範囲内では新しいファイルなので数えない。gate の差分は `-M` だけで `-C` を使わないので、`C` は出ない。
- **独立レビューの証跡**：PR 本文の `## 証跡` の節（`scripts/process-evidence.mjs` の `evidenceSection` で取り出す）に、状態が `実施済み` の `review:` の行が 1 つ以上あることを求める。行の項目の形（`round`・`by`・`session`・`model`・`head`・件数）は、同じ gate の工程行の検査が L2・L3 で調べる。重大の件数がゼロであること、レビュー担当が実装担当と別であること、`head=` がマージする head と一致することは、spec-fix と同じく機械では判定せず、管理役がマージ前に確かめる。
- **失敗の案内**：spec-fix と同じく「L3 では change が必須です」に「リファクタとして受け付けません：」と不足する条件をすべて続ける。成立したときは、品質コマンドの理由に「リファクタ（振る舞いを変えない整理）」と書く。
- **関数の大きさ**：新しく書く関数は本体を 5 行以内にする。gate の本体の分岐は既存のコードで、経路の選択を足すのに必要な行だけを変える。

## Risks / Trade-offs

- テストの追加で振る舞いを固定したかどうか、リファクタが本当に振る舞いを変えていないかは機械では分からない。独立レビューと既存のテスト・3 OS の CI で確かめる。
- 既存のテストファイルの範囲を広く取ったので、補助の小さな修正も既存のテストファイルの変更として拒む。必要なら change を持つ通常の L3 で進める。
- 本文の宣言は行単位で読み、Markdown のフェンスを区別しない（spec-fix と同じ）。証跡の節はフェンスの中の行も読む（工程行の検査と同じ）。

## Migration Plan

この change は通常の L3 として受け入れる。main へのマージ後に、リファクタの PR が `loomake-route: refactor` を使える。公開 API と package の配布物は変えない。
