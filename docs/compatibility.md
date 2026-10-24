# 互換性と対応範囲

## 実行環境

| 対象 | 宣言・CIの対象 | 今回のローカル確認 |
|---|---|---|
| 配布物 | package.jsonのenginesはNode.js 20.19以上 | Node.js 24でtarballから主要コマンドを確認 |
| 開発 | Node.js 24、package.jsonのpackageManagerにあるpnpm | 同じ環境で型・lint・テスト・ビルドを確認 |
| OS | GitHub ActionsのLinux・macOS・Windows | 現在のLinuxホストで確認。別OSのCI成功は未確認 |
| Node下限 | Node.js 20.19.0で配布物を確認するCIジョブ | 今回のホストで下限Nodeを実行した結果ではない |
| runのエンジン | claude-code | 代替コマンドで接続を試験。実エンジンの検証とは区別 |
| テストレポート | Vitest・Jest形式のJSON | fixtureと実際のVitestの結果を検査 |

CLIと利用者向けのメッセージ・規約は日本語を対象とする。Nodeの宣言範囲と、各OS・各Node版で実際に試験した範囲は区別する。変更を公開する前に、対象コミットのCIと配布物の結果を確認する。

## 維持する契約

- CLIの終了コードは、合格0、不合格や安全な停止1、使い方・設定の誤り2を維持する。
- verify JSONのschemaVersionは現在`1.0.0`。証拠は1、検収レポートは2である。利用側は版を確認して読み、未対応の版を黙って解釈しない。
- 文書のスナップショットを含まない旧証拠はreportで読める。現在の仕様との厳密な対応は確認できないため、runの自動再利用では対象外とする。
- 公開するexports、型宣言、JSONスキーマ、CLIのbin、initのテンプレートは、配布したtarballから検査する。開発専用のソース条件を配布物へ残さない。
- 旧形式の完了ゲートタスクも扱うが、新規のタスクでは明示した`<!-- loomake:gate=done -->`を使う。

入力予算の導入により、文書・JSON・探索の上限を超える入力や、specs内のリンクは受け付けない。プロジェクトルートのリンク互換性とJSONの版は維持する。対象と移行時の確認は[resources.md](resources.md)を参照する。

証拠の保存は、同じディレクトリに一時ファイルを作り、完全に書いた後にハードリンクで上書きせず公開する。trace recordとrunの証拠保存には、ハードリンクを作れる保存先が必要である。対応しない場合は停止する。保存失敗と強制終了の確認は[run-recovery.md](run-recovery.md)を参照する。

実行記録は既定で1回128MiB、履歴全体512MiBまでとする。既存履歴が多い環境では、開始前に止まる場合がある。設定と整理の方法は[resources.md](resources.md)を参照する。通常のsummary.jsonの契約は維持する。summaryを予約容量へ保存できない場合に使うstop.jsonは、schemaVersion 1・kind run-stopの別形式であり、summaryとして解釈しない。

## 変更を公開する判断

利用者に影響する変更にはchangesetと移行の説明を付ける。現在の0.xでは、破壊的変更はminorの変更として扱い、単にpatchへ含めない。JSONの互換性を壊す場合はschemaVersionの変更と旧形式への対応範囲を明記する。

古い形式を維持する判断にはfixtureを使う。対応を外す場合は、出典・差分仕様・移行手順・テストを同じ変更に含める。すべての古い版を永久に維持する方針ではない。現在はnpm公開前で、修正対象はmainとする。

具体的な検証手順は[testing.md](testing.md)、報告は[SUPPORT.md](../SUPPORT.md)、公開時の確認は[publishing.md](publishing.md)を参照する。
