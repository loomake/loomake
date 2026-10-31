# Tasks

## 1. 仕様と採用の固定

- [x] 1.1 管理役のQ1〜Q11と残5点、REQ-340/341の予約、main085a基準、既存担当の保持を記録する（REQ-340・REQ-341）
- [x] 1.2 8 Requirement・41 Scenarioと全既存Scenario/Sourceを照合し、正規parserの500 UTF-16本文、strict、spec-onlyを確認する（REQ-099・REQ-100・REQ-204・REQ-330・REQ-331・REQ-340・REQ-341）
- [x] 1.3 修正版の分類・保存失敗・privacyの表/schemaを独立Opus設計で確認し、管理役が成果と受入条件を実装担当へ引き継ぐ（REQ-340・REQ-341）

## 2. 製品実装

S2-Q01の採用により、2.5と3.5をS4として先行し、その後S2の2.1〜2.4・3.1・3.2へ進む。依存上の実施順だけを変え、以下19taskのID・本文・受入・完了印は保持する。S4の3OS受入前に3.5を完了としない。

- [x] 2.1 元の標準出力でJSONを読み、失敗優先・型検査・subtype表示を純粋関数へ接続する。秘密置換後に分類しない（REQ-341）
- [x] 2.2 先行停止→hold→既存guardと必要表示→純粋AfterGuard→index解除と停止を接続する。既存停止優先順位と正常経路を保持する（REQ-204・REQ-340・REQ-341）
- [x] 2.3 通常summary/displayの完全な出力パス、分類後summary/stop保存失敗の短い理由、分類前output保存失敗の従来I/O停止を実装する（REQ-340・REQ-179）
- [x] 2.4 異常結果ではタスク・NoChange完了・commit・直しの再gate・後続engineへ進まないよう既存利用側とfixtureを追従し、正常なタスクと完了ゲートを保つ（REQ-099・REQ-100・REQ-330・REQ-331・REQ-340）

- [x] 2.5 findViolationsの内容差分を8192文字基準の群で取得してfile単位に照合し、表示をliteral/固定形式のfile区切りで絞り、filter前のstdout/stderr合計予算とUTF8末尾の安全側課金を維持する。不完全hunkを成功にしない。検出内容と順序、対象file、Git失敗・共有期限の扱いを保つ（REQ-109・REQ-110・REQ-111・REQ-112・REQ-137・REQ-138・REQ-180・REQ-201）

## 3. 直接試験と回帰

- [x] 3.1 REQ-341全Scenarioの直接試験と、失敗優先/理由順を逆にしたコピーをassertion失敗で検出する試験を追加する（REQ-341）
- [x] 3.2 REQ-340全Scenario、元raw分類と秘密置換、違反guardとの重なり、短い/長いパス、分類後summary/stop保存失敗と分類前output保存失敗を回帰する（REQ-340・REQ-179）
- [x] 3.3 正常経路と旧全Scenario、HEAD/branch/Git内部変更・中断・上限・質問・非ゼロ終了の優先を維持し、a1のREQ-100追加Scenarioも回帰する（REQ-099・REQ-100・REQ-204・REQ-330・REQ-331）
- [x] 3.4 保存許可表・例・schema、4種の出所、元の型を保つ置換、表示可否/分類の保持、追加欄拒否と未収集の扱いを検査する。metarecordから生成した入力を実観測と呼ばない（REQ-340・REQ-341）

- [ ] 3.5 群内/群間の偽対応、特殊パス、型とdir置換、argvと起動回数、stdout/stderr合計予算・UTF8末尾・hunk完全性・glob/dir混入・rename・区切り不一致を追加試験し、既存全試験・1200file・60秒を変えず3OS回帰を確認する（REQ-109・REQ-110・REQ-111・REQ-112・REQ-137・REQ-138・REQ-179・REQ-180・REQ-201・REQ-340）

## 4. 公式CLIの実4件

- [x] 4.1 既存保護を維持する採集手順を確認し、公式package/integrityと独立prefixのignore-scripts導入、nativeの版/checksum、必要help/referenceを版ごとに照合する（REQ-340・REQ-341）
- [ ] 4.2 設定源・hook・会話記録・subscription認証・保存先・debug出力・argv監査を採集前に確認する。原raw/秘密を永続化しない条件を確認できなければ起動せず、未収集・Issue・未完了taskを残す（REQ-340・REQ-341）
- [ ] 4.3 2.1.307/2.1.308 × success/error_max_turnsの実4件を収集し、全試行と不足を記録する。synthetic/未収集で必須件数を埋めない（REQ-340・REQ-341）
- [ ] 4.4 許可された最小fixtureだけを保存し、provenance・presence/value/type・置換箇所・版/caseを照合する。原raw hashを保存せず、再解析/独立照合不能という限界を記録する（REQ-340・REQ-341）

## 5. 完了と受入

- [ ] 5.1 runnerの必要なchangeset、trace/作業記録、全要件対応試験と全Scenarioの証跡をそろえ、既存テスト・品質設定・完成範囲を維持する（REQ-099・REQ-100・REQ-204・REQ-330・REQ-331・REQ-340・REQ-341）
- [ ] 5.2 `pnpm -s verify --change validate-engine-json-result --done` を通す（REQ-099・REQ-100・REQ-204・REQ-330・REQ-331・REQ-340・REQ-341） <!-- loomake:gate=done -->
## 完了ゲート後の必須受入

次の5.3は5.2の成功後に実施する。完了ゲートのタスク完了印では代用せず、PR #185とIssue #121で管理役が証拠を照合する。未達の間はchange・PR・親DoDを完了としない。headが変わった場合は新headの完了ゲートと必須CIを確認し、Opusの再レビュー要否と回数を改訂ADR0006に従って管理役が判定する。Codexは参考として記録する。

- 5.3 L3の必須CI・変更runnerの3OS試験と完了ゲートを確認し、設計/実装と別セッションの独立Opusレビューで重大な指摘をゼロにする（最大2往復）。Codexは参考として記録し、管理役が改訂ADR0006のhead条件で受入を判定する。未収集や残taskを完了にしない（REQ-340・REQ-341）
