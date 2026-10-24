---
"@loomake/trace": patch
"@loomake/runner": patch
"loomake": patch
---

pushやPR作成失敗後の再実行で、今回の完了ゲートと整合性の確認を行い、直前の合格証拠とコミットを再利用する。既存PRを確認して重複作成を避け、不正な検索結果や検証中のHEAD・ブランチ変更では状態を保って止まる。traceの証拠・文書の整合性確認関数を公開する。
