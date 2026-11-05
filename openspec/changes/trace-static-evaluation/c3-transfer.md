# C3への移管原本（未実装）

出典は親 `feat/trace-static-evaluation-70` の2026-11-05計画と、追加Opus設計79b4d2aaのC1→C2→C3分割である。親worktreeは変更していない。C1はPR #440・archive #441で受入済み。C2はeval・手動要求追跡だけを実装し、本書のstatusは完了扱いにしない。

C2のmain受入とarchive後、`add-quality-status-report` を新規作成し、次のREQ-435・436をADDEDへ移す。REQ-437・438・323のstatus追加は、その時点の採用済みC2全文からMODIFIEDとして作る。ここに残す原文を、C2のdeltaやDoDへ戻さない。

## REQ-435・436の未実装原文

### Requirement: 保存済み評価からの品質状況生成
`trace report --status` は最新索引と履歴の内容全体が一致するときだけ、同じ保存済み判定から `reports/quality/<ISO週年>-<2桁週番号>.md` を生成する SHALL。判定の再計算や入力の修復をせず、欠落・不正・不一致なら2を返す MUST。週と時刻は保存済みUTC日時から計算し、同じ入力から同じバイト列を生成する SHALL。

Source: REQ-435

#### Scenario: 年をまたぐ週と再生成
- **WHEN** 保存済みの評価が年末年始のISO週に属する
- **THEN** 正しいISO週年のファイルを生成し、同じ入力の再生成結果は一致する

#### Scenario: 索引と履歴が一致しない
- **WHEN** runId・attemptが同じでも中身が違う、履歴が不正、またはファイルがない
- **THEN** 2を返してevalによる確認・復旧を案内し、入力を修復も変更もしない

### Requirement: 品質状況の固定書式と未評価の表示
品質状況は結論を含む8項目とし、題と一行の結論に続き、利用時品質目標・製品品質・回帰の疑い・開発効率・未評価と理由・進行中の提案・前回からの変化をこの順の節で表示し、製品品質内の8特性を固定順で表示する SHALL。数値に出典と時刻を添え、前回比は直前の履歴から求める SHALL。未取得の値は未評価と理由を表示し、コマンドの成否をエラー数と混同しない MUST。未評価と理由の節に、未解決の失敗試行の分類と件数、再評価待ち・回収不能の要求の件数を表示する SHALL。

Source: REQ-436

#### Scenario: データのない節も表示する
- **WHEN** 利用時品質、工数、Issue・PRの情報がない
- **THEN** 見出しを省かず、未評価または段階1の対象外という理由を表示する

#### Scenario: 前回から悪化した指標がある
- **WHEN** 前の履歴に同じsource・metric・対象の有限の値があり、失敗件数増加または成功数・カバレッジ減少がある
- **THEN** 回帰の疑いとして値の差を示し、製品品質の同特性内で悪化した対象を先に表示する。原因とは断定しない

#### Scenario: lint成功をゼロ件のエラーにしない
- **WHEN** lintの実行結果がpassedでerror_countの値がない
- **THEN** 成功した実行結果とエラー数の未評価・理由を別々に表示する


## status追加前の親CLI規範（移管元原文）

### Requirement: 手動品質評価のCLI
CLIは `trace eval` と `trace report --status`、それぞれのhelpを受け付ける SHALL。evalは固有オプションを取らず、statusとchange・formatの併用は2で拒否する MUST。操作一覧の既存順を保ってevalを最後に追加し、打ち間違いの候補と生成CLIリファレンスへ反映する SHALL。

Source: REQ-437

#### Scenario: ヘルプと打ち間違い
- **WHEN** trace eval --help または trace evl を実行する
- **THEN** evalの説明を表示し、evlにはevalの候補を示す

#### Scenario: 併用できないオプション
- **WHEN** trace eval --x、またはtrace report --statusと--changeまたは--formatを併用する
- **THEN** 日本語で使い方の誤りを示して2を返す

### Requirement: 従来のレポートと公開契約の保持
statusを指定しない `trace report --change` の入力・出力・終了コードと、change必須の条件を維持する MUST。既存の公開8種類のJSON Schemaと品質リファレンスの生成物を変えず、既存依存の範囲を維持する MUST。

Source: REQ-438

#### Scenario: 従来のリリースレポートを生成する
- **WHEN** trace report --changeを実行する
- **THEN** 従来と同じ引数でリリースレポートを生成し、statusを呼ばない。逆にstatusではリリースレポートを呼ばない

#### Scenario: JSON契約と依存を保持する
- **WHEN** 公開JSONのhash・生成一致・依存範囲を検査する
- **THEN** 既存の検査が成功し、リリースレポートのschemaVersion:2を維持する


# Spec Delta

## MODIFIED Requirements

### Requirement: 現行CLIの全コマンドとオプションのリファレンス
CLIのリファレンスは、CLIと共通の定義から生成する SHALL。全コマンド・操作・各コマンドが受け付けるオプションについて、構文・説明・値を取るかどうか・必須/任意・組合せ条件・既定値・受理値と環境条件を表示する MUST。共通のhelp/version操作も含め、現在のCLIにない引数や未確定のv2契約を追加しない MUST。

Source: REQ-323

#### Scenario: コマンドと操作の列挙
- **WHEN** 現行の定義からCLIリファレンスを生成する
- **THEN** init・verify・trace・run・doctorと、traceのrecord・report・answer・approve・evalを列挙し、各操作のオプションを区別する。doctorに固有オプションがないことも示す

#### Scenario: 必須条件と省略時の振る舞い
- **WHEN** 各オプションの必須性・条件・既定値を表示する
- **THEN** verifyのchangeとゲートの相互条件、reportのmd、runのclaude-code、answer/approveの日付省略時のローカル日付、flag省略時のfalseとskip-permissionsの環境条件を示す。reportの--statusと--change・--formatの排他条件と、evalに固有オプションがないことも示す。必須の値へ架空の既定値を付けない

#### Scenario: 共通操作と境界
- **WHEN** help・versionと値の指定方法を読む
- **THEN** -h/--help、先頭の-v/--version、値付きオプションの空白/等号構文が分かる。helpとversionを各コマンドが通常受理する固有オプションにせず、C-001のv2出力・scope・証拠採否を含めない


## 未実装タスクの移管元原文

- [ ] 4.1 【C3へ全文移管し未完のまま保持】保存済み判定からstatusを生成し、REQ-435・436の未解決失敗・再評価待ち・回収不能の件数、全内容一致・ISO週・固定8項目・未評価・前回比・再現可能性の試験を通す。手動実行のガイドを更新する。
- [ ] 5.1 C2でeval、C3でstatusをCLIへ追加し、REQ-437・438・323 のhelp・排他・打ち間違い・旧report呼出保持を試験する。承認範囲のbaseline差分だけ追加しCLIリファレンスを再生成して一致を確認する。

Q70-04とA70-01の決定は親trace原文を引き継ぐ。C3には未解決失敗の分類・件数、再評価待ちと回収不能の件数も残す。
