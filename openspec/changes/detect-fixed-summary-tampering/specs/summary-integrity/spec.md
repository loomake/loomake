## Purpose

リリース記録から別に渡す固定ハッシュと CI の識別子で、保存済み要約の改変や取り違えを検出する。自己ハッシュの同時改変を受け入れず、再利用の可否と人への差し戻しを同じ照合結果で示す。

## ADDED Requirements

### Requirement: 外部の信頼値による固定済み要約の照合
kit は固定済み要約の本文と、要約とは別に渡された信頼値（固定時の SHA-256、CI の実行 ID・試行番号・対象 SHA）を受け取る named export `checkFixedSummary` を公開する SHALL。本文の UTF-8 の SHA-256 を信頼値のハッシュと完全一致で照合し、要約の中や付随するファイルにあるハッシュは照合に使わない MUST。ハッシュ関数を引数に取らず、I/O・時計・環境を参照せず、入力を変更しない SHALL。

Source: REQ-443

#### Scenario: 改変のない要約
- **WHEN** 固定時の要約と、それに対応する信頼値を渡す
- **THEN** 再利用でき、結果は PASS で、人への差し戻しはなく、理由は空である

#### Scenario: 要約だけを改変した
- **WHEN** 要約の本文の 1 文字を書き換えた写しと、元の信頼値を渡す
- **THEN** ハッシュの不一致を理由に、再利用せず FAIL を返す

#### Scenario: 要約と自己ハッシュを同時に改変した
- **WHEN** 要約を書き換え、要約に付随する自己ハッシュも新しい内容に合わせて書き換えた写しと、元の信頼値を渡す
- **THEN** ハッシュの不一致を理由に、再利用せず FAIL を返す

### Requirement: CI の実行 ID・試行番号・対象 SHA の照合
照合関数は、要約に記録された `ci.runId`・`ci.runAttempt`・`sha` を、信頼値の実行 ID・試行番号・対象 SHA とそれぞれ完全一致で比べる SHALL。trim・大文字小文字の統一・前方一致をしない MUST。一致しない項目ごとに理由を返す SHALL。

Source: REQ-444

#### Scenario: 実行 ID が違う
- **WHEN** 信頼値と実行 ID だけが違う要約を渡す
- **THEN** 実行 ID の不一致を理由に FAIL を返す

#### Scenario: 試行番号が違う
- **WHEN** 信頼値と試行番号だけが違う要約を渡す
- **THEN** 試行番号の不一致を理由に FAIL を返す

#### Scenario: 対象 SHA が違う
- **WHEN** 信頼値と対象 SHA だけが違う要約を渡す
- **THEN** 対象 SHA の不一致を理由に FAIL を返す

### Requirement: 照合の失敗を拒否と差し戻しで返す
照合関数は、理由が 1 件でもあれば `reusable: false`・`result: FAIL`・`returnToHuman: true` と、空でない日本語の理由 `reasons` を返す SHALL。信頼値がない・形が違う、要約が文字列でない・JSON として読めない・照合する欄の形が違うときも、例外を投げずに同じ失敗を返す MUST。理由が 0 件のときだけ `reusable: true`・`result: PASS`・`returnToHuman: false`・`reasons: []` を返す SHALL。

Source: REQ-445

#### Scenario: 信頼値がない
- **WHEN** 信頼値に undefined か、欄の欠けたオブジェクトを渡す
- **THEN** 信頼値の不足を理由に、再利用せず FAIL と差し戻しを返す

#### Scenario: 読めない要約
- **WHEN** 壊れた JSON か、`ci` のない要約を渡す
- **THEN** 例外を出さず、要約を読めないことを理由に FAIL と差し戻しを返す

#### Scenario: 照合する欄の形式
- **WHEN** 信頼値または要約の照合する欄を検査する
- **THEN** 信頼値は `summarySha256` が小文字64桁の16進、`runId` が空でない文字列、`runAttempt` が1以上の整数を先頭ゼロなしで表す文字列、`sha` が小文字40桁または64桁の16進である。要約は `sha` が40桁または64桁の16進、`ci.runId` が空でない文字列、`ci.runAttempt` が同じ試行番号形式の JSON オブジェクトであり、形式が違えば失敗を返す
