# Tasks

## 1. 設定読取の分類
- [x] 1.1 Opus設計とREQ395の正負境界を定め、strictと仕様ゲートの終了0を保存する
- [x] 1.2 REQ395のEACCES・構文/内容・不在・共有利用側・入力拒否の新試験を追加し、OS失敗3のREDと保持条件の成功を保存する
- [x] 1.3 内部のOS読取失敗の識別とverifyだけの変換を実装し、新試験・既存関連試験・型・lintを成功させる
- [x] 1.4 changesetと互換性文書に2→3の移行を記し、通常のlocal完了ゲートを通す <!-- loomake:gate=done -->

## 2. 自己レビューC1/C2/m1の修理
- [x] 2.1 補足Opus設計と再開した差分仕様・design・tasksで仕様ゲートの終了0を保存する
- [x] 2.2 実パスへの注入準備と追加8例で、REDと既存15例の保持を保存する
- [x] 2.3 verify用の存在確認とELOOPのリンク拒否を実装し、新旧試験・型・lintとLinux実probeを成功させる
- [ ] 2.4 移行説明を更新し、仕様同期/archive後の通常local完了ゲートを通す <!-- loomake:gate=done -->

## Workflow follow-up
- 管理役がREQ394受入後に自身の仕様同期/archiveを同じPRに含め、通常done・必須CI・3OS・独立レビューを確認する。
