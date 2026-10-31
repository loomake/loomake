# Trace: verify-v2-shape

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 親change `openspec/changes/verify-v2-c001/`（proposal・design.md・design-candidate-a.md・specs・tasks・trace） | main f26823f | 2026-10-31 |
| `.loomake/handoff/design-step8-c001-split-2026-10-31.md`（設計メモ。2章のPR1、5章のtasks草案、6章の採否） | main f26823f 基準 | 2026-10-31 |
| [PR #180](https://github.com/loomake/loomake/pull/180) 本文の採否表（R-F12・15・17・18、F16、D-R2） | head 671c249（マージ済み） | 2026-10-31 |
| docs/requirements/loomake-v0.11.md 7.1・7.3 | v0.11.3 | 2026-10-29 |
| docs/wbs/baseline-v1.4.md 0章 J01〜J04、5章C-001 | 固定v1.4 | 2026-10-26 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-183 | 親 trace、現行external-process-budget | 既存変更 | JSONと依存の不変を、予算だけを変える変更の範囲に限る | 反映済 | specs/external-process-budget/spec.md |
| REQ-274 | 親 trace、要件7.3・WBS J03 | 既存変更 | 現行v2と履歴1.0.0のスキーマ・導出型を分ける。書き出しの版の文はREQ-311へ移した | 反映済 | specs/core-parsers/spec.md |
| REQ-275 | 親 trace、現行core-parsers | 既存変更 | 現行checksと履歴resultsの未知値を保持し、v2の既知の禁止キーと区別する | 反映済 | specs/core-parsers/spec.md |
| REQ-276 | 親 trace、R-C001-09 A | 既存変更 | 旧版のJSON Schemaを版付きのパスで公開し、再生成の一致を検査する | 反映済 | specs/core-parsers/spec.md |
| REQ-302 | 親 trace、要件7.3 | 既存変更 | Evidence 2と履歴Evidence 1を別の構造スキーマ・型で公開し、Report 2を維持する | 反映済 | specs/core-parsers/spec.md |
| REQ-303 | 親 trace | 既存変更 | 同期APIと整合性検査・遅延zodを保ち、新旧の型を従来の公開元から出す | 反映済 | specs/core-parsers/spec.md |
| REQ-304 | 親 trace、要件7.3・WBS J03 | 既存変更 | verify・evidenceの新旧JSON Schemaを公開し、無関係の6本を変えない | 反映済 | specs/core-parsers/spec.md |
| REQ-305 | 親 trace、共有4値 | 既存変更 | 共有4値と遅延ロードを保ち、現行と履歴のverify・evidenceを区別する | 反映済 | specs/core-parsers/spec.md |
| REQ-306 | 親 trace、現行verification-policy | 既存変更 | 集約関数の定義の変更だけでは件数・summary・verifyへ接続しない | 反映済 | specs/verification-policy/spec.md |
| REQ-307 | 親 trace、現行core-parsers | 既存変更 | 現行checksと履歴resultsも未知キー `__proto__` などの保持の対象にする | 反映済 | specs/core-parsers/spec.md |
| REQ-308 | 親 trace、要件7.3 | 機能 | v2のci/local×completed/partialとabortedを区別し、未知キーの許容と既知の禁止キーを分ける | 反映済 | specs/core-parsers/spec.md |
| REQ-309 | 親 trace、要件7.3の実行エラー | 機能 | run.errorsの種別・対象・message・nextと、usage・configの2、ほかの3 | 反映済 | specs/core-parsers/spec.md |
| REQ-310 | 親 trace、要件7.1・7.3、R-C001-07 A | 機能 | quality.yamlの最小読取と既定値、構文・内容の誤り2と読取不能3、spec-onlyの不在の許容 | 反映済 | specs/verify/spec.md |
| REQ-313 | 親 trace、要件7.3の集約の規則 | 機能 | 純粋な条件判定で、証跡不足・必須違反・NA・PASSを区別する | 反映済 | specs/verification-policy/spec.md |
| REQ-314 | 親 trace、要件7.3の集約・件数、R-C001-02 A | 機能 | evaluatedはchecksの全件。localの不足はpending、decisionは品質判定と独立 | 反映済 | specs/verification-policy/spec.md |
| REQ-316 | 親 trace、WBS J03 | 機能 | 新旧の証拠を既存Report 2へ投影し、旧版を閲覧専用にする | 反映済 | specs/trace-report/spec.md |
| REQ-322 | 親 trace、現行reference-docs | 既存変更 | 公開8 JSONなどの不変を、qualityリファレンスの生成/checkだけの変更に限る | 反映済 | specs/reference-docs/spec.md |

設計メモ2.2はREQ-073を含む18件をこの子changeへ移す案だった。REQ-073は、trace reportのCLIでEvidence 2を受け付けると、既存試験（`packages/trace/test/report.test.ts` の「schemaVersion が読める版でない記録」）の期待する文言が変わるため、親に残した。期待値の変更は2本目で具体差分を示して扱う。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-01〜10 | 親の全Requirement | 親traceのR-C001-01〜10（bare verify、evaluated、実証跡の範囲、S1、互換差分、ローカルDoD、quality初期内容、warnとskip、旧JSON Schema公開、spec-onlyの計数） | 親traceのとおり | 親traceのとおり | no | 親traceに記録済み（R05・06・07 A、R08 B、ほかA）。この子changeはその回答に従う | 親traceのとおり | 2026-10-30 |
| S8-01 | REQ-274・305・313 | R01・R04の「推奨で進める」を、v1.4のJ01・J04より優先するか | A: J01・J04を維持し、推奨は不採用と記録 / B: zodをcoreから外し、判定関数をcoreへ戻す | A。ADR 0003とコードが既にJ01・J04で、Bは全Requirementの書き直しになる | yes | A | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| S8-02 | 全Requirement | C001をどう分けるか | A: 子change 2つと親。archiveは3本目のあと / B: 1 changeのまま中間PRをnoneで通す / C: gateに例外を足す | A。L3はchange必須で、PRごとに `verify --done` を通せる | yes | A（2本目が200KiBを超えたら2本目を分けてよい） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| S8-03 | REQ-313 | S1（信頼する判定器）をどこで作るか | A: 1本目のあとに独立changeとして並走 / B: 3本目に畳む / C: C-003へ送る | A。承認記録のとおり独立したDoDとarchiveを持てる | yes | A | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| R-F12 | 親REQ-165 | Draft PRの扱い | A: 新規だけDraft、既存は状態を変えず再利用 / B: 既存をDraftへ戻す / C: 停止 | A | no | A（PR #180） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| R-F15 | REQ-309 | 構文エラー時のJSON | A: 独立した--jsonを識別し、構文エラーでも正規のabortedを出す / B: 解析エラーではJSONなし | A | no | A（PR #180） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| R-F17 | 親REQ-318 | 配布物の検証 | A: 製品はtarball、producerはlockに対応する実Vitest / B: producerをオフラインinstall | A | no | A（PR #180） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| R-F18 | 親 | 速度対策との順序 | 既存1-1（split-slow-ci-checksで先行） / 別change・別PR | 既存1-1 | no | 既存1-1（PR #180） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| F16 | 親REQ-312・319 | changeなしPRのsubject集合 | A: 全mainの集合を一律に追加 / B: 基準側の承認root planへ集合を固定 | B | no | Aは不採用。Bの方向で追加設計中。3本目の受入条件なので、2本目の着手までに閉じる | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| D-R2 | REQ-316 | Report 2への投影の表示 | 01/02/04: 警告の見出し、ok:falseの中立表示、証拠の警告を先頭 / 03: recordのaborted・partialの保存 | 01/02/04はA。03はreportが保存の有無の両方を扱う設計だけ | no | 01/02/04はA、03は設計だけ採用（PR #180）。表示の文言の変更は2本目 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
