# Trace: extract-shared-secret-redaction

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #65](https://github.com/loomake/loomake/issues/65) 全文・全コメント0件 | W1-6、取得時open | 2026-11-05 |
| docs/requirements/loomake-v0.11.md NFR-09（215行）、docs/architecture.md 0.1・4章、docs/wbs/baseline-v1.4.md W1-6（118行） | 対象mainの既存文書 | 2026-11-05 |
| Opus設計result.md 2・3・4〜7章、manifest（詳細はdesign.md） | 7e9d5568-6df5-4ee8-9b3c-aaf939953f20、claude-opus-5-5 | 2026-11-05 |
| 管理役のP1/P2/P3分割採用、Q65-03/04/10のA回答、REQ447〜453予約 | 本作業への直接指示、ADR 0006 | 2026-11-05 |
| openspec/specs/monorepo/spec.md「kit の中の依存の向き」 | 現行REQ-207 | 2026-11-05 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-447 | Issue65 W1-6、NFR-09、Opus設計3章、Q65-03/04/10 | 機能 | 既知の秘密の置換をkitへ挙動不変で移しrunner公開元を保つ。maskValueは明示したJSONデータとown optional undefinedを安全に深く複製・置換する | 反映済 | specs/secret-redaction/spec.md |
| REQ-207 | 現行monorepo「kit の中の依存の向き」、B01 | 制約 | runtimeの責務に共通の秘密置換を明記し、既存の依存方向と全禁止例を維持する。一覧の追従はB01の管理役分類に従う | 反映済 | specs/monorepo/spec.md |
| REQ-118 | 現行run「記録に秘密情報を含めない」 | 制約 | 既知の秘密の置換の既存挙動を保つ | 既存仕様で充足 | openspec/specs/run/spec.md |
| REQ-199 | 現行run「置換する秘密情報の形」 | 制約 | 既知pattern・Bearer・秘密鍵・JSON・streamの既存結果を保つ | 既存仕様で充足 | openspec/specs/run/spec.md |
| REQ-047 | 現行verify「実行時依存の範囲」 | 制約 | kitに新たな実行時依存を追加しない | 既存仕様で充足 | openspec/specs/verify/spec.md |
| REQ-123 | 現行run「runner の実行時依存」 | 制約 | runnerからkitへの既存依存を使い逆向きの依存を作らない | 既存仕様で充足 | openspec/specs/run/spec.md |
| REQ-448 | Issue65、Opus設計4.1/4.3 | 範囲外 | 五つのvendorの中立変換・入力形と版・終端検証・入力値を引用しないエラー（P1外、W1内P2で未実装） | 範囲外 | proposal.md Non-goals、parent-handoff.md P2 |
| REQ-449 | Issue65、Opus設計4.2/4.3 | 範囲外 | 共通runExternalを1回使う収集の5分類と既存予算・signal・起動失敗の保持（P1外、W1内P2で未実装） | 範囲外 | proposal.md Non-goals、parent-handoff.md P2 |
| REQ-450 | NFR-09、Opus設計4.2/4.3 | 範囲外 | 収集結果と診断を保存前に既知の形で置換し、vendor自身の保存の保証範囲を明記（P1外、W1内P2で未実装） | 範囲外 | proposal.md Non-goals、parent-handoff.md P2 |
| REQ-451 | NFR-09、Opus設計5章verify | 範囲外 | verify結果・進捗・診断・aborted・OpenSpec出力で切出し前に置換（P1外、W1内P3で未実装） | 範囲外 | proposal.md Non-goals、parent-handoff.md P3 |
| REQ-452 | NFR-09、Opus設計5章record | 範囲外 | 秘密形文書は保存拒否し、原文snapshot/hash/freshnessとtemporary前の最終検査を保つ（P1外、W1内P3で未実装） | 範囲外 | proposal.md Non-goals、parent-handoff.md P3 |
| REQ-453 | NFR-09、Opus設計5章report | 範囲外 | 旧記録不変でReport/API/MD/JSON/診断を置換し、REQ-070の既存Scenarioを残して例外を明記（P1外、W1内P3で未実装） | 範囲外 | proposal.md Non-goals、parent-handoff.md P3 |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q65-03 | REQ-447 | 共通の置換処理をどこへ置くか | A:kit runtimeへ移しrunnerは再export / B:coreへ置く | A。収集の責務と依存方向を保つ | yes | A。kitのredact.ts/private-key-stream.tsへ移し既存公開元を保つ。管理役がOpus設計を採用。ADR 0006「決定」 | 利用者（ADR 0006 の包括承認） | 2026-11-05 |
| Q65-04 | REQ-447 | W1で秘密を見分ける範囲をどうするか | A:既存既知patternのみ / B:キー推定や明示値の収集も追加 | A。任意の秘密を検出できると保証しない | yes | A。REQ-118/199のみで新たなkey推定や秘密値収集を加えない。管理役がOpus設計を採用。ADR 0006「決定」 | 利用者（ADR 0006 の包括承認） | 2026-11-05 |
| Q65-10 | REQ-447 | maskValueでoptional undefinedをどう扱うか | A:plain objectのown enumerable data値だけ保持、root/Array undefined等は拒否 / B:strict JSONのみでundefinedを全拒否 | A。Verify/Evidence/Reportのoptional/unknown値を失わずJSONの範囲を明示できる | yes | A。管理役が直接採用。NaN/Infinity・非plain・配列穴・accessor等の拒否、own/prototype/共有参照/循環もspecへ明記。ADR 0006「決定」 | 利用者（ADR 0006 の包括承認） | 2026-11-05 |
| B01 | REQ-207 | 固定一覧への2項目追加は、依存検査を緩めず採用仕様へ追従する変更か | A:元4項目と全禁止検査を保って2項目追加 / B:検査を緩める必要があれば実装しない | A。REQ-207は件数を固定せず、新2moduleにも同じ検査が掛かる | yes | A。独立確認に基づき管理役が仕様追従と分類し、追加承認必須との先の解釈を訂正。未回答を利用者の新承認へ置換しない（ADR0006） | 管理役（通常L3の仕様追従と分類） | 2026-11-05 |
| Q65-01 | REQ-448 | 五vendorの対応payloadと中立型をどこまで確定するか | Opus設計4章のA案 / 調査後に再設計 | A案をP2の版固定一次資料で確認 | no | P2準備段階。P1では採用・実装しない | 管理役 | 2026-11-05 |
| Q65-02 | REQ-449 | JSON/JSONLの終端と収集失敗をどう分類するか | parsed/unreadable/not_found/spawn_error/limited / 再設計 | 5分類案をP2の仕様で確定 | no | P2準備段階。P1では採用・実装しない | 管理役 | 2026-11-05 |
| Q65-05 | REQ-452 | 秘密形の文書とsnapshot/hashをどう両立するか | A:秘密形があれば記録拒否 / B:新しいsource hash契約 | A。既存契約を保てるが影響調査が必要 | no | 管理役がAをP3向け暫定採用。既存openspec全spec/traceへのreadonly影響調査を管理役が行い、P3着手時に確定 | 管理役 | 2026-11-05 |
| Q65-06 | REQ-453 | 古い証跡をどう保護するか | A:bytes不変で表示結果だけ置換 / B:過去ファイルを変更 | A。過去記録を維持 | no | P3で仕様化。既存Evidence1/2の上書き・削除をしない | 管理役 | 2026-11-05 |
| Q65-07 | REQ-450 | 子ツール自身のファイルまで保証するか | A:Loomakeの戻り値・表示・保存だけ保証 / B:任意の子ツールのファイルも処理 | A。生出力はpipeで受け保証範囲を明記 | no | P2/P3で仕様化。P1で子ツールを起動しない | 管理役 | 2026-11-05 |
| Q65-08 | REQ-449 | 未導入・未対応時にどうするか | A:不足の分類と理由を返す / B:導入・認証へ進む | A。導入と認証は範囲外 | no | P2の入力・版・error契約で確定 | 管理役 | 2026-11-05 |
| Q65-09 | REQ-448・REQ-449・REQ-453 | W1でどの公開入口を届けるか | A:core変換・kit収集・trace接続 / B:新CLIも追加 | A。CLIは範囲外 | no | P2/P3で残りを実装する。P1ではkit共通関数だけ追加し#65を閉じない | 管理役 | 2026-11-05 |

B01は当初、期待値を変更する事実だけから直接承認が必要と解釈した。2026-11-05に管理役は独立確認を照合し、REQ-207の依存方向・未知ファイル拒否・元4項目を保ち、新2moduleにも同じ検査を掛ける通常の仕様追従と分類した。追加確認は取り下げたが、新たな利用者承認があったとは記録しない。検査弱体化の許可や規則変更ではない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

仮定は置かない。入力・秘密の範囲・期待値変更は上の確認事項として扱う。曖昧さチェックリストの言葉、入出力・件数・ファイル、エラー・権限・状態・同時操作・既存データ・外部連携、性能・ログ・安全・環境、文書間整合を台帳の各行へ当て、P1はREQ-447/207、残りはP2/P3で確定することを記録した。
