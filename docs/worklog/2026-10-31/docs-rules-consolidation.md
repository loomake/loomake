# 開発規約を 1 か所に統合する

1. やったこと：change なし（L2。`.github/` と `.agents/skills/delivery/templates/` を変えるため）。AGENTS.md を 1 画面に収めて工程の 3 段階を入れ、ADR 0006 にレビュー規則の改訂を足し、delivery スキルと依頼テンプレート・agent-workflow.md の重複段落を参照に置き換えた。PR テンプレートに `loomake-tier:` と証跡ブロックを足し、移動案内だけの ADR 0006 の旧ファイルを消した。
2. verify：文書のみの変更で、仕様ゲート・完了ゲートは対象外。lint と試験はディスク残量のためローカルでは未実施で、CI の結果を見る。
3. 確認事項・仮定：agent-workflow.md の ask-opus.mjs の実行手順と 4 つの原則は、ほかに置き場がないため残した。計画文書 `.loomake/handoff/rebuild-plan-2026-10-31.md` はリポジトリ管理外なので、要点は PR 本文に写した。`.loomake/handoff/README.md` はリポジトリ管理外のため未対応で、管理役が ADR 0006 との矛盾箇所を参照に置き換える。
4. 次：gate の 3 段階化（`ci-gate.mjs` の `loomake-tier` 判定）を L2 の PR で進める。
