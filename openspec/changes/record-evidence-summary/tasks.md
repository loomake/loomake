# Tasks

## 1. 仕様と出典
- [x] 1.1 Opus設計と管理判断、親の全未完了義務、既存契約の原文と曖昧さを照合し、strictと仕様ゲートの実終了0を保存する。

## 2. 構造と同期検証
- [x] 2.1 coreへ要約拡張版1の型・遅延構造スキーマ・独立したJSON Schema生成と公開を追加し、既存12Schema/固定集合/全旧assertを保持する（REQ-460）。
- [x] 2.2 traceへsummaryVersionの同期意味検証と既知nullable欄のgaps検査を追加し、旧Evidence1/2・未知storage・own __proto__・同期API・旧閲覧を保持する（REQ-460・461）。

## 3. 観測した実行事実と参照
- [ ] 3.0 既存readの安全性/予算/文面/型を保つreadInputBytesを追加し、symlink/FIFO/差替え/64MiB境界/不正UTF8のraw保持を確認する（REQ-462）。
- [ ] 3.1 runRecordへ実行条件・CI識別・実施時刻の事実、config raw hashとnameRefsによるコマンド参照、未確認理由を追加し、現P1の訪問順は専用観測なしのnameRefs:null/gapに固定する。basisHashの既存入口を公開する。追加外部コマンドなしで既存onVerify/verify/期限/失敗保存を保つ（REQ-461）。
- [ ] 3.2 同じ実行のraw bytesと表現を比較できるcheckハッシュを照合し、不一致拒否・未確認null・既知部分出力・6分類の観測件数・未アップロードを実装する（REQ-462）。
- [ ] 3.3 kitの本体照合・保持期間/失効の純粋関数を実装し、UTC閏日と境界、不正入力・権限未確認を検証する（REQ-463）。

## 4. 雛形と互換性
- [ ] 4.1 initのquality.yaml雛形へ既存evidence既定値を追加し、既存配置/保護・品質目標未設定を保つ（REQ-396）。
- [ ] 4.2 全ScenarioのREQ名付き試験・旧公開型・配布スキーマ・CLI/runner再利用・原子的保存・64MiB境界と入力拒否を確認し、最終CIで確認する範囲を記録する。
- [ ] 4.3 利用者文書とchangeset、branch日誌に独立PRの完成範囲と親#69の未完了を記録する。

## 5. ローカルの完了
- [ ] 5.1 通常の `pnpm -s verify --change record-evidence-summary --done --scope local` を実行し、全タスク・対応試験・全検査PASSと実終了0の原本を保存する。<!-- loomake:gate=done -->

最終受入は管理役が独立レビュー・CI scope ci完了・必須5チェック・変更packageの通常3 OS成功で確認する。部分受入や未アップロードを親#69完成とは扱わない。製品の受入後に同期・archiveする。
