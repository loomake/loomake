# 利用者を呼ぶメンションの宛先を直す

1. やったこと：ADR 0006 と PR テンプレートのメンションを `rrr-xxx` から `rrr-www` に直し、ADR には 404 の原因と通知の経路を書き足した。過去の記録（worklog・archive・verify-v2-c001 の回答者欄）は変えていない。
2. verify の結果：change を持たない L2 の文書変更なので verify は対象外で、`pnpm -s lint` は合格した。worklog と archive を除くと、`@rrr-xxx` の出現は 0 件になった。
3. 残っている確認事項・仮定：Claude モバイルアプリへの push が実際に届くかは、まだ確認していない。
4. 次にやること：CI・Codex・独立 Opus のレビューを経てマージする。
