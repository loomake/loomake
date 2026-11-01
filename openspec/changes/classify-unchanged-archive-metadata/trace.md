# Trace: classify-unchanged-archive-metadata

状態：規則案は2026-11-01に利用者が明示承認。実装・CI・独立レビュー・main採用は別に確認し、採用前は適用しない。

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| main の monorepo 仕様・AGENTS.md・CI 判定と既存試験 | 3a54614e | 2026-11-01 |
| #238 の archive 準備差分 | da72cf88、未公開・未適用 | 2026-11-01 |
| Opus 改訂設計（専用 tree の `.loomake/claude/5ecd33d1-be58-4a57-8ebc-4da703bcc384/result.md`） | root が全文確認した設計。今回の利用者承認は次行 | 2026-11-01 |
| [REQ-362 中央予約](https://github.com/loomake/loomake/issues/121#issuecomment-6551110472) | root から指定された予約出典。承認ではない | 2026-11-01 |
| archive スキルの命名規則・保存条件とインストール済み CLI archive.js | スキル176・212行、CLI28・1331〜1333行を読取確認 | 2026-11-01 |
| [利用者の具体承認](https://github.com/loomake/loomake/issues/121#issuecomment-6551682665) | 本セッション call_795144b5c6064684b88db0e5b95ce894 の回答原文。詳細は実装treeの ignored user-approval.json | 2026-11-01 JST |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-362 | Opus 改訂設計3章と中央予約（入力文書参照） | 機能 | 完全 OID が同じ通常 metadata の対応する archive への R100 移動を、同 archive の文書追加など全条件つきで L1 と数える提案 | 反映済 | specs/monorepo/spec.md の ADDED |
| REQ-342 | main monorepo「工程の段階の判定」 | 変更 | L1 の対象行だけで新例外を参照する提案。ほかの本文と既存13 Scenario は原文保持 | 反映済 | specs/monorepo/spec.md の MODIFIED |
| REQ-270 | main monorepo の既存 Requirement | 関連 | 文書許可リスト、全差分による判定と main push の品質検査を維持する | 既存仕様で充足 | 既存の主仕様。変更しない |
| REQ-281 | main monorepo の既存 Requirement | 関連 | 不安全なパス・名前の衝突・ツリー読取失敗の拒否を維持する | 既存仕様で充足 | 既存の主仕様。変更しない |
| REQ-282 | main monorepo の既存 Requirement | 関連 | 通常ファイル以外の両側 mode の拒否を維持する | 既存仕様で充足 | 既存の主仕様。変更しない |
| REQ-343 | main monorepo の既存 Requirement | 関連 | 段階ごとの gate の動作と L3 none の拒否を維持する | 既存仕様で充足 | 既存の主仕様。変更しない |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q1 | REQ-362, REQ-342 | 限定 metadata 移動を L1 と数え、PR quality の lint/typecheck/test/build/配布物検査を省略し、対象 change のない gate は lint/doc-links だけにする新範囲と AGENTS 最小追記を承認するか | A: この具体案を承認 / B: L2 のまま品質検査 / C: 採用しない | A。R100、完全OID同一、両側100644、対応する日付archive、安全なパス、同archiveへの文書追加に限る。main push・主仕様strict・重複検査・元のDoDは維持する。Q2〜Q5と proposed/AGENTS.md.patch を含む新しい規則承認を求める | yes | A。この具体案とAGENTS最小追記を承認。品質省略は提案の限定条件だけ。main push・strict・重複検査・元DoDを維持し、通常L3のCI・3OS・独立レビューとmain採用後から適用する。入力文書の具体承認記録を参照。 | 利用者（2026-11-01 本セッション、call_795144b5c6064684b88db0e5b95ce894への回答） | 2026-11-01 |
| Q2 | REQ-362 | 内容不変をどこまで照合するか | A: 完全 blob OID を照合 / B: R100 だけ | A。merge-base の旧パスと HEAD の新パスを照合し、不明なら例外にしない設計提案 | no | A。merge-baseの旧パスとHEADの新パスの完全blob OIDを照合し、失敗・不明・不一致は例外不成立とする。Q1の承認範囲。 | 利用者（2026-11-01 本セッション、call_795144b5c6064684b88db0e5b95ce894への回答） | 2026-11-01 |
| Q3 | REQ-362 | 同じ archive へ文書を足すか移すことを条件にするか | A: 条件にする / B: しない | A。metadata 単独で主仕様変更を L1 にする経路を防ぐ設計提案 | no | A。同じarchiveへの別文書の追加または移動を必要とし、metadata単独は例外にしない。Q1の承認範囲。 | 利用者（2026-11-01 本セッション、call_795144b5c6064684b88db0e5b95ce894への回答） | 2026-11-01 |
| Q4 | REQ-362, REQ-342 | AGENTS の L1 対象行をどう合わせるか | A: proposed の最小追記 / B: 追記しない | A。未適用パッチを Q1 の規則承認範囲に含める提案 | no | A。proposed/AGENTS.md.patchのL1対象セルへの最小追記だけを反映する。Q1の承認範囲。 | 利用者（2026-11-01 本セッション、call_795144b5c6064684b88db0e5b95ce894への回答） | 2026-11-01 |
| Q5 | REQ-362 | 日付prefix外の id と既存の日付付き id をどう対応させるか | A: スキルとCLIに合わせる / B: 別規則 | A。厳密な YYYY-MM-DD- prefix は同名、ほかは実在日付を付与。2026-1-01-c1 はprefix外、0050年も実在日なら受け入れる設計提案 | no | A。既存の厳密日付prefixは同名、それ以外のidは実在日付を付与する。二重日付を拒否し、0050年とprefix外idを区別する。Q1の承認範囲。 | 利用者（2026-11-01 本セッション、call_795144b5c6064684b88db0e5b95ce894への回答） | 2026-11-01 |
| Q6 | REQ-362 | ADDED の所有 ID をどうするか | A: 予約済み REQ-362 のみ / B: 別 ID | A。入力文書の中央予約を用い、REQ-342 を重ねない提案。予約を承認回答とは扱わない | no | A。予約済みREQ-362だけをADDEDのSourceに割り当てる。Q1が承認した具体案と入力文書の中央予約に従う。 | 利用者（2026-11-01 本セッション、call_795144b5c6064684b88db0e5b95ce894への回答） | 2026-11-01 |
| Q295-TREE-01 | REQ-362, REQ-281, REQ-342, REQ-343 | HEADの名前衝突条件をgateにも適用するか | A: gateも同じtree安全性を確認 / B: REQをquality限定へ変更 | A。元の承認済みAND条件を全呼出側で守る修理 | yes | A。管理役が採用。候補と確定集合を分け、qualityの読取順・回数・失敗時fallbackを保持する。Bは禁止。 | 管理役Codex（2026-11-01本セッション） | 2026-11-01 |
| Q295-TREE-02 | REQ-362, REQ-281 | 成功した空treeと移動先がないtreeをどう扱うか | A: 移動先存在を追加条件にする / B: 存在は確かめず衝突なしだけを確認 | B。AはREQ本文にない追加条件で、仮定による補完をしない方針を守る | yes | B。管理役が採用。成功した空出力は既存と同じ[]、読取・形式失敗と証明未指定はundefinedで例外不成立。sameBlobはHEAD:toの完全OIDを照合済み。実Git整合性を新要件へ広げない。 | 管理役Codex（2026-11-01本セッション） | 2026-11-01 |

Q1は利用者本人の具体承認を記録した。Q2〜Q6は承認した具体案の構成と予約済みIDの反映であり、非blockingや包括承認だけから承認済みにしたものではない。承認質問・回答原文をignored証拠へ保存し、GitHubの記録も入力文書から参照する。#260・過去のarchive・Opus設計は今回の承認に流用しない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

仮定による振る舞いの補完はしない。利用者が承認した具体案の範囲だけを仕様ゲート後に実装し、main採用前は他PRへ適用しない。

## 読取確認

archive 案の `.openspec.yaml` は前後とも完全 blob ID `25002a8e8151998b10d369d4a0ccd578f8ba97f9`、モード100644、R100 と確認した。これは対象例の事実確認であり、Q1 の承認でも CI の成功でもない。

【提案時点の記録】要件本文の字数、strict と仕様ゲートの結果は `.loomake/handoff/archive-metadata-proposal-2026-11-01.md` に記録する。実装と回帰試験は未着手のまま残す。

現在は[Draft PR #295](https://github.com/loomake/loomake/pull/295)で実装・回帰試験と通常のローカル完了ゲートを済ませている。新しいCI・独立Opusレビュー・main採用は未完了であり、採用前は他PRへ適用しない。

## 完了ゲートと外部受入の分離

管理役は2026-11-01本セッションで、5.2のCI・レビュー・main採用をgate前checkboxへ入れる循環の修理を承認した。5.2は証跡とworklogの準備にし、元5.2の通常CI・3OS・独立Opus・main採用条件をWorkflow follow-upへ原文保持する。DoDと適用開始を免除する変更ではない。

## HEAD tree安全性の修理

管理役が採用したOpus設計（専用treeの `.loomake/claude/b60a74ff-32c1-4517-8c1a-bd04ae7f2149/result.md`）に従い、既存task 2〜5を再開する。Q295-TREE-01/02の回答は上表に記録した。Requirement・Scenario・規則・外部受入条件は変えず、修理後の通常localdoneと新しいCI・独立レビュー・main採用を別に確認する。旧headの成功は修理後へ流用しない。
