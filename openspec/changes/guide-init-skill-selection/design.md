# Design

## Context

新Opus設計と管理役の技術判断により、既存OpenSpec案内のREQ-023を使う。REQ-024はpackageManager判定であり、#336の未archive差分を含めて変更しない。元の依頼は項目2の出力と試験を認めており、この選択を利用者の新しい本人承認とは記録しない。

## Decisions

`runInit` の既存OpenSpec案内の直後、テストレポート例より前で、仕様の1行をstdoutへ追加する。既存の成功経路をそのまま使い、Skillの探索や新しいflagは加えない。依存を追加する案内はREQ-019どおり最後に残る。上書きを断って終了0となる経路も含め、1回だけ案内する。

Loomake initはreq-to-openspecだけを配り、--codexで.agentsにも配る。OpenSpec1.15.0のinitは--tools claude,codex / --profile coreでopenspec-*を両方へ配り、--tools noneなら配らない実測に基づく。新しい文にtrace欠如の断定や警告は加えない。

## Tests / Review

変更要件はREQ-023だけ。既存2 Scenarioを全文保持し、新試験のREDで成功時の1回表示を確かめ、GREENでOpenSpec有無・Codex有無・上書き拒否・3種類の中止を確かめる。既存の全否定assertを文言と静的照合し、一致0を確認してから実装する。

不変条件は、全既存assert・期待値・期限・skip・設定、REQ-019末尾の依存案内、配置ファイル・既定commands・exit・JSON、REQ-024の#336追加文、doctorの読取専用/静的/ネットワーク不接続。主仕様・templates・flags・CI・規則は変更しない。

## Risks / Trade-offs

未配置のOpenSpec Skillにも案内するが、配置済みとは書かず、追加探索を避ける。約200行を見込み、300行を超えそうなら意味のある受入単位を設計し直す。失敗する試験だけのPRへは分けない。

## Migration Plan

仕様ゲート→新しいREQ-023付き試験のRED→stdout1行とGREEN→kit patch changeset/記録→通常localdone→別担当確認/新独立Opus/必須CIと3OS。項目1の未承認案は別作業に残す。
