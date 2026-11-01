# C001 の原本入力

C001 の原47契約・158 Scenario・46 unique Sourceを復元するための14文書を、`scripts/trusted/original-c001/specs/` に保存する。製品が現在満たすべき仕様は `openspec/specs/` と進行中の各 change で管理する。この入力は原集合との照合用であり、旧文書の全句を現在の採用済み仕様へ戻すものではない。

出典はローカルの原 commit `bb88fe238ab0254e34d25dd8caeb19e8d0155cc4` にある `openspec/changes/verify-v2-c001/specs/` の14文書である。管理役は全78,363バイトについて、元の Git blob・sha256・バイト長との一致を実測した。commit 本文や作者情報は保存しない。元の16横断条件と現 owner・採否・試験の対応は、S1 の残タスクで扱う。

2026-11-01 の空 repository からの実測では、GitHub からこの SHA を fetch する操作は `not our ref`、終了128となった。通常の CI や新規 clone が原 commit を持っているとは仮定せず、入力文書そのものを配置する。この配置は、原 commit が特定の tree を指すことの暗号学的証明ではない。

## 入力を変えずに検査する

`tests/c001-original-input.test.ts` は14件の path 集合と、各ファイルの全バイト・mode・Git blob・sha256を固定値と照合し、全47契約・158 Scenario・46 Sourceを確認する。原 commit object のない新規 repository、dirty checkout、shallow clone と autocrlf のある checkout でも、固定した commit の Git object から同じ本文を読めることを確かめる。作業ファイルの改行に依存しない。

この準備だけで S1、C001、独立した trusted 判定の受入を完了にしない。S1 の controller は基準 A の Git object と基準側で構築した manifest・検証器から入力を照合する。対象側のコピーで基準を選び直さず、原集合と元16条件を保持する。未実測の能力、通常の完了ゲート・必須 CI・3 OS・独立レビューは残る。

これは ADR 0005 に従うリポジトリ内の入力準備で、製品コード・公開 API・JSON・配布物・既存の仕様と試験・設定を変更しない。原文書はバイトを変えずに保存し、説明文の推敲を原文書へ適用しない。
