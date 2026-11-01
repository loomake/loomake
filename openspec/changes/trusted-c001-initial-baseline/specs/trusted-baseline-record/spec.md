## Purpose

C001の初回基準の記録を閉じた形式で読み、元の契約・所有・未対応・採否と試験参照を欠かさず固定する。構造と固定値の一致を、採否主体や新しい試験実行の成立と区別する。

## ADDED Requirements

### Requirement: C001初回基準の記録の読取りと固定照合

システムは親C001の`verification.yaml`をtop-levelが`expected_spec`だけの閉じたYAMLとして読み、構文誤り・重複キー・複数文書・未解決タグ・JSONにできない値と既定100を超えるalias展開を上限を変えずに拒否する SHALL。取り出した初回基準にREQ-377の構造照合を適用し、行・所有・Scenario対応・未対応・置換・補完・採否参照・試験参照の固定件数と、基準側に固定したcanonical sha256の全一致を求める MUST。対象の記録が示すhashや件数では受理せず、成功時も採否主体と試験実行を検証済みとしない SHALL。

Source: REQ-378

#### Scenario: 実際の初回記録を固定値で受け入れる
- **WHEN** 親の`verification.yaml`、原14文書、各所有文書を渡す
- **THEN** alias展開後の値が構造照合を通り、47 identity・158 Scenario・46 Source・16横断条件、49所有、21未対応句、409一意の試験参照を含む固定件数とcanonical sha256が一致する。凍結した基準を返し、adoptionsVerifiedはfalseのままとする

#### Scenario: 具体記録の一部を消す・足す・重ねる
- **WHEN** 行・所有・Scenario対応・未対応・置換・補完・採否参照・試験参照のいずれか1件を削除・追加・複製したコピーを渡す
- **THEN** 構造照合が通る場合も基準とdigestを返さず、不一致の種類を示す

#### Scenario: YAMLの形と展開予算を守る
- **WHEN** 不正なYAML、重複キー、複数文書、未解決タグ、未知のtop-level欄、`expected_spec`の欠落、JSONにできない値、展開予算の超過を渡す
- **THEN** 例外を投げずに日本語で拒否し、既存のalias予算・入力上限・品質設定を変えない

#### Scenario: 後続判断と未対応を保持する
- **WHEN** 受け入れた初回基準を確かめる
- **THEN** 038・042の未対応、042のunchanged所有とPR #217の置換、324の両所有とDUP324、元100への331の追加所有、114のDraftの未対応、205のO1/O2/O3、名前の一致しない17件の句ごとの扱いが残る。構造の受入でこれらを解消済みとしない

#### Scenario: 移管した所有の採否を正確に参照する
- **WHEN** 9契約の所有の採否を確かめる
- **THEN** 各参照が`trusted-c001-initial-baseline`のQ-S1-16〜24の1件ずつを指し、既存のADOPT群と他changeの参照は変えない。採否の作者・回答行・APIは照合しない
