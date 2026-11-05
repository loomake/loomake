# 設計

確定設計はOpus 536f301e-d036-48d4-b48d-cea30184a5de（claude-opus-5-5、対象42c8b2da、exit0、oktrue）§2群6・§4・§5・§7。管理役はQ-P2-01〜06のAを2026-11-06 JSTにADR0006に基づいて採用した。

## 検査

dateValidの秒を必須とし、cost配列は1〜3件にする。固定headのZod実物で秒なしは拒否、秒・小数秒・offsetありは受理することを確認した。同じ表で同期検査とZodを比較する。CLIの時間・回数・費用文法、先頭ゼロの受理、秘密形change-idの拒否は維持する。

## 公開と診断

publication内部にpublishEvidenceStateとPublicationFailure.linkedを置く。既存publishEvidenceはwrapperとし戻り値・UsageErrorの文言・causeを保持する。indexへ内部APIを公開しない。EffortDiagnosticは固定文だけの非公開UsageError。任意のUsageErrorやcauseを外へ再送しない。

保存前は入力・サイズ・change・git・保存の固定文、未コミットと衝突は1を維持する。最終名link後のunlink失敗と保存後stdout失敗は、秘密置換した相対パスを持つRuntimeFailure（3、helpなし、causeなし）にする。保存済みを再実行しない案内を出す。

## 互換性と移行

リポジトリ内の従来の公開APIとZodが受理していたcost:[]の拒否により、coreとtraceをminorとする（ADR0002）。CLIも保存後の失敗の終了コードを2から3へ変えるため、loomakeをminorとする。対象はすべて0.0.0で、従来の実装が公開済みとは主張しない。未知費用はcost省略、実額0はkindと0を明記する。Effort形式1は維持し、追記専用の既存原本を書き換えたり、分精度の日時に根拠のない秒を加えたりしない。公開JSON Schema13本は変更しない。全環境の実記録件数は断定しない。

## 試験

既存assertを保持する。srcとkit errorsをtranspileModuleでdata URL化して同時公開を実行する。同じnow・HEADのEffort API衝突も確認する。配布物のruntime・型の試験と旧REQ-175/176のwrapper契約を維持する。

## 独立レビュー初回への対応

PR #462の独立Opusレビュー（f792482e-b37f-426e-b59e-55ce2e1ac8e7、actual claude-opus-5-5、対象0e2cace8）は重大0・軽微3・情報4件。管理役は2026-11-06 JSTにm1〜m3をすべて修正する判断をした。公開Schemaを本数で限定する文言を、Effort専用を追加せず既存内容を保持する表現へ改める。publication試験は例外が実際に投げられたことを捕捉後に必ず検査する。内部JSDocの戻り値をcollisionへ合わせる。固定RuntimeFailureの文言や製品処理は変えず、一時ファイルの安全な確認・片付けをガイドだけに補足する。
