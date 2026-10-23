# Design

## Context

proposal.mdの5件を既存の依存関係のまま直す。既存のテストは弱めず、失敗する回帰テストを先に追加する。

## Goals / Non-Goals

Gitのパスを表示用の引用形式で解析しない。証拠と設定はunknownから検証する。資格情報と外部サービスの設定は変更しない。

## Decisions

- Gitの変更一覧にはNUL区切りを使う。引用設定を無効にするだけでは改行とタブを扱えないため。
- POSIXのエンジンを独立したプロセスグループにし、SIGTERMの後250msでグループをSIGKILLする。Windowsはtaskkillの子孫停止を維持する。停止後に出力パイプが閉じるまで待つ。
- runRecordに任意のtimeoutMsを追加し、runnerが残り時間を渡す。期限を過ぎた検査結果はPR作成に進めない。単独のtrace recordの既存動作は維持する。
- run設定の検証は現在のrunner内で純粋関数に分離する。設定全体の統合は後続changeで扱う。
- 証拠の検証はtrace内の純粋関数で行い、JSONの読み取りと日本語のエラー表示は呼び出し側が担当する。古いdocumentsなしの証拠を許容し、documentsありなら重複とSHA-256を確かめる。署名による真正性は保証しない。

## Risks / Trade-offs

POSIXでは別のセッションへ離脱したプロセスはグループ停止の対象外になる。これは外部の実行環境の隔離で扱う。Windowsの特殊なファイル名はOSが受け付けないため、区切り文字の回帰試験はPOSIXで行う。

## Migration Plan

追加のAPIオプションは省略可能にする。不正な証拠はエラーになり、利用者は元の証拠を確認する。主仕様の反映はarchiveで行う。
