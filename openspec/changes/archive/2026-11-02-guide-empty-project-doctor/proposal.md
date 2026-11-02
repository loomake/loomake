# guide-empty-project-doctor

## Why

空のプロジェクトで `loomake init` のあとに `loomake doctor` を実行すると、package.json がないのに「形式・容量・読み取り権限を確認してください」と案内される。ファイルを用意するか commands を書き換える必要があることが伝わらない。Issue #282 項目 1 と、reweave の導入記録を引用した採用設計書 2・3 章に基づいて直す。

## What Changes

- doctor は package.json の不在をほかの読み取り・形式エラーから分け、該当する commands と script の名前、2 つの直し方を 1 件の問題として表示する（REQ-184）。
- init は package.json がない場合、commands を書き換えるまで doctor が test の script を問題として出すことを案内する（REQ-024）。
- init の npm の既定値、doctor の終了コード、不正な package.json に対する既存の案内を維持する。
- 空のプロジェクトでの init → doctor を、固定した PATH のフィクスチャで検証する。

## Non-goals

- Issue #282 の項目 2 以降で扱う tarball・未公開の間の導入手順・devcontainer の案内。
- Issue #286 のキューと spec-only、スキルの使い分けの案内。
- commands の既定値の削除・変更、新しい要件 ID の採番、品質コマンドの実行やネットワーク診断。
- 設定や既存テストを緩める変更、Issue #282 全体の完了。

## Impact

capability は doctor（REQ-184）と init（REQ-024）の MODIFIED のみ。製品コードは `packages/kit/src/doctor/doctor.ts` と `packages/kit/src/init/init.ts`、試験は `packages/cli/test/doctor.test.ts`・`packages/cli/test/init.test.ts` と init → doctor の統合テスト。段階は L3 で、実装は #285 の PR のマージ後に始める。
