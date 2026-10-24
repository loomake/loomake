# TDD実行記録

## 1.1 サブパスを持つ参照

サブパスつきの参照・短い SHA・タグ・記録のないリポジトリと SHA を照合するテストを足し、照合の関数がないので失敗することを確かめた。照合を scripts/action-pins.mjs の関数にして、既存のワークフローの検査もこの関数を使うようにし、release-security の 11 件が成功した。既存の `owner/repo@sha` の検査は同じ条件で残る。

## 1.2 CodeQL のワークフロー

CodeQL のワークフローの起動条件・解析する言語・権限・SHA の固定を求めるテストを足し、ワークフローがないので失敗することを確かめた。codeql.yml と github/codeql-action の v4 のコミットの記録を足して、release-security とワークフローの 16 件が成功した。
