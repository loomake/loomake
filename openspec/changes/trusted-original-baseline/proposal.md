# Proposal: trusted-original-baseline

## Why

C001の独立検証器S1は、未完了のまま通常レビューの200KiB上限を超えている。原契約を保持したまま通常DoDを満たす準備部品を先に受け入れ、S1本体の統合と受入を最後に行う。

## What Changes

- 固定commitのGit文書読取り、canonical JSON、差分仕様と主仕様のmanifestを私的な部品として追加する。
- 受入済みの原14文書から元47契約・158 Scenario・46 Source・16横断条件を復元し、初回候補の構造と所有本文を照合する。
- 既存S1実装の9ファイルと対応する6試験ファイルを、本文を保って独立した子changeへ移す。試験名には新番号を加え、元の番号も保持する。公開レビューで見つかった補完参照の重複拒否漏れは、移管後に最小修理と追加回帰で既存REQ-377へ合わせる。集合17箇所の照合で見つかった置換レコードと2種類の採否参照の重複拒否漏れも、同じ範囲で修理する。

## Capabilities

### New Capabilities

- `trusted-baseline`: 固定Git入力・仕様manifest・原契約復元・初回候補の構造照合。REQ-376・377。

### Modified Capabilities

なし。

## Non-goals

- 具体的なC001候補データの公開、作者・API・採否連鎖の検証、新しい適格な実行、judge・loader・controller・S/T照合は後続の子で扱う。
- S1のREQ-370〜375・28 Scenario・14タスクの文面と全受入、親C001の全完成範囲は保持する。この子の受入だけでS1・T PASS・live・S2や親の完了を主張しない。
- REQ-038・042などの公開修理と保護期待値の変更は行わない。公開API・JSON・CLI・依存・品質設定は変更しない。

## Impact

対象は`packages/kit/src/verify/trusted/`の私的な9部品と`tests/trusted-*.test.ts`の6ファイル。元14文書はPR #306でmainへ受入済みのものを使い、原commit本文や作者情報は追加しない。通常L3としてローカル完了・必須CI・3OS・独立レビューを満たす。番号は[予約記録](https://github.com/loomake/loomake/issues/121#issuecomment-6554778264)に従う。
