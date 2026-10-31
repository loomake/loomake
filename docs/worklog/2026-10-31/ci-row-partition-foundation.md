# 行単位の分割基盤（split-slow-ci-checks 2.7の先行部分）

1. やったこと：partを共有する関数とeachRows/selectRowsに加え、行登録のimportを正規helperの相対pathへ限定し、describeからファイル直下までの祖先と空IDを検査した。N3のelse診断は元のguardOfから導いた追加設計に従って訂正し、元335行の本文・期待とnative fixtureの11 callを保った。
2. verify の結果：親changeの仕様ゲートとstrictは管理役が成功を確認した。修理前の失敗を保存し、旧321件と新35件を含む関連6ファイル356件、型・lintが成功した。完了ゲートは未実施。
3. 残っている確認事項・仮定：正規pathの構文検査だけではsymlinkやhelper実体を証明しない。実helperが通常fileであることを別の試験で確認したが、R4の配線検査、C1のstatic/native対応、一般runtime oracle、実登録・OS割当・3OS受入・2.7全体は未完了。
4. 次にやること：管理役が依存する監査修理を統合し、同じ差分の別担当による自己レビュー・独立Opus・必須CIへ進む。親changeの完了印と実registryは変えず、残る設計と受入を引き継ぐ。
