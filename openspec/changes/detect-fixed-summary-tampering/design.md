# Design: detect-fixed-summary-tampering

## 決定の出典

管理役が Opus の設計成果物と Issue #71 の受入条件を照合し、Q-01〜05 の推奨 A を ADR 0006 の包括承認で採用した。設計原本と実行情報は `.loomake/claude/e1dd9855-5033-49dc-bd83-03620134eb70/` に保持し、公開する証跡は PR に記録する。

## 配置と公開 API

`packages/kit/src/verify/summary-integrity.ts` に `checkFixedSummary(summaryText: unknown, anchor: unknown): FixedSummaryCheck` を置く。既存の `sha256Hex` を内部で呼ぶため、ハッシュ関数を引数で置き換える入口は作らない。node:* を読めない policy 配下は使わない。

kit の入口から関数と次の型を公開する。

- `SummaryTrustAnchor`: `summarySha256`・`runId`・`runAttempt`・`sha` を持つ。
- `FixedSummaryProblemCode`: TRUST_MISSING / SUMMARY_UNREADABLE / SUMMARY_HASH_MISMATCH / RUN_ID_MISMATCH / RUN_ATTEMPT_MISMATCH / TARGET_SHA_MISMATCH。
- `FixedSummaryCheck`: `reusable`・`result`・`returnToHuman`・`reasons` を持つ。各理由は `code` と空でない日本語の `message` を持つ。

## 入力と判定

1. 信頼値のオブジェクトと必須欄を確かめる。ハッシュは小文字64桁、SHA は小文字40桁または64桁の16進、実行 ID は空でない文字列、試行番号は `^[1-9]\d*$` とする。不足や誤りがあれば TRUST_MISSING だけを返し、それ以上照合しない。
2. 要約が文字列なら、UTF-8 の本文全体のハッシュを信頼値と比べる。改行や空白も本文の一部であり、正規化しない。
3. JSON のオブジェクトとして読み、`sha`・`ci.runId`・`ci.runAttempt` を確かめる。SHA は40桁または64桁の16進を受け、値の比較で大文字を同一視しない。形が違う要約は SUMMARY_UNREADABLE とする。
4. 読めた要約の実行 ID・試行番号・対象 SHA を信頼値とそれぞれ完全一致で比べる。理由はハッシュ、要約の形式、実行 ID、試行番号、対象 SHA の順に集める。
5. 理由が空のときだけ再利用可・PASS・差し戻しなしとする。それ以外は再利用不可・FAIL・差し戻しありを返す。入力は変更せず、誤った入力に例外を投げない。

要約中の追加欄や自己ハッシュの内容は照合に使わない。既存 verify の JSON や `decision` の列挙へ、この関数の結果や理由コードを追加しない。

## 信頼する側と改変する側

試験は Git に固定した `release-record.json` から信頼値を組み立て、変更できないオブジェクトとして保持する。要約と自己ハッシュはメモリ上の別の写しだけを改変する。正常時にも同じ製品関数を呼び、自己ハッシュの単純な照合なら通る改変が拒否されることを確認する。

fixture の本文は `git cat-file blob HEAD:<path>` で読み、Windows の checkout の改行変換から固定ハッシュを分離する。原本を読み直して内容が不変であることも確認する。fixture のリリース記録は W1 の試験用であり、実リリースの承認を表さない。

## 後続との境界

W1 の仮の要約は `sha`・`ci.runId`・`ci.runAttempt` だけを照合する。#69 の正式な保存形式が入るときに再照合する。外部に固定された値の真正性・取得権限を確かめるのは将来の呼び出し側であり、この純粋関数は任意の入力を信頼済みに変える機能を持たない。gate・eval・report の接続と W5 の承認・取得・署名は本 change に含めない。
