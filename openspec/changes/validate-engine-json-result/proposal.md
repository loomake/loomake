# validate-engine-json-result

## Why

終了コード0だけでは、エンジンがタスクを正常に終えたとは判断できない。JSON結果が失敗を示す場合や形が不正な場合も、現在のrunnerはタスクの完了・変更不要の合図・完了ゲートの直しへ進む余地がある。結果を元の標準出力で分類し、既存の停止優先順位とガードを保ったまま、異常な結果では処理を止める。

出典はplan90のE3、既存Opus設計の最終稿b95d2ffb、2026-10-30の管理役の採用判断と、Issue121の予約コメント6524458298である。管理役はADR0006の包括承認で確認事項へ回答し、この一つのchangeで分類・ガード・停止・回帰・実観測を扱う方針を指定した。原資料の版・行・hashはtraceと専用treeの`.loomake/e3-adoption/input-manifest.json`に記録する。

## What Changes

- REQ-340を追加する。終了コード0で先行停止がない場合、出力保存後に元の標準出力を分類し、失敗か形の異常なら既存ガードと必要な表示を行って停止する。タスク完了・commit・NoChange完了・再gate・後続engineへ進まず、indexから外した変更を作業ツリーに残す。
- REQ-341を追加する。失敗優先の純粋な分類と、ガード後の純粋な判断を定義する。許されたsubtypeと分類・出力パス以外の本文を停止理由へ出さない。
- 既存REQ-204・099・330の二つのRequirement・331・100を全文で更新し、正常経路と全既存Scenarioを維持する。REQ-100の追加Scenarioはa1原文を復元する。同じSource204の別契約を変更しない。
- 分類前のoutput保存失敗と、分類後のsummary/stop保存失敗を分ける。前者は既存のI/O停止、後者はREQ-179の短い理由と表示を維持する。
- 実際のCLI 2.1.307/2.1.308とsuccess/error_max_turnsの4件を、既存の認証・設定源・hook・保護を維持し、原raw・認証秘密を永続化しない条件で採集する。条件を確認できないcaseは未収集とし、Issueと未完了taskを残す。
- 保存する観測をprojection・derived・metarecord・syntheticに分け、表・例・schemaと試験名を一致させる。原rawのhashを保存せず、元の値を保存しないことによる検証の限界を記録する。

## Non-goals

C001/S1のverify v2・local/ci切替・producer mappingは採用しない。現行のverify --done契約を保つ。C001が先に採用された場合は、統合した全文と試験を再検証する。

ログ容量、認証方式、許可設定、MCP設定、hook、通常CI、試験の予算・timeout・期待値、配布の完成範囲は変更しない。設定源を無効化したり、秘密を一度ログへ書いて消したりしない。CLI更新や実観測の不足を合成fixtureで埋めて完了にはしない。

この起案だけでは製品実装・実観測・完了ゲート・最終レビューを完了していない。初回配布全体の完了でもない。

## Impact

capabilityはrunとrun-decision-policy。実装対象はrunnerのrun/phases、run/decision-policyと必要な記録接続、既存fake engine fixture、直接試験・runner回帰である。公開indexへの不要なexport、別パッケージ、新しい常駐機構は追加しない。

既存Source/Scenarioの保持は独立した比較資料で確認する。既存guard・index解除・記録予算はREQ-112・118・154・179などの現行契約を使い、同Sourceの別Requirementを誤って置換しない。独立設計A1・A2・A3・Bと2026-10-31の管理判断はdesign7章に記録した。engine.tsのraw/text契約と既存recorderは保ち、collector採集の保護前提が未確認の間も製品D01〜D05は先行する。実装時のchangesetと最終受入はtasksに残す。
