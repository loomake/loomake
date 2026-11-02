# trusted-baseline-reader Specification

## Purpose

初回基準の記録を閉じたYAMLとして読み、原本と所有の構造に加えて基準側の固定件数とdigestへ照合する。構造と固定値の受入を、採否主体や新しい試験実行の検証から区別する。

## Requirements

### Requirement: 初回基準の閉じた記録と固定値の照合

システムは初回基準の記録をtop-levelが`expected_spec`だけの閉じたYAMLとして読み、構文誤り・重複キー・複数文書・未解決タグ・JSONにできない値・既定100を超えるalias展開を、上限を変えず例外を投げずに日本語で拒否する SHALL。取り出した値にREQ-377の構造照合を適用し、基準側から渡された固定15件数とcanonical sha256の全一致を求める MUST。失敗時は基準とdigestをnullとし、成功時は凍結した基準を返すが、常に採否主体と新しい試験実行は未検証とする SHALL。

Source: REQ-387

#### Scenario: 合成した全原集合を基準側の固定値で受け入れる
- **WHEN** 原14文書から合成した47契約・158 Scenario・46 Source・16横断条件の記録、所有文書、基準側の15件数とdigestを渡す
- **THEN** 構造と全固定値が一致した場合だけ凍結した基準とdigestを返し、入力と共有prototypeを変更せずadoptionsVerifiedをfalseに保つ

#### Scenario: 構造だけでは通る変異も固定値で拒否する
- **WHEN** 構造照合を通る記録の件数や採否参照の値を変え、元の基準側固定値と渡す
- **THEN** 件数の不一致項目かdigestの不一致を日本語で示し、基準とdigestを返さない。記録側のhashや件数の自己申告は受理根拠としない

#### Scenario: YAMLの形と展開予算を守る
- **WHEN** 不正な構文・重複キー・複数文書・未解決タグ・未知のtop-level欄・expected_specの欠落・配列root・非JSON値・既定alias予算の超過を渡す
- **THEN** 例外を投げず日本語の問題を返し、基準とdigestをnull、adoptionsVerifiedをfalseとする。入力・alias・品質設定の上限を変えない

#### Scenario: 原集合や所有の不一致を引き継ぐ
- **WHEN** 原集合か所有本文が一致しない記録を渡す
- **THEN** REQ-377の問題を保持して拒否し、固定値の一致だけで構造の失敗を受け入れない
