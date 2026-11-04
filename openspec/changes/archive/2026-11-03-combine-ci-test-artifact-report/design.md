# Design

## Context
M1のparseCiTestMetadata/型と共有errorLineの修理は#380（main7d7f69b5）で受入済み。metadataにreport本文hashはなく、reportState/countsはwriterの申告値である。目的はproposal.mdを参照する。

## Goals / Non-Goals
公開変換を同期のまま組み合わせ、片側不正でも正常側を返す。取得・時計・結付け・適格性・合否・kit接続は含めない。

## Decisions
- 既存Opus79d5e9c4と補足704c57db §3/5/6を再利用。新規ci-test-artifact.tsでCiTestArtifactInput（metadataのfile/text、reportのfile/textまたはnull）とCiTestArtifact（nullableなmetadata/report）およびparseCiTestArtifactを公開する。
- metadataはparseCiTestMetadata、reportはparseTestReportをそれぞれ呼ぶ。不正reportの既存の空valueは組ではnullにし、両側のerrorsをmetadata→reportの順で合わせる。全体を失敗として両値を捨てる案は本人Q-C003-03=Aに反するため採らない。
- 不在nullと、正常な空report、不正な空文字列を区別する。申告からstatus/件数/時刻/版/hashを補わず、既存parserの正負結果とerrorLineを変更しない。
- core indexと配布物consumerを同じ受入単位へ追従させる。依存追加・静的zod読込・公開JSON Schema変更・偽のkit callerを加えない。

## 独立レビューの観点（実装前に固定）
REQ392の全4Scenario、REQ391のstrict型/列挙/安全整数/未知項目射影、REQ015/319のstatus・REQ対応・startTimeと既存エラーを保持。片側/両側のsyntax・形エラーと各file/正line/日本語message、freeze入力、両parser結果の完全一致、公開型consumerを確かめる。旧assert/期待/skip/期限/設定を変えない。

## Test mapping
正常/不在/空report、片側2種と両側の不正、不一致metadataとfailed/skipped/other/startTime/REQの本文、freeze入力・既存export保持を[REQ-392]試験で対応させる。M1の実metadata fixtureを再利用し、decoder自体を再実装しない。公開型consumerと既存report/parser試験も実行する。

## Risks / Trade-offs
申告を保証と誤読する危険→ParseResultの値とerrorsだけを公開し、PASSや適格性を加えない。読める両側の結付けとC003/C001全受入は後続に残す。

## Migration Plan
追加APIとcore changesetのみ。自身の仕様同期/archiveを同じ実装PRへ含める。戻す場合は当該PRをrevertし、既存parser契約は変えない。

## Scope budget
計画実数116行。関数/型24・export2・全正負試験85・consumer6・主仕様同期23・changeset5・日別記録8行を加算した合計269行を見込み、同期/archive込み300行以内を実差分で確認する。既存fixtureを重複作成せず、超過時は実装前に範囲を再検討し、試験や条件を削らない。
