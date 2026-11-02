# C001原文入力のGit一括読取り

1. [PR #323](https://github.com/loomake/loomake/pull/323) の日別記録の競合を解消し、mainを取り込んだ。原文入力試験と原文書14件のGitオブジェクトは、独立レビュー済みのheadと同一だった。
2. 取り込み後の通常verify（build・lint・typecheck・test）は終了0、原文入力19試験も成功した。必須CIと3 OSは、この記録の時点では再確認待ち。
3. 元headの独立レビューは重大0、軽微1件は[Issue #326](https://github.com/loomake/loomake/issues/326)で追跡している。Issue #321・#275の根本原因は未確定で、過去のWindows失敗とscenario-audit本体のskipを保持する。
4. 同じheadの独立差分レビュー、必須CI、3 OSを確認してから受け入れる。C001全体・S1・live・S2は未完了。
