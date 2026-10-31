# Tasks

## 1. 契約の形

- [x] 1.1 子changeを作る。親 `verify-v2-c001` の差分仕様から17件のRequirementを移し、proposal・design・tasks・traceを書く。traceの確認事項には親のR-C001-01〜10とPR #180の採否、分割の判断S8-01〜03を記録する。`verify --spec-only` が0になることを確かめる（REQ-308・309）
- [x] 1.2 core：2.0.0のZodスキーマ（ci/local×completed/partial、aborted、run.errors、scope、checksの4値、summary、decision、verdict）と導出型を追加し、既存の遅延loaderから読めるようにする。`VERIFY_RESULT_SCHEMA_VERSION` は1.0.0のままにし、2.0.0は別の定数で公開する（REQ-274・308・309）
- [ ] 1.3 core：履歴用の `LegacyVerifyResult`・`LegacyEvidence` と、Evidence 2のスキーマ・型を別名で公開する。旧fixtureとスキーマ履歴の1.0.0は変えない（REQ-302・303・304・305）
- [ ] 1.4 core：未知キーの保持（`__proto__` を含む各階層）と、既知の禁止キー（localのverdict、abortedのscope・checks・summary・decision・verdict）の拒否を分けて試験する（REQ-275・307）
- [ ] 1.5 core：版付きのJSON Schemaを書き出し、exportsで公開する。既存のパスは変えない。`scripts/schema-contract-check.mjs` に版付きパスへの変更の試行を加え、既存の8試行と必須項目の削除・改名・版の変更の検出を保つ（REQ-276・322・183）
- [ ] 1.6 kit：純関数 `verifyExitCode(result)` を追加する。usage・configのabortedは2、ほかのabortedは3、decision.required・ciのFAILと不足・localのpendingとfailは1、それ以外は0。CLIにはつながない（REQ-309）
- [ ] 1.7 kit：root `quality.yaml` を予算付きで読み、既定値を補う関数を追加する。構文・型・版・対象外の必須値の不正はconfig、完了ゲートでの不在はruntime、権限不足はpermissionとして返す。verifyへの接続は親で行う（REQ-310）
- [ ] 1.8 kit：`evaluateQualityConditions`（5つの比較演算子の境界、min_samples、NAの理由と確認者、未実施・古い・未照合の不足、FAILの優先、入力を変えない）と、件数の集約（evaluatedはchecksの全件、quality:subjectsのguard、localのpending）を追加する。集約には既存の `aggregateCiVerdict` を使う（REQ-313・314・306）
- [ ] 1.9 trace：Evidence 1/verify 1.0.0とEvidence 2/verify 2.0.0を版ごとに既存のReport 2へ投影する純関数を追加する。書き出しの版より古い証拠には履歴閲覧専用の警告を付け、localとabortedを最終CIの合格と表示しない。証拠にないテストの対応は作らない。既存の日本語の行とJSONの外形は変えない（REQ-316）
- [ ] 1.10 受入：lint・typecheck・全体の試験、旧fixtureがバイト単位で変わらないこと、配布tarballの公開型と版付きJSON Schemaを確かめる。changeset（core minor・kit minor・trace patch、いずれも追加だけ）を加え、`pnpm -s verify --change verify-v2-shape --done` を通す <!-- loomake:gate=done -->
