# TDD実行記録

## 1.1 案内

pre-push のフックで、git が HTTPS の認証の入力で失敗したときと同じエラーを出させるテストと、認証と関係のないエラーのテストを足した。フックは `GIT_TERMINAL_PROMPT` の値も記録する。現行の実装では、案内がなく、`GIT_TERMINAL_PROMPT` も渡していないので 1 件目が失敗した（関係のないエラーの 1 件は成功した）。git の呼び出しに `GIT_TERMINAL_PROMPT=0` を渡し、commit・push のエラーが認証や署名の入力の文言を含むときだけ案内を添えるようにして、runner の 299 件が成功した。

## 2.1 文書

run-recovery.md に、認証や署名の入力で失敗したときの直し方を書き、changeset を足した。

## 完了ゲート

`pnpm -s verify --change explain-auth-prompts --done` は exit 0。lint・型検査・891 件のテストと全 REQ の対応が成功した。
