# 行単位の分割基盤（split-slow-ci-checks 2.7の先行部分）

1. やったこと：採用済みの行分離設計と補足設計に従い、共有part入口とeachRows/selectRows、限定した行登録の宣言検査と正負試験を実装した。元の試験74件の本文と期待を保ち、同名行・引数・名前・timeoutと失敗の保持を実Vitestで確かめた。
2. verify の結果：親changeの仕様ゲートとstrictは管理役が成功を確認し、このL2部分にはtrackedのchangeを複製していない。旧228件を含む関連6ファイル280件とbuild・型・lintは成功した。
3. 残っている確認事項・仮定：一般のruntime identity oracleと2.7全体、実ケース登録・OS割当・3OS受入・完了ゲートは未完了。新規fixtureのposixItにもshadowedTestを求めた転記ミスは設計原文との照合で訂正し、誤った初回記録を残した。
4. 次にやること：依存する監査PRの受入後にmainを取り込み、同じ差分の別担当による自己レビュー・独立Opus・必須CIへ進む。親changeの完了印は変えず、未受入の一般oracleと実登録を管理役へ引き継ぐ。
