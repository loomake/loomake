# Trace: move-dev-mechanics-to-docs

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 依頼者の指示（作業の担当とのチャット）：リポジトリの開発の仕組みを製品の仕様から外し、`docs/dev/` の説明と ADR に移す。分け方の基準、REQ-049 を扱わないこと、テストは消さずに名前から要件 ID だけを外すこと | - | 2026-10-28 |
| 利用者の承認：「おすすめで進めて」 | - | 2026-10-28 |
| openspec/specs/monorepo/spec.md（24 個の Requirement） | - | 2026-10-28 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-004 | 要件定義書 v0.1 §2 対象 4 行目、依頼者の指示（2026-10-28） | 前提 | 対象：モノレポ `loomake/loomake` の雛形と devcontainer | 反映済 | specs/monorepo/spec.md（REMOVED。移し先は docs/dev/devcontainer.md） |
| REQ-061 | 要件定義書 v0.2 §7 4 項目目、依頼者の指示（2026-10-28） | 制約 | 開発環境は devcontainer（Node 24）を標準とする | 反映済 | specs/monorepo/spec.md（REMOVED。移し先は docs/dev/devcontainer.md） |
| REQ-215 | 利用者の依頼（2026-10-26）、依頼者の指示（2026-10-28） | 非機能 | CI の実行時間を短くする。同じ PR に新しい push があれば、古い CI の実行を取り消す。main への push の実行は取り消さない | 反映済 | specs/monorepo/spec.md（REMOVED。移し先は docs/dev/ci.md） |
| REQ-236 | Issue #5 の本文と調査結果のコメント（change A）、依頼者の指示（2026-10-28） | 非機能 | Windows の quality で落ちる既存のテストのうち、テストの前提が原因のものを、期待値を変えず skip もせずに直す | 反映済 | specs/monorepo/spec.md（REMOVED。移し先は docs/dev/testing-across-os.md） |
| REQ-240 | Issue #5 の調査結果の ④⑤ と change B、依頼者の指示（2026-10-28） | 非機能 | Windows でも動く偽の CLI を作る。偽の CLI が狙った段階に届いた印を先に確かめてから、期限・終了コードを確かめる | 反映済 | specs/monorepo/spec.md（REMOVED。移し先は docs/dev/testing-across-os.md） |

## 振り分け

monorepo の 24 個の Requirement を、次の基準で分けた。利用者や配布物に影響するものは残す。リポジトリの開発者だけに効くものは外して `docs/dev/` に移す。迷うものは残し、確認事項に書く。

| # | Requirement | Source | 判断 | 理由 |
|---|---|---|---|---|
| 1 | モノレポのパッケージ構成 | REQ-001〜003, REQ-060 | 残す | 配布するパッケージと `bin` の名前を決める |
| 2 | devcontainer | REQ-004, REQ-061 | **外す** | このリポジトリの開発環境。docs/dev/devcontainer.md へ |
| 3 | Node.js のバージョン宣言 | REQ-142 | 残す | 配布物の対応範囲の宣言 |
| 4 | 3 つの OS での CI | REQ-049 | 残す（後続で外す候補） | change run-other-os-after-merge が MODIFIED にしているので今回は扱わない（Q-01） |
| 5 | プルリクエストごとの完了ゲート | REQ-010, REQ-054, REQ-132 | 残す（迷う） | 完了ゲートは Loomake の進め方の中心。Q-02 |
| 6 | changesets による公開準備 | REQ-056 | 残す | 公開の品質ゲート |
| 7 | MIT ライセンス | REQ-057 | 残す | 配布物のライセンス |
| 8 | 完了ゲートの対象の決め方 | REQ-132 | 残す（迷う） | Q-02 |
| 9 | 対象の change がない PR の扱い | REQ-132 | 残す（迷う） | Q-02 |
| 10 | 配布物からの主要コマンドの検証 | REQ-143 | 残す | 配布物そのものを検証する |
| 11 | 対応環境での配布物の検証 | REQ-144 | 残す（迷う） | 配布物の対応環境の確認。CI の組み方も含む。Q-03 |
| 12 | 公開対象コミットの品質ゲート | REQ-145 | 残す | 公開の品質ゲート |
| 13 | 公開するexportsの参照先 | REQ-146 | 残す | 配布物の exports |
| 14 | 公開するパッケージのメタデータ | REQ-138 | 残す | 配布物のメタデータ |
| 15 | パッケージの README | REQ-139 | 残す | 配布物の README |
| 16 | release ワークフローの品質検査と同時実行の制限 | REQ-140 | 残す | 公開の品質ゲート |
| 17 | release ワークフローの認証 | REQ-141 | 残す | 公開の認証 |
| 18 | release ワークフローの権限の分離 | REQ-143 | 残す | 公開の権限 |
| 19 | release ワークフローの action の固定 | REQ-143 | 残す | 公開の action の固定 |
| 20 | kit の中の依存の向き | REQ-207 | 残す | パッケージの中の依存の向き（REQ-046・047・083・123 系） |
| 21 | CI のテストの分割 | REQ-214 | 残す（後続で外す候補） | change shorten-ci-wall-clock が MODIFIED にしているので今回は扱わない（Q-01） |
| 22 | PR の古い CI 実行の取り消し | REQ-215 | **外す** | このリポジトリの CI の仕組み。docs/dev/ci.md へ |
| 23 | OS によらないテストの前提 | REQ-236 | **外す** | テストの書き方の前提。docs/dev/testing-across-os.md へ |
| 24 | 外部操作の期限の試験の偽の CLI | REQ-240 | **外す** | テストの作り方の決まり。docs/dev/testing-across-os.md へ |

monorepo 以外の capability では、development-decisions の「開発効率の手書きの記録様式」と「C-001 の事前見積もり」が、同じ種類（開発者だけに効くもの）にあたる。PR を 1 日でマージできる大きさに保つため、今回は扱わない（Q-04）。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-049, REQ-214 | 「3 つの OS での CI」と「CI のテストの分割」も開発の仕組みだが、進行中の change（run-other-os-after-merge と shorten-ci-wall-clock）が MODIFIED にしている。いま REMOVED にすると、先の change の archive が失敗する。いつ外すか | A: 2 つの change の archive のあとに、別の change で外す / B: 今回いっしょに外し、2 つの change の差分仕様を書き直してもらう | A。進行中の作業を止めずに済む。shorten-ci-wall-clock が足す「文書だけの PR の品質ジョブ」などの 3 個（REQ-270）と、PR #108（run-other-os-after-merge）が足す `ci:all-os` ラベルの Requirement（REQ-273）も、同じ change で外す候補にする。この change では shorten-ci-wall-clock を archive しない（PR #108 が archive する） | no | A（依頼者の指示「REQ-049 は今回は扱わない」と、利用者の「おすすめで進めて」による） | 依頼者（作業の担当） | 2026-10-28 |
| Q-02 | REQ-010, REQ-054, REQ-132 | 完了ゲートの 3 個（プルリクエストごとの完了ゲート、対象の決め方、対象の change がない PR の扱い）は、いまは `scripts/ci-gate.mjs` で、このリポジトリの中だけで動く。利用者に reusable workflow として配ってはいない。残すか | A: 残す / B: 外して docs/dev に移す | A。完了ゲートは Loomake の進め方の中心で、利用者の案内（docs/guide/4.concepts/1.positioning.md）にも出てくる。利用者に配るときに仕様がないと困る。迷うものは残す基準にも合う | no | A（利用者の「おすすめで進めて」による） | 依頼者（作業の担当） | 2026-10-28 |
| Q-03 | REQ-144 | 「対応環境での配布物の検証」は、配布物が対応環境で動くことの確認と、CI の組み方（3 つの OS、過去の下限の Node 20.19.0 での追加の確認）が混ざっている。残すか | A: 残す / B: 配布物の約束と CI の組み方に分け、CI の組み方を外す | A。配布物の対応環境にかかわるので、迷うものは残す基準に合う。B は REQ-049 を外す change でいっしょに考える | no | A（利用者の「おすすめで進めて」による） | 依頼者（作業の担当） | 2026-10-28 |
| Q-04 | - | development-decisions の「開発効率の手書きの記録様式」と「C-001 の事前見積もり」も開発者だけに効く。外すか | A: 後続の change で外す / B: 今回いっしょに外す | A。今回の PR を 1 日でマージできる大きさに保つ | no | A（利用者の「おすすめで進めて」による） | 依頼者（作業の担当） | 2026-10-28 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-004, REQ-061, REQ-215, REQ-236, REQ-240 | 外す要件 ID を名前に入れていた 17 か所の試験は、消さずに残し、名前からその要件 ID だけを外す。期待値と処理は変えない | 試験は開発の仕組みを守るために残す。完了ゲートの「要件ごとのテスト」は、change の ADDED と MODIFIED の Requirement の Source だけを数えるので、名前を変えても影響しない | 承認（依頼者の指示による） | 依頼者 | 2026-10-28 |
| A-02 | REQ-004, REQ-061, REQ-215, REQ-236, REQ-240 | 要件台帳の状態は「反映済」にし、反映先に REMOVED と移し先を書く | 仕様から外すことを、この change で反映するため。新しい要件 ID は振らない | 承認（利用者の「おすすめで進めて」による） | 依頼者 | 2026-10-28 |
| A-03 | - | `docs/quality/scenarios.json` の、外した Scenario（10 件）のレビューは、この change では消さない。次に Scenario の監査をするときに外す | scenarios.json は監査のときの記録で、試験のファイルのハッシュも監査のたびに更新している。CI と完了ゲートは scenarios.json を読まない | 承認（利用者の「おすすめで進めて」による） | 依頼者 | 2026-10-28 |
