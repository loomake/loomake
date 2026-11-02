# archive metadata の限定分類（[Draft PR #295](https://github.com/loomake/loomake/pull/295)）

1. やったこと：`classify-unchanged-archive-metadata`のtask 1.1〜5.2で承認済みmetadata分類を実装し、HEAD treeの共通検査と負例を追加した。[PR #295](https://github.com/loomake/loomake/pull/295)の再レビュー指摘に従い、L2のchange指定案内を守り、L1の不完全archiveでも移動元のactive changeを検証する修理を行った。
2. verify：active changeの検証が呼ばれないREDを観測し、修理後に直接callerを含む対象4ファイル214件・lint・型検査が成功した。通常localdoneは21項目すべてPASS、全件2285件中2277 PASS・0 FAIL・既存pending 8で成功した。
3. 残っている確認事項・仮定：承認待ちはなく、規範・要件・旧main試験・設定は変更していない。修理後headの新CI・3 OS・指摘修正だけかの独立差分確認・main採用は未完了で、#238への適用はmain採用後からとする。
4. 次にやること：正常localdoneの元レポート・入力対応・保全照合を管理役へ渡し、新しいCIと指摘修正差分の独立確認を受ける。旧headの数値と中断を含む詳細原本は保持し、管理役がPR本文の証跡と最終受入を確認する。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [Draft PR #295](https://github.com/loomake/loomake/pull/295) | 未測定 | 未測定（着手時刻未記録） | 進行中 | 2往復済み（指摘修正の差分確認待ち） | 進行中 |
