# 設計

確定設計はOpus 536f301e-d036-48d4-b48d-cea30184a5de（claude-opus-5-5、対象42c8b2da、exit0、oktrue）§2群6・§4・§5・§7。管理役はQ-P2-01〜06のAを2026-11-06 JSTにADR0006に基づいて採用した。

## 検査

dateValidの秒を必須とし、cost配列は1〜3件にする。固定headのZod実物で秒なしは拒否、秒・小数秒・offsetありは受理することを確認した。同じ表で同期検査とZodを比較する。CLIの時間・回数・費用文法、先頭ゼロの受理、秘密形change-idの拒否は維持する。

## 公開と診断

publication内部にpublishEvidenceStateとPublicationFailure.linkedを置く。既存publishEvidenceはwrapperとし戻り値・UsageErrorの文言・causeを保持する。indexへ内部APIを公開しない。EffortDiagnosticは固定文だけの非公開UsageError。任意のUsageErrorやcauseを外へ再送しない。

保存前は入力・サイズ・change・git・保存の固定文、未コミットと衝突は1を維持する。最終名link後のunlink失敗と保存後stdout失敗は、秘密置換した相対パスを持つRuntimeFailure（3、helpなし、causeなし）にする。保存済みを再実行しない案内を出す。

## 互換性と移行

cost:[]は以前の公開APIとZodが受理していたため、coreとtraceをminorとする（ADR0002）。未知費用はcost省略、実額0はkindと0を明記する。Effort形式1は維持し、追記専用の既存原本を書き換えたり、分精度の日時に根拠のない秒を加えたりしない。公開JSON Schema13本は変更しない。全環境の実記録件数は断定しない。

## 試験

既存assertを保持する。srcとkit errorsをtranspileModuleでdata URL化して同時公開を実行する。同じnow・HEADのEffort API衝突も確認する。配布物のruntime・型の試験と旧REQ-175/176のwrapper契約を維持する。
