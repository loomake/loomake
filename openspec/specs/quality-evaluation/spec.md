# quality-evaluation Specification

## Purpose

既存の品質コマンドが今回出力した内部品質の静的指標を観測する。出典や対象を照合できない値を合格の証拠にせず、測定していない件数や割合を未評価のまま後続の品質判定へ渡す。

## Requirements

### Requirement: 既存の静的指標の観測
製品品質の source が `ci.test_report` の tests_total・tests_failed・tests_passed、`ci.coverage` の statements_pct・branches_pct・functions_pct・lines_pct、`ci.command.<name>` の error_count だけを観測する SHALL。出典・対象・基準・取得時刻を照合できない値は measured にしない MUST。error_count は既存出力から取得できないため未評価にし、終了コードや文字出力から0/1や件数を推定しない MUST。

Source: REQ-430

#### Scenario: 同じ実行のテストとカバレッジを読む
- **WHEN** 既知の版の Vitest または Jest が同じ実行時間内のテストレポートとカバレッジ集計を生成する
- **THEN** passed・failed の実施件数と有限の0〜100の割合を測定値にし、skip・todo・pending を実施件数に入れない

#### Scenario: 古い出力または不完全な出力がある
- **WHEN** レポートの時刻が実行範囲外、出典・hash が不一致、JSON が不正、テストを実行できなかったファイルがある、またはカバレッジが取得不能である
- **THEN** その値を未評価にし、空の結果を0件の成功や0件の失敗にしない

#### Scenario: lintまたは型検査が成功しても件数は未測定である
- **WHEN** 品質コマンドが0または非0で終わる
- **THEN** error_count は unavailable・valueなしとし、未設定なら not_run にする。終了コードはコマンドの実行結果にだけ残す

#### Scenario: 対応しない指標を要求する
- **WHEN** quality.yaml が非対応の source・metric または nonzero_exit を要求する
- **THEN** 観測を作らず証拠不足にし、終了コードでエラー数を代えない
