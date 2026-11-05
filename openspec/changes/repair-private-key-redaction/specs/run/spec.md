## MODIFIED Requirements

### Requirement: 置換する秘密情報の形
REQ-118 の置換は、`sk-`・`ghp_` などの形に加えて、次の形の文字列も `***` に置き換える MUST。npm のトークン（`npm_` に 36 文字）、Slack のトークン（`xoxb-` などで始まるもの）、GitLab のトークン（`glpat-` で始まるもの）、Google の API キー（`AIza` に 35 文字）、JWT（`eyJ` で始まる 3 つの部分を `.` でつないだもの）、秘密鍵のブロック（`-----BEGIN … PRIVATE KEY-----` から `-----END … PRIVATE KEY-----` まで、および PGP PRIVATE KEY BLOCK）、`Bearer` に続くトークン。`Bearer` は残し、続くトークンだけを置き換える MUST。END 行のない秘密鍵は BEGIN 行から入力の末尾まで置き換える MUST。平文とストリームの両経路で保護し、PGP PUBLIC KEY BLOCK は秘密鍵として置換しない MUST。

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


#### Scenario: PGP の秘密鍵を平文で記録する
- **WHEN** 平文の記録に PGP PRIVATE KEY BLOCK が含まれる
- **THEN** BEGIN から END までが `***` に置き換わり、前後の通常の文は残る

#### Scenario: PGP の秘密鍵がストリームのチャンクをまたぐ
- **WHEN** PGP PRIVATE KEY BLOCK の見出し・本文・終端を任意のチャンク境界で分けて記録する
- **THEN** 秘密鍵が `***` に置き換わり、平文で処理したときと同じ結果になる

#### Scenario: 秘密鍵の END 行がない
- **WHEN** 平文またはストリームの記録が、秘密鍵の BEGIN 行の後で END 行のないまま終わる
- **THEN** BEGIN 行から入力の末尾までが `***` に置き換わり、秘密鍵の本文は残らない

#### Scenario: PGP の公開鍵を記録する
- **WHEN** 記録に PGP PUBLIC KEY BLOCK が含まれる
- **THEN** 平文とストリームの両経路で公開鍵のブロックをそのまま残す

