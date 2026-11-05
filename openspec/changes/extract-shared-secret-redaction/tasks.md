# Tasks

## 1. 計画と着手条件

- [x] 1.1 P1の仕様・設計・trace・親引継ぎを管理役が確認し、Q65-03/04/10の回答を記録する（REQ-447）
- [ ] 1.2 B01の具体的な一覧追加に利用者の直接承認を得て、承認元・対象・日付をtraceとPRへ記録する。未承認の間は製品と既存試験を編集しない（REQ-207）
- [ ] 1.3 `openspec validate extract-shared-secret-redaction --strict` と `pnpm -s verify --change extract-shared-secret-redaction --spec-only` の成功を確認してから製品の実装へ進む（REQ-447・REQ-207）

## 2. 共有実装と互換層

- [ ] 2.1 runnerのmask.ts/private-key-stream.tsをkitのruntime/redact.ts/runtime/private-key-stream.tsへ挙動不変で移す。既知の形とstream状態・保留量・JSON処理は変えない（REQ-447）
- [ ] 2.2 kitへmaskValueの入力検証・安全な深い複製・置換・衝突/循環拒否を追加する。getter/toJSONを実行せず、own undefined・__proto__とprototypeを定義どおり保つ（REQ-447）
- [ ] 2.3 kitのnamed exportとrunner2moduleの再exportを追加し、runner index・呼出元・既存試験・配布importを維持する（REQ-447）
- [ ] 2.4 B01承認の範囲内で、kit-layersの固定一覧に2ファイルだけを加える。元4項目・全assertion・禁止importの解析と全禁止例は維持する（REQ-207）

## 3. 試験と配布文書

- [ ] 3.1 kit/test/redact.test.ts等に全Scenarioの[REQ-447]試験を追加し、プリミティブ・optional undefined・非finite/非plain・Array穴・accessor・Proxy・own __proto__・共有参照・循環・衝突を確かめる（REQ-447）
- [ ] 3.2 runnerのmask/private-key-redaction/diagnostic-redactor/run-start-maskとpackage-artifactsの既存試験を無変更で実行する。kitとrunnerが同じ関数であることも新試験で確かめる（REQ-447）
- [ ] 3.3 kit-layersと依存の既存試験で、runtime責務と全禁止例・依存予算を確認する。core・verify・trace製品コードと設定・skip・timeout・閾値が不変であることを差分で確かめる（REQ-207・REQ-447）
- [ ] 3.4 kitの公開API説明とkit/runnerのchangesetを追加し、JSON入力の制限・既知の形だけの保証・P2/P3の未完了を明記する（REQ-447）
- [ ] 3.5 lint/typecheck/build、必要な試験、要件と試験の対応を確認し、作業記録と親引継ぎを実結果に合わせる（REQ-447・REQ-207）

## 4. ローカルの完了

- [ ] 4.1 `pnpm -s verify --change extract-shared-secret-redaction --done --scope local` を通す（REQ-447・REQ-207） <!-- loomake:gate=done -->

4.1はローカルの完了だけである。最終受入には同一headのCI完了ゲート（scope ci）、必須5チェック、変更packageの3OS、非著者Codexと独立Opusのレビューが別途必要。通常L3の全条件を満たすまでP1を完了扱いせず、P2/P3の完了前に#65を閉じない。仕様同期とarchiveは実装のmainマージ後に管理役が別PRで行う。
