# Tasks

- [x] 1.1 REQ-467・468・171 の仕様、確認事項と仮定を確定し、仕様ゲートを通す。
- [x] 2.1 `readTable` を core の入口に公開し、`TableRow.size` を足す。
- [x] 3.1 kit の `createByteInputReader` を足し、予算の共有とリンクの拒否を試験する。
- [x] 4.1 手書き記録の parser `parseManualEffort`（時間の字句・構造・BOM/CRLF/不正 UTF-8・C-001）を実装する。
- [x] 5.1 `readEffortInputs`（探索・上限・change の所在・Effort 1 の検査）を実装する。
- [x] 6.1 `buildEfficiencyTable`（総計・部分計・search・0・削減率・重複・人力実測・超過）を実装する。
- [x] 7.1 `formatEfficiencySection`（見出し・9 列・順序・エスケープ・決定性）を実装する。
- [x] 8.1 trace の公開入口と、配布物・依存・既存出力の互換の回帰試験を足す。
- [x] 9.1 changeset・作業記録を整え、全タスクと要件 ID 試験を確認して完了ゲートを実行する。 <!-- loomake:gate=done -->
