# Scenarioと試験の対応を確認する

Loomakeのverifyは、RequirementのSourceと、成功したテストの名前にあるREQ-IDの対応を確認する。同じRequirementには複数のScenarioがあるため、各条件と結果をassertしているかは、試験内容を読んで確認する。

## 実行する

リポジトリのルートで、全体の試験を実行してから新しい出力先を指定する。

```sh
pnpm build
pnpm test
node scripts/scenario-audit.mjs .loomake/quality/scenario-audit-new
```

確認済み・有効な置換だけなら終了コード0、未確認や無効な根拠があれば1になる。入力を読めない場合も1で理由を表示する。既存の出力先を上書きしない。これはリポジトリの品質確認用であり、製品のverifyの合否や設定は変更しない。

監査はopenspec/specsと、archive以外のopenspec/changesの差分仕様を対象にする。コード例の見出しは数えない。進行中の未完了の変更も一覧へ含むので、これから実装するScenarioは未確認として残る。主仕様と変更中の文書を黙って合成せず、必要な置換は対応表で明示する。

既定の入力は[scenarios.json](quality/scenarios.json)とloomake.config.jsonのtests.reportである。別の入力を指定する場合は、出力先の後にレビュー表とテストレポートを渡す。

```sh
node scripts/scenario-audit.mjs .loomake/quality/scenario-audit-other docs/quality/scenarios.json .loomake/test-report.json
```

出力はaudit.jsonとaudit.mdで、全件数・状態・仕様の場所・理由・対応試験を含む。JSONには候補と入力ハッシュも残す。[現在の一覧](quality/scenario-audit.md)は、この出力から作る。実行結果は[results.json](../openspec/changes/archive/2026-10-24-audit-scenario-evidence/results.json)を参照する。

## レビューを記録する

対応表の各IDは、文書・Requirement名・Scenario名で決まる。同名でも別文書や別Requirementなら別IDになる。行の移動だけではIDは変わらない。規則やScenario、規則内のコード例が変われば内容のハッシュが変わり、以前のレビューは無効になる。

未精査の行はunreviewedで残す。候補のREQ-IDが一致するだけでreviewedへ変えない。条件を与える準備と、結果を確かめるassertionを読み、対応を確認できた行だけに次を記録する。

- statusはreviewed、scenarioSha256は現在の内容のハッシュ
- reasonには、どの条件と結果をどのassertionで確かめるかを書く
- sourcesには、そのScenarioで確認するSourceのIDを明示する。Requirementに複数のSourceがある場合は対象を説明する
- testsには、テストファイル・fullNameに含む選択文字列・テストファイル全体のハッシュを書く

選択文字列がパラメーター化した複数の試験へ一致する場合、そのすべてが成功している必要がある。失敗・skip・todoを成功した一部で覆い隠さない。試験が実行結果にない、ハッシュが違う、Sourceが違う場合も無効になる。テストファイル全体のハッシュを使うため、別の試験を追加しただけでも、そのファイルの対応を再確認する。

変更後のScenarioが元のScenarioを置き換える場合は、statusをsupersededにし、理由とreplacementのIDを記録する。同じ一覧にある、確認済みのScenarioまでたどれる必要がある。未知の参照や循環を有効にしない。

## 根拠の範囲

監査は、対応の記録と実行結果の整合性を確認する。reasonが十分な説明か、assertionが振る舞いを十分に確かめるかはレビュー上の判断である。入力のテストレポートが、現在の実装全体を本当に実行して得られたかまでは自動で証明しない。必ず全体の試験を実行し、その範囲と入力ハッシュも保存する。

未確認には、試験が存在するか内容をまだ精査していないものが含まれる。すべてを不具合と断定せず、条件と結果の不足を調べる。Linux上の静的検査を、別OS・実エンジン・実際のGitHub接続の成功の根拠として使わない。

直近の件数と検証時点は[対応表](quality/scenario-audit.md)と[実行結果](../openspec/changes/archive/2026-10-24-audit-scenario-evidence/results.json)を参照する。独立したコピーで検証した場合は、そのコミットと追加したファイルのハッシュを記録する。後続の変更を、そのコピーの成功結果から合格扱いにしない。未確認が残る間は、全Scenarioの検証や全評価90点の達成とは報告しない。

## 別のNodeで実行した確認を加える

`runtime-compatibility.mjs`は、実際に成功したチェックをreport.jsonのtestResultsへ出す。Node下限とオフラインの確認を通常の全体レポートへ合わせる場合は、両方のtestResultsを残し、元のレポートのハッシュと実行範囲も保存する。通常のVitestの件数と、別環境の4チェックは区別する。失敗・skipを除外したり、同じテスト名の成功だけを採用したりしない。

照合前には、runtimeの結果にあるスクリプト・通信拒否フィルター・配布物のハッシュを確認する。レポートのパスは実行した作業コピーの中を指す必要がある。Nodeの宣言や候補のREQ-IDだけで、別環境での成功を補わない。今回のNode20の根拠は[実行結果](../openspec/changes/archive/2026-10-24-audit-scenario-evidence/runtime20-results.json)に保存した。
