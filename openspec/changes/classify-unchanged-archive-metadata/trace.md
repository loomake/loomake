# Trace: classify-unchanged-archive-metadata

状態：UNAPPROVED。提案文書の反映は実装・規則承認・DoD 達成を意味しない。

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| main の monorepo 仕様・AGENTS.md・CI 判定と既存試験 | 3a54614e | 2026-11-01 |
| #238 の archive 準備差分 | da72cf88、未公開・未適用 | 2026-11-01 |
| Opus 改訂設計（専用 tree の `.loomake/claude/5ecd33d1-be58-4a57-8ebc-4da703bcc384/result.md`） | root が全文確認した未承認設計 | 2026-11-01 |
| [REQ-362 中央予約](https://github.com/loomake/loomake/issues/121#issuecomment-6551110472) | root から指定された予約出典。承認ではない | 2026-11-01 |
| archive スキルの命名規則・保存条件とインストール済み CLI archive.js | スキル176・212行、CLI28・1331〜1333行を読取確認 | 2026-11-01 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-362 | Opus 改訂設計3章と中央予約（入力文書参照） | 機能 | 完全 OID が同じ通常 metadata の対応する archive への R100 移動を、同 archive の文書追加など全条件つきで L1 と数える提案 | 確認待ち | specs/monorepo/spec.md の ADDED |
| REQ-342 | main monorepo「工程の段階の判定」 | 変更 | L1 の対象行だけで新例外を参照する提案。ほかの本文と既存13 Scenario は原文保持 | 確認待ち | specs/monorepo/spec.md の MODIFIED |
| REQ-270 | main monorepo の既存 Requirement | 関連 | 文書許可リスト、全差分による判定と main push の品質検査を維持する | 既存仕様で充足 | 既存の主仕様。変更しない |
| REQ-281 | main monorepo の既存 Requirement | 関連 | 不安全なパス・名前の衝突・ツリー読取失敗の拒否を維持する | 既存仕様で充足 | 既存の主仕様。変更しない |
| REQ-282 | main monorepo の既存 Requirement | 関連 | 通常ファイル以外の両側 mode の拒否を維持する | 既存仕様で充足 | 既存の主仕様。変更しない |
| REQ-343 | main monorepo の既存 Requirement | 関連 | 段階ごとの gate の動作と L3 none の拒否を維持する | 既存仕様で充足 | 既存の主仕様。変更しない |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q1 | REQ-362, REQ-342 | 限定 metadata 移動を L1 と数え、PR quality の lint/typecheck/test/build/配布物検査を省略し、対象 change のない gate は lint/doc-links だけにする新範囲と AGENTS 最小追記を承認するか | A: この具体案を承認 / B: L2 のまま品質検査 / C: 採用しない | A。R100、完全OID同一、両側100644、対応する日付archive、安全なパス、同archiveへの文書追加に限る。main push・主仕様strict・重複検査・元のDoDは維持する。Q2〜Q5と proposed/AGENTS.md.patch を含む新しい規則承認を求める | yes |  |  |  |
| Q2 | REQ-362 | 内容不変をどこまで照合するか | A: 完全 blob OID を照合 / B: R100 だけ | A。merge-base の旧パスと HEAD の新パスを照合し、不明なら例外にしない設計提案 | no |  |  |  |
| Q3 | REQ-362 | 同じ archive へ文書を足すか移すことを条件にするか | A: 条件にする / B: しない | A。metadata 単独で主仕様変更を L1 にする経路を防ぐ設計提案 | no |  |  |  |
| Q4 | REQ-362, REQ-342 | AGENTS の L1 対象行をどう合わせるか | A: proposed の最小追記 / B: 追記しない | A。未適用パッチを Q1 の規則承認範囲に含める提案 | no |  |  |  |
| Q5 | REQ-362 | 日付prefix外の id と既存の日付付き id をどう対応させるか | A: スキルとCLIに合わせる / B: 別規則 | A。厳密な YYYY-MM-DD- prefix は同名、ほかは実在日付を付与。2026-1-01-c1 はprefix外、0050年も実在日なら受け入れる設計提案 | no |  |  |  |
| Q6 | REQ-362 | ADDED の所有 ID をどうするか | A: 予約済み REQ-362 のみ / B: 別 ID | A。入力文書の中央予約を用い、REQ-342 を重ねない提案。予約を承認回答とは扱わない | no |  |  |  |

Q1 は規則と品質コマンドの省略範囲への新しい明示承認が必要なので、ADR 0006 のおすすめ採用で回答を代筆しない。Q2〜Q6 は Q1 にまとめて提示する設計の構成要素であり、非 blocking としたことは回答や承認を意味しない。採用案が変われば全 artifact を更新して再レビューする。#260・過去の archive・Opus 設計は承認の出典に流用しない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

仮定による振る舞いの補完はしない。未承認の設計を仕様の正として実装しない。

## 読取確認

archive 案の `.openspec.yaml` は前後とも完全 blob ID `25002a8e8151998b10d369d4a0ccd578f8ba97f9`、モード100644、R100 と確認した。これは対象例の事実確認であり、Q1 の承認でも CI の成功でもない。

要件本文の字数、strict と仕様ゲートの結果は `.loomake/handoff/archive-metadata-proposal-2026-11-01.md` に記録する。実装と回帰試験は未着手のまま残す。
