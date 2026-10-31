## ADDED Requirements

### Requirement: C-001の成功経路と不足拒否
verifyのCLIと関数APIは、最小quality.yamlから適格な実証跡に基づく正常なPASS、不正入力のaborted、証跡不足のINSUFFICIENT_EVIDENCEを区別して返す MUST。未実施・古い・旧形式・全NAからPASSを返してはならない MUST NOT。

Source: REQ-319

#### Scenario: 正常・不正・不足の受入
- **WHEN** 最小の適格な実証跡がある正常入力、不正設定、未実施または古い証跡を使って同じCLI/APIを検査する
- **THEN** 正常はciのPASS/0、不正はaborted/2または3、不足はINSUFFICIENT_EVIDENCE/1となる。成功例に手書きのok:trueや未照合の適格フラグを使わない

#### Scenario: 置き残した成功結果を拒否する
- **WHEN** 正常実行後に対象SHAや必須仕様を変え、古い成功結果だけで完了ゲートを実行する
- **THEN** ciのPASSを返さず、不足または対象未確定時のabortedを返す
