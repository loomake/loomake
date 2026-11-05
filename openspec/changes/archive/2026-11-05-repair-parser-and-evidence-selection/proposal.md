## Why
Issue #418 の再現で、Markdown の境界・重複 ID・証拠名の選択と SHA 診断に欠陥が見つかった。

## What Changes
7 項目を修理し、表内 ID 重複と正規証拠候補名を仕様にする。BOM 付き編集は元の BOM を保つ。

## Non-goals
Issue #414〜417・#419、原本の hash 用 decode、日時検査の差、answer/approve の重複拒否は変更しない。

## Impact
core と trace の patch。利用者の手元の重複した過去 trace も既存の解析エラー処理に従う。
