## ADDED Requirements

### Requirement: archiveしたchangeの通常検査
verifyはactive実pathが存在すれば従来どおりそれを検査し、不完全でもarchiveへ逃げないMUST。activeなしでは同IDの唯一の日付付きarchiveを実対象とし、不在・複数は不合格にするSHALL。標準rootのarchiveでは元repoのHEAD・commands・qualityと実pathのspecs/tasks/coverage/basis/receiptを保ち、外部strictだけ対象原文・現行主仕様・config・project schemaを隔離複写して同CLIで検査し、その旨を示すMUST。copy・strict・実行失敗の検査をPASSにせず、元入力を移設せず、設定・依存を増やさないMUST。

Source: REQ-394

#### Scenario: archiveの通常done
- **WHEN** 唯一archiveを標準rootでCLI/APIから検査する
- **THEN** archiveの実pathと元repoを使い、通常doneとciの全条件を省かずに評価する
#### Scenario: 対象不正と既存active
- **WHEN** archiveが不在/複数、activeが不完全/通常file/dangling・外向きlink、idが不正、またはopenspecDirがopenspec以外のarchive入力を渡す
- **THEN** 不在・複数・標準外は不合格にし、不正idの使い方エラーと既存activeの結果を保持する
#### Scenario: strictの入力と失敗
- **WHEN** 同期前後4種の差分、Scenario欠落・metadata/task不正・copy/外部実行失敗を検査する
- **THEN** 必要入力と診断を失わず同CLI strictへ渡し、失敗をPASSにしない。root/HEAD/commands/qualityを隔離先へ移さず、一時入力を片付ける
