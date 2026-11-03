# Design

## Context
S2の停止理由はproposal参照。Opus設計は9bbe6b57、同期前後4種×CLI1.14.3/1.15.0の16組は全て対照/隔離で同じexit0。原物は専用WTの.loomake/archive-done-ci-design/sync-probe/に保持する。

## Goals / Non-Goals
CI/verify/strictを一つの必要修理PRにし、最終headで自身のarchiveを通常doneに通す。一般finder・暗黙選択・run/record・設定・依存・TEST/PINは変えない。

## Decisions
- active実pathのlstat entryを先に確かめ、不完全/通常file/dangling・外向きlinkでもarchiveへ逃げない。別resolverで同IDの唯一のdated archiveを選び、既存finderの最新選択を転用しない。 CIは本文明示だけ使い、暗黙選択・L3 none拒否・通常done/JSON判定を保つ。
- runVerifyで一度解決し、checkSpec・quality読込み・tasks・specs・basis/receiptは元repoの実pathを共有する。HEAD・commands・report・producerのrootも変えない。
- 外部strictだけ、対象全体・現行主仕様・config両形式・project schemasを同CLI用tempへ複写する。項目/入力予算とリンク拒否を保ち、原文を変えず、Git/quality/node_modulesを移さない。診断にarchive実対象と隔離入力を示しfinallyで片付ける。未発見CLI等の既存分類は保つ。

- 再openを避け、readerで検査したUTF-8テキストだけを隔離先へ書く。コピー開始tree（change・main specs・schemas）を深さ0とし、directory訪問だけ既存DOCUMENT_LIMITS.maxDepthで数える。深さ32のdirectory内fileは受け入れ、33のdirectoryを拒否してcleanupする。activeの探索は変えない。

## Risks / Trade-offs
標準外の新archiveは不合格、activeは不変。CLI1.14.3はCI固定・1.15.0は開発用で、版を取り違えない。全必要入力や失敗処理を削らず、Source/試験/公開API回帰を確認する。

## 正負試験表
| 関連 | 正例 | 負例・保持条件 |
|---|---|---|
| REQ-394 対象 | active優先、唯一dated archive、CLI/API | 不在/複数/非dated、active不完全/通常file/dangling・外向きlink、不正id、標準外archive |
| REQ-394 strict/元repo |同期前後ADDED/MODIFIED/REMOVED/RENAMED、project schema/configのtask追跡；commands・quality・HEAD/basis/receiptとarchive実path、公開consumer |Scenario欠落・metadata/task不正・copy/外部失敗・上限・リンク。衝突INFOをFAILに変えない；古いreport/未完tasks/未対応REQ/品質失敗を通さず、tempへ根拠を移さずcleanupする |
| REQ-132 CI | 本文明示の唯一archiveと複数id、既存2 Scenario | 複数/不在/active不完全、暗黙/L1 archive/一般finderの既存結果、L3 none拒否を保つ |
