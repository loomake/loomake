# Trace: collect-tool-evidence

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/wbs/baseline-v1.4.md §W1-6（118行）・docs/architecture.md §0.1・3・docs/requirements/loomake-v0.11.md §NFR-09 | 固定要件 | 2026-11-06 |
| .loomake/claude/34fddb45-e9d6-4ad2-b461-7c1c6797fda9/result.md §3〜9 と manifest.json | actual claude-opus-5-5 最終補足設計、ok:true、旧 d93 を置換 | 2026-11-06 |
| .loomake/design65-p2/material-supp-final.md・manifest・verification、supplement/ | 設計対象 db893f0 の固定材料、最終設計の参照資料 | 2026-11-06 |
| .loomake/source65/p2-primary/manifest.json と固定版 source 4 件 | gh 2.103.0・Codex 0.166.0・Biome 2.6.5・Playwright 1.64.1、Claude stream-json の欄の型のみ | 2026-11-06 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-448 | W1-6・architecture.md §0.1・3、最終補足設計 §3・6 | 機能 | 5 ツールの出力を固定した分類と型へ純粋変換し、不正な形は安全な ParseError にする | 反映済 | specs/tool-evidence/spec.md |
| REQ-449 | W1-6・REQ-180・182、最終補足設計 §4・6 | 機能 | 共有予算内の 1 回の起動を 5 種類に分類し、終了状態と payload を分け、3 つの引数生成関数を公開する | 反映済 | specs/tool-evidence/spec.md |
| REQ-450 | NFR-09・REQ-118・199・447、最終補足設計 §5・6 | 非機能 | observation と診断全文を保存前に置換し、reason・例外にも既知の秘密を残さず保証の限界を書く | 反映済 | specs/tool-evidence/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-P2-01 | REQ-448 | 独立 API の capability をどこへ置くか（最終設計 §2） | A 新規 tool-evidence / B 既存 verify | A：P3 との編集重複を避ける | yes | A。ADR 0006 の管理判断で採用 | 管理役 root（利用者の包括承認） | 2026-11-06 |
| Q-P2-02 | REQ-449 | AI の argv の安全な受理範囲が help で確定しない | A 制限つき builder / B AI builder なし / C stdin 追加 | B：--・コマンド名衝突・sandbox 既定の根拠不足 | yes | B。5 ツールの parser/collector はすべて実装し、AI args は利用者が渡す。ADR 0006 | 管理役 root（利用者の包括承認） | 2026-11-06 |
| Q-P2-03 | REQ-449 | 外部実行の期限をどう指定するか | A timeoutMs 必須・untilDeadline:true / B 既定 30 秒 | A：明示期限と共有予算を使う | yes | A。REQ-180 の列挙は変えない。ADR 0006 | 管理役 root（利用者の包括承認） | 2026-11-06 |
| Q-P2-04 | REQ-450 | maskValue が例外を投げたときの分類 | A 固定文 unreadable / B 例外を通す | A：値を漏らさない | yes | A。mock で検証する。ADR 0006 | 管理役 root（利用者の包括承認） | 2026-11-06 |
| Q-P2-05 | REQ-448 | Playwright の test.status と expectedStatus の優先順位 | A status を先に見る / B expectedStatus を先に見る | A：flaky・期待した失敗を passed にしない | yes | A。最終設計 §3.6 の表を仕様に収める。ADR 0006 | 管理役 root（利用者の包括承認） | 2026-11-06 |
| Q-P2-06 | REQ-449 | Playwright の出力先 env の扱い | A 子 env の 3 変数だけ除外 / B config も変更 | A：固定 source base.ts:663/669/677 と一致し、設定を保つ | yes | A。win32 は大小区別なし、POSIX は完全一致。ADR 0006 | 管理役 root（利用者の包括承認） | 2026-11-06 |
| Q-P2-07 | REQ-449 | collect の依存方向をどう検査するか | A 既存禁止配列に collect 追加 / B REQ-207 を変更 | A：既存規則で検査でき、強化になる | yes | A。既存の検査項目を保持する。ADR 0006 | 管理役 root（利用者の包括承認） | 2026-11-06 |
| Q-P2-08 | REQ-448, REQ-449 | 最終設計 §7 の minor 表記と ADR 0002 が矛盾する | A core/kit patch / B minor | A：既存 API を壊さない追加は patch（ADR 0002） | yes | A。最終設計の表記を上書きし patch を採用。ADR 0002・0006、管理役の明示指示 | 管理役 root（利用者の包括承認） | 2026-11-06 |

日付はすべて日本時間。決定者は管理役 root で、利用者本人の個別レビューとは区別する。根拠は docs/adr/0006-standing-approval-for-autonomous-delivery.md の「決定」と、最終補足設計 §2。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

新しい仮定はない。全 REQ に曖昧さチェックリストの言葉・入出力・振る舞い・非機能・文書間の観点を当て、外部連携と受入数値は Q-P2-01〜08 で決定した。

## 品質の定義

| 要件 | 目的 | 利用状況 | 受け入れ条件 | 計測方法 | 副特性 | 出典・確認事項 |
|---|---|---|---|---|---|---|
| REQ-448 | 出力を中立型へ変換する | 固定版資料からの合成入力 | 全 5 parser の分類・境界・未知欄・30 Scenario 中の対応分を満たす | core/test/tool-output の ID つき試験 | 機能正確性 | 最終設計 §3・6、Q-P2-05 |
| REQ-449 | 実行と解析の事実を区別する | Node の合成子プロセス | 5 分類・1 回起動・共有予算・入力検査・env を満たす | kit/test/collect の ID つき試験 | 信頼性 | 最終設計 §4・6、Q-P2-02・03・06・07 |
| REQ-450 | 返す証拠の既知秘密を置換する | stdout・stderr・reason・例外 | 既知パターンが残らず、4096 文字の末尾がサロゲートを分断しない | 結果 JSON と例外を既知パターンで検査 | 機密性 | 最終設計 §5・6、Q-P2-04 |

## 出典の限界と後段

Claude --output-format json の実 fixture は未観測で、stream-json の result の欄の型と版を固定していない docs を基に合成する。Biome CI 上の stdout 純 JSON と JSON reporter への max-diagnostics 適用は未確認で、全件診断は保証しない。追加 AI 実行・tool install・auth は行わない。

設計 §6 の全 30 Scenario は仕様に保持し、各 Requirement の Source はそれぞれ REQ-448・449・450 の単独 ID とする。テストの名前にも対応する ID を付ける。P3（REQ-451〜453・REQ-070）と親 #65 は未完了で、この change の完了と区別する。

## PR #460 の Opus R1 に対する管理判断

管理役 root は 2026-11-06 JST に、独立 Opus R1（ffa05896-bf6e-4b61-b54b-546f7ce18345、actual claude-opus-5-5、head 651f53ff、重大 0・軽微 1・情報 4）の軽微 M1 を P3 より前に修理すると決定した。既存 REQ-450 の全返却文字列の保証に従い、stderr 全文の置換後に UTF-16 を分断せず末尾 4096 文字を取り、切り口で新たに一致する既知の形も再置換する。規範・公開型・受理形式・30 Scenario は変更しない。

情報 I1 は非公開 helper 2 名を独立した型エラーで検査するよう強化する。I2 の共有期限・timeout・予算・品質設定は変えず、実際の 3 OS CI を管理役が確認する。I3 の Codex 最後の turn の扱いは現仕様どおりで P3 の注意点に残し、I4 の object でない request は列挙した入力検査の範囲外として変更しない。初回 R1 の原記録を保持し、製品修理後は通常の完了検証、別担当の自己レビュー、Opus R2 を行う。

## PR #460 の CI fixture 保守

管理役 root は 2026-11-06 JST に ADR 0005 の開発基盤保守として、ci-gate-process の初期 Git リポジトリを一度だけ作り、ケースごとに .git を含めてファイル単位でコピーする方針を採用した。trusted-git-objects の後始末も既存の removeWithRetry を使う。実際の gate・Git・検証 CLI の子プロセス、全ケースの入力・期待値・制限時間は保つ。製品コード・仕様・30 Scenario・設定は変更しない。

初回 Windows CI の EPERM と、同じ head の再試行で起きた 4 件の 15000 ms 超過は別々の観測として残す。今回の保守が Windows の時間内に収まるかは、次の実 CI で確認する。根本原因を特定したとは扱わない。独立調査は .loomake/ci-blocker460/independent.md に保持する。

## PR #460 の runner fixture 保守

管理役 root は 2026-11-06 JST に ADR 0005・0006 に基づき、run-unexpected-failure の 4 ケースで、既存 makeRepo による実リポジトリの準備だけを beforeEach へ移すと決定した。元の callback 本文、Git 操作、環境の復元、finally の後始末、製品処理と期待値は保つ。製品処理は従来どおり 5000 ms のケース内で実行し、hook の制限時間と設定も変えない。

Windows CI の 5915 ms・9240 ms の時間切れを記録し、Linux の準備・本体・後始末の計測と区別する。今回の分離はケースの計測範囲を変えるため、経過時間が従来と同じとは扱わない。Windows の根本原因と修理の有効性は未確定で、管理役が次の実 CI で確認する。テストの隔離は行わない。既存の設計・独立レビュー・完了ゲートの原記録は保持する。
