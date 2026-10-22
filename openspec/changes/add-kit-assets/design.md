# Design: add-kit-assets

## テストの方針（仮定 A-01）

Skill と AGENTS.md は文章であり、AI の振る舞いそのものは自動テストで確かめられない。そこで、テンプレートに「要件が求める項目が書かれていること」を構造検査（見出し・必須語句の存在）で確かめる。検査は項目の有無を見るだけで、Skill が実際にうまく動くかは、実案件の要件書を通して人が確かめる（architecture.md §5 の順 1）。

## テンプレートの置き場所

`packages/kit/templates/` を配布物の正とする。add-init-cli が完了したあと、このリポジトリ自身の `AGENTS.md` と req-to-openspec Skill は、`loomake init --codex` で置いたものを使う運用に寄せる。Skill はいま、実体が `.agents/skills/req-to-openspec/` にあり、`.claude/skills/` からシンボリックリンクを張っている。init で置き直すと、両方に複製した形になる（add-init-cli の Q-09）。それまでは現行のファイルを出発点にし、変更はテンプレート側にも反映する。
