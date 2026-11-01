# archive metadata の限定分類（[Draft PR #295](https://github.com/loomake/loomake/pull/295)）

1. やったこと：`classify-unchanged-archive-metadata`のtask 1.1〜5.2で承認済みmetadata分類を実装し、HEAD treeの共通検査と負例を追加した。[PR #295](https://github.com/loomake/loomake/pull/295)の再レビュー指摘に従い、L2へ上げたmetadata archiveは既存REQ-132/343どおりchange指定を案内して失敗させる修理と、worklogの短縮を行った。
2. verify：L2の誤期待を現行MUSTへ強めてREDを観測し、1条件の修理後に対象3ファイル164件・lint・型検査が成功した。通常localdoneは21項目すべてPASS、全件2284件中2276 PASS・0 FAIL・既存pending 8で成功した。
3. 残っている確認事項・仮定：承認待ちはなく、規範・要件・旧main試験・設定は変更していない。修理後headの新CI・3 OS・最終独立レビュー・main採用は未完了で、#238への適用はmain採用後からとする。
4. 次にやること：正常localdoneの元レポート・入力対応・保全照合を管理役へ渡し、新しいCIと最終独立レビューを受ける。旧headの数値と中断を含む詳細原本は保持し、管理役がPR本文の証跡と最終受入を確認する。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [Draft PR #295](https://github.com/loomake/loomake/pull/295) | 未測定 | 未測定（着手時刻未記録） | 進行中 | 最終再レビュー待ち | 進行中 |
