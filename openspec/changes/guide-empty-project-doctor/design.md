# 空のプロジェクトの導入案内

## 採用した設計

採用設計は `.loomake/handoff/design-282-item1-2026-11-01.md`、実施計画は `.loomake/handoff/plan-282-item1-2026-11-01.md`。設計は利用者の指示で Claude（Fable 5.1）が直接行った。通常開発の経路で進め、難しいバグの経路や設計のやり直しは使わない。

U-01 は案 A で確定済み。init の commands は npm の 3 コマンドを維持し、doctor の終了コードも変えない。package.json の不在は問題のままとし、利用者が次に行う操作を直し方に示す。

## doctor の分岐

`packages/kit/src/doctor/doctor.ts` で package.json を読む前に、ファイルの有無を確認する。読み取り例外のメッセージから ENOENT を判定しない。既存の予算つき読み取り、script の静的な分類、実行ファイルの検出を維持する。

不在の場合は、対象となる commands の設定名と呼び出し先の script 名を集め、既存の報告を 1 回にする仕組みを使って問題をまとめる。commands.test が `pnpm run check` なら、案内の対象は commands.test と scripts.check になる。対象外の commands は文に含めない。package.json がある場合の JSON・型・容量・読み取り権限の問題は既存の文を維持する。

AC-01 の日本語は C-02 に従って整えてよい。package.json がないこと、該当する commands の名前、commands の書き換えと package.json・scripts の用意という 2 つの直し方を保つ。

## init の案内

`packages/kit/src/init/init.ts` の package.json 不在時の案内に「書き換えるまで、loomake doctor は test の script を確かめられず問題として出します」を加える。既定の commands、既存ファイルの保護、package.json がある場合の案内は変えない。

## 再現と実装の順序

R-01〜R-03 は親リポジトリ外の新しいディレクトリで実施し、npm が PATH にある環境で、問題 2 件・1 件・0 件と終了コード 1・1・0 を確認した。全出力・終了コード・which・config は `.loomake/issue-282/` にある。H-01 は確認でき、設計の差し戻しは 0 回。

`#285` の PR がマージされるまで製品コードとテストは変更しない。実装は tasks の順で RED → GREEN を記録する。AC-01 は package.json 不在時の問題 1 件・対象名・2 つの直し方・終了コード 1、AC-02 は既存の不正ファイル経路、AC-03 は init の追記と npm 既定値、AC-04 は init → doctor の問題 2 件・終了コード 1 を確かめる。AC-05 のファイル不変更・品質コマンド不実行・ネットワーク不接続の既存テストも維持する。

## 検証とレビュー

`openspec validate guide-empty-project-doctor --strict` と仕様ゲートを通した後、#285 のマージを待つ。実装後は lint・typecheck・test、ローカルの完了ゲート、同じ head の CI の完了ゲートと必須 CI、変更した package の 3 OS の試験を確認する。CI が成功してから新しい Opus セッションで `--role review` の独立レビューを行う。起動・実行試行回数、正常に完了したレビュー数、ADR 0006 の往復回数を分けて記録する。

試行は 3/7（版 1）。手順の固定元は `6fa36825460518970d81b7485b93a94ac3a51d06`、コードの基点は作業開始時の最新 origin/main。Fable 5.1 の直接設計は版 1 の Opus 設計との違いとして記録する。マージは利用者の確認後に行い、Issue #282 は閉じない。
