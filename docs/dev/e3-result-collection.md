# E3の開発用採集制御

`scripts/claude-result-{collector,fixture,lifecycle,paths,preflight}.mjs` は、E3で結果fixtureを採集する前提を検査する開発用の部品である。製品パッケージには依存せず、配布物にも含めない。ADR 0005に従い、合成試験には製品の要件IDを付けない。

現在のcollectorは必ず拒否し、`spawnAllowed:false`、実CLI起動0回、実観測0/4を返す。設定を読めたことや自己申告booleanを採集の資格へ代用しない。実起動adapter・保存・試行台帳は未実装であり、この先行分割を親PR #185の完成へ数えない。認証、設定、hook、診断環境を変更しない。

nativeの検証対象は、固定hashを持つ2.1.307/2.1.308のlinux/arm64用配置に限る。macOS/Windowsで行うのは合成制御の試験であり、そのOSでのnative採集を実装したことにはならない。保存先と作業cwdのGit検査は、環境名の大小文字によらず`GIT_`で始まる変数があれば値を表示せず拒否する。

`resultCollectionPlan` は呼出元の環境をメモリに複製するため、秘密情報を含み得る。plan全体とそのenvironmentをログ、例外、証跡、fixtureへ出力・保存しない。返却するfixtureは許可されたprojectionだけで、原rawと原rawのhashは保存しない。

`inspectResultProcess` は既存の合成試験専用で、非推奨とする。実プロセスのcallerを追加しない。owned groupの後始末を扱う設計済みの部品は、依存を注入する`driveResultProcess`である。OS adapterの停止保証は未受入であり、fakeの成功を実停止の保証へ数えない。旧harnessのlistener回収や停止要求も、実プロセスツリーの後始末の証明ではない。

守る試験は`tests/claude-result-collector.test.ts`、`tests/claude-result-lifecycle.test.ts`、`tests/claude-result-paths.test.ts`。秘密の非返却、拒否条件、注入したprocess/clockの終結、保存先・native・cwdの境界を、実CLIを起動せず確かめる。既存assertは維持し、OSで失敗する場合もskipや期待値の変更で通さない。
