# Tasks

## 1. 仕様と再現の準備

- [x] 1.1 main 03ff605の無変更生成器をLinuxの親ディレクトリsymlink経由で実行し、物理パスとの差を確認する。proposal・差分仕様・design・traceを揃える
- [x] 1.2 既存REQ-321の本文とScenarioが保持され、新しい起動例とimportの例に対応することを照合し、OpenSpec strictと `pnpm -s verify --change fix-reference-entrypoint-paths --spec-only` を成功させる

## 2. 入口判定と回帰試験

- [x] 2.1 tests/quality-reference.test.tsへREQ-321付きの子プロセス試験を追加する。POSIXの親symlinkとWindowsのjunctionで、欠落check1・不明引数2・生成0・一致check0・改変check1と非書込、別cwdでの生成先、importの無副作用を確かめ、未修正の生成器でリンク経由のケースが失敗することを確認する
- [x] 2.2 scripts/generate-quality-reference.mjsの入口判定で同じ実体のパスを比較する。既存の生成・引数処理を保ち、追加試験と既存のqualityリファレンス試験を成功させる。既存の期待値・skip・品質設定・未マージCLI生成器に差分がないことを確認する

## 3. 統合確認

- [x] 3.1 strict・関連試験・生成物checkと `pnpm -s verify --change fix-reference-entrypoint-paths --done` を成功させる。生成内容の不変、REQ-321の対応試験と全タスクを照合し、対象headの必須CI（macOS/Windowsを含む）と独立レビューを確認する <!-- loomake:gate=done -->

## Workflow follow-up

- 対象headの受入後に、管理役が変更範囲と承認を確認してマージ、仕様反映・archiveへ進む。公開・リリースは含めない。
