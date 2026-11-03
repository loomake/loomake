# Design
## Context
#278の本人3回答AとOpus3182cf02、52境界の恒等版対照に基づく。旧runTask全体方式はfixture混入で不採用。
## Goals / Non-Goals
既存kit入口の取得器を単独提供し、reader/gate/CLI便利入口・設定有効化は後続。型の値は原観測とし、未定義task.failsはnullで記録する。
## Decisions
raw callback内だけをALSで区切り、chaiの3matcherの実呼出しを試行ごとに記録する。guardとfn実行を分離し、bodyのTまたはPromise<T>はreturn/awaitで同じ値・例外と非同期完了を受け取る。同期throwの時機は全経路で保証しない。
## Risks / Trade-offs
stateはfinished時点のsnapshotで、反転と後の失敗を確定しない。expectedFailureと原counterを落とさず、記録不能は欠落/null、finishedでも範囲を閉じる。kit tarballを直接導入する暫定手順を示し、52境界と公開consumerを実行する。保持IDは393/015/038/319/046/047/083/123とし元assert/skip/期限/API/JSONを照合する。
