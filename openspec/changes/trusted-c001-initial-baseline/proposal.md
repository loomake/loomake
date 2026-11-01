## Why

C001の全初回記録を固定する。Opus具体設計§9の案Sで、汎用readerはPR #315のC2aへ先行分割した。本changeはその通常受入・同期・archiveに依存し、REQ-378の全受入を完成させる。

## What Changes

- 親のverification.yamlへ全47 identity・158 Scenario・46 Source・16条件、49所有・21未対応・409一意試験参照を含む候補全文を置く。
- 既存readerへ基準側PINを渡し、構造・全15件数・独立2経路で測るcanonical sha256を照合する。
- Q-S1-16〜24の全セルと所有表を不変で移し、その9採否参照のchange名だけを本changeへ変える。ADOPT群と他の88参照は保持する。
- 元JSON保護6件を名前・本文・期待値・期限までバイト不変で移し、別のREQ-378試験で全5 Scenarioと全409参照を確認する。Issue #317のYAML補助負例も強化する。

## Capabilities

### New Capabilities
- trusted-baseline-record：具体的なC001初回記録の固定と保持（REQ-378）。

### Modified Capabilities
なし。

## Impact

私的PIN定数・記録YAML・直接試験・計画と記録。公開exports・CLI・依存・既存期待値・期限・品質設定は変えない。採否主体/API・追記連鎖・新しい適格実行、038/042・114 Draft・205のO1/O2/O3・DUP324、S1・親・live・S2の全受入は後続に残す。通常L3のDoD・3OS・全差分200KiBを満たし、超過時は受入を削らず設計へ戻る。
