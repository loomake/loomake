# spec/verify-v2-c001

1. [PR #139](https://github.com/loomake/loomake/pull/139)のレビュー指摘を受け、`verify-v2-c001`のタスク1.1の計画整合を引き継いだ。開始時headは`8b3e2c5`、作業ツリーはcleanで未push変更はなかった。製品コードは変更しない。
2. OpenSpec strictはexit 0。受入済みmain `f4e3edb`の主仕様を一時snapshotへ展開したstrictもexit 0で、archive整合の警告はなかった。この旧branch単独のstrictには主仕様未同期のINFOが残るため、実装前にmainとの整合を確認する。spec-onlyは未回答10件でexit 1。doneは未回答・確認待ち要件・未完了tasks・要件対応テスト未実装の4検査でexit 1、既存lint・型・テストの3コマンドは成功した。ローカルのテストは1,259成功・既存8件skip・失敗0で、mainとのmerge結果を使うCI件数とは区別する。yomiyasuのlint/diff/最終稿照合とdiff --checkを実施した。
3. R-C001-01〜10は未回答。03の取得範囲と04の判定器を分け、05互換・06DoD・07quality移行・08warn・09旧Schema公開・10spec-only計数を追加した。採否や既存assertion変更の承認は代行しない。#60/REQ-307はPR #140・#141で受入済みで、現在の実装停止理由には数えない。
4. 差分仕様と計画を整合し、strict・仕様ゲート・doneの結果を管理役へ渡す。実装、追加AI評価、マージは行わない。

## 既存工程記録の移記

2026-10-29の既存記録から、Opusの設計著述3回はactual model `claude-opus-5-5`のみ、fresh session、exit 0、is_error=false、permission_denials=[]と記録されている。初稿sessionは`46c6f248-d65b-44c4-a4c3-23940167a414`、第2稿は`68e661c1-3d1d-407f-9493-4614cbb64b86`、第3稿は`13b92bac-7e8a-42b4-b281-e62bf76044ad`である。今回は呼び直さず、保存先のignoredファイルを公開証拠として参照しない。著述は独立評価として数えず、今回の追加AI評価0、過去のPR139ローカル評価回数は不明で上限をリセットしない。独立レビュー・人の採否は未実施のままである。

既存の限定実験では、Node24.21.0と公式SHA256に一致するNode22.12.0 linux-arm64で、core/kitの静的入口からZodが読み込まれず、必要時に同期loaderでschemaをload/parse/cacheできたと記録されている。Node22.12ではrequire(ESM)のExperimentalWarningと観測器終了時の診断があり、製品統合や配布時のstderrを検証した結果ではない。OpenSpec1.14.3の一時rootではverification.yamlを追加してもstrictが通ったが、配置の許容だけで内容の検証ではない。今回はこれらの実験を再実行せず、既存記録の事実と制約を移記した。

## 再レビューへの対応

1. [追加レビュー](https://github.com/loomake/loomake/pull/139#issuecomment-6509157676)を受け、head `9869726`・cleanの状態からタスク1.1の計画整合を引き継いだ。末尾のおすすめは回答ではなく、10件とも未承認として扱う。
2. strictはexit 0、現main f4e3edbの主仕様を展開した一時snapshotでもINFOなしでexit 0。spec-onlyは未回答10件だけでexit 1。通常doneは未回答・確認待ち・未完了tasks・要件対応テスト未実装の4検査でexit 1、lint・typecheck・testは成功した。ローカル試験は1,259成功・既存8件skip・失敗0。初期quality候補のversion 2構造解析も成功したが、実証跡取得や品質PASSの証拠ではない。yomiyasuとdiff --checkを実施した。
3. 全台帳行を確認待ちに揃え、R08のゲート/scope別警告移行とPASS/NA比較、R05/R08のREQ-191、R07の初期必須1項目と全open PR再検証を具体化した。S1は既存実装を調べ、1人AIなしの実作業44〜88人時と8項目の内訳・前提・対象外を提示した。見積りは実績や承認ではなく、既存C-001の固定見積りも変更していない。
4. 計画のみを修正して管理役へ引き継ぐ。製品実装、追加AI評価、投稿、マージは行わない。

## 3回目レビューと部分承認への対応

1. [3回目レビュー](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693)を受け、head `3ab373e`・cleanから計画整合を引き継いだ。R-C001-01/02/03/04/07/09/10のAを、rrr-xxxの指示を受けたrrr-www名義・Claude Code代筆の明示コメントに基づき2026-10-30の承認として記録する。R-C001-05/06/08の保留は別記し、回答欄は未決のままにする。
2. 最新main `751a8a1b6ffca673f44f2fa272b9029a667bf12b`をfetchし、一時snapshotのstrictはINFOなしexit 0。25件のMODIFIEDで既存73 ScenarioとSourceの保持、別に149のURL SHALL/全4 Scenario保持を照合した。branch単独strictは旧主仕様未同期のINFO付きexit 0。spec-onlyはR05/06/08の3件だけでexit 1、doneは未回答・確認待ち・未完了tasks・未実装REQ試験の4検査でexit 1。lint・型・既存試験1,259成功/skip8/失敗0、diff --checkと日本語のyomiyasu検査を確認した。
3. 方針の承認と、既存assertion/CLI基準fixtureの具体的変更に必要な個別承認を区別する。保留3件が残るため製品実装は開始しない。
4. CLI changeとfix-quality-reference-source-linksの仕様同期/archiveを先に受け入れた最新mainでC-001を最終確定する順を明記した。計画の差分だけをcommit/pushし、本文案を管理役へ渡す。追加Opus評価、投稿、マージは行わない。

## 4回目レビューへの対応

1. [4回目レビュー](https://github.com/loomake/loomake/pull/139#issuecomment-6510532640)を受け、head `665d458`・cleanから計画整合を引き継いだ。おすすめは新しい回答ではなく、R01/02/03/04/07/09/10のA承認とR05/06/08の未回答を維持する。
2. fetchしたmainは751a8a1。29 MODIFIED（現main27件、未archive CLI2件）の既存89 Scenario/Sourceと、149のURL文/全4 Scenario保持を照合した。branch単独strictは古い主仕様のINFO付きexit 0、現main snapshotはCLI未archiveのINFO付きexit 0。依存2changeの仕様反映後を一時領域だけで構成したstrictはINFOなしexit 0で、実際のarchive実施とは区別する。spec-onlyはR05/06/08だけでexit 1、通常doneは計画の4検査でexit 1。lint・型・試験は成功し、ローカル1,259成功/skip8/失敗0。日本語のyomiyasuとdiff --checkも確認した。
3. R05へREQ-323/324のMUST範囲、REQ-100のlocalゲート、REQ-306の接続範囲を追加する。R08は共通のA部分を保ち、auto CLI不在localだけ理由付きNAとするBを新しいおすすめにするが、未承認のまま提示する。
4. 計画だけをcommit/pushし、本文案を管理役へ渡す。製品実装、追加AI評価、投稿、マージは行わない。
