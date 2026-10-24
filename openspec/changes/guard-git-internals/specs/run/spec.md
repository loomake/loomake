## ADDED Requirements

### Requirement: 置換する秘密情報の形
REQ-118 の置換は、`sk-`・`ghp_` などの形に加えて、次の形の文字列も `***` に置き換える MUST。npm のトークン（`npm_` に 36 文字）、Slack のトークン（`xoxb-` などで始まるもの）、GitLab のトークン（`glpat-` で始まるもの）、Google の API キー（`AIza` に 35 文字）、JWT（`eyJ` で始まる 3 つの部分を `.` でつないだもの）、秘密鍵のブロック（`-----BEGIN … PRIVATE KEY-----` から `-----END … PRIVATE KEY-----` まで）、`Bearer` に続くトークン。`Bearer` は残し、続くトークンだけを置き換える MUST。

Source: REQ-199

#### Scenario: 新しい形のトークン
- **WHEN** エンジンの出力に npm・Slack・GitLab・Google のトークンと JWT が含まれる
- **THEN** 保存した出力では、それぞれが `***` に置き換わっている

#### Scenario: 秘密鍵のブロック
- **WHEN** エンジンの出力に複数行の秘密鍵のブロックが含まれる
- **THEN** 保存した出力では、BEGIN から END までが `***` に置き換わっている

#### Scenario: Bearer トークン
- **WHEN** エンジンの出力に `Authorization: Bearer` に続くトークンが含まれる
- **THEN** 保存した出力では `Authorization: Bearer ***` になっている
