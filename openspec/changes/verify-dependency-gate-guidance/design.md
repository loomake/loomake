# Design

## Context
base は `7d7f69b5`。Opus 設計 `3380f500-70d2-466b-8b7d-a6fafd6a6157` §3.4/3.5/4.1 を C1a と C1b に分けた後半である。C1a は `cf4309dd` の内部 reader を固定したが未受入で、実装はその main 受入後に始める。
## Goals / Non-Goals
REQ-401 の CLI 分類を既存の同期 runVerify に接続する。C1b では全3種類の構文正の宣言を未確認とし、提供元 DoD・CI job・Issue・path blob の確認、ネットワーク、producer、権限は後続に残す。
## Decisions
- checkSpec の既存 trace 読み取りを text に残して parseTrace と readDependencies に共有し、checkSharedQuestions の直後に接続する。再読・core Trace 拡張・4 callers の変更を避ける。
- 節なしなら記録を追加しない。構文エラーがあれば check「依存する成果物」を fail とし、`trace.md:<行> <取得できたD-id> <理由>` を改行で連結する。IDを取得できない表の誤りに仮のIDを作らない。C1aは不正行もdeclarationsに残すため、errorsを必ず先に判定し、非空の宣言配列を合格の根拠にしない。
- エラーなしなら1 checkだけを warn（spec-only）または insufficient（done）で記録する。例は `案内：REQ-006 ← D-01 change add-x（未確認）`。複数の関連REQは宣言内の順、複数行は表順で示す。存在や完了を確認したとは表示しない。
- 既存 toCheck/assembleVerifyResult/formatVerifyResult/verifyExitCode を使い、reasonの案内接頭辞とlocal/ciの集約を保つ。enum・decision・run.errors・公開型・依存方向・新依存パッケージは変更しない。
## 試験と独立レビューの観点
- 新規 `packages/kit/test/verify-dependency-gates.test.ts`：有効な全3種をspec-only/local/ciとdone/local/ciで検査し、checkの分類・順序・reason・要判断なし・errors空・exitを確かめる。doneの他検査は既存withProjectで正常にし、skip-commandsを使わない。
- 構文不正は表なし・列不正・重複ID・未知REQ・自己/archive・提供元欠落・Issue他repo・親path・blob/CI不正を両gateで検査する。valid行とinvalid行の混在、不正行だけでdeclarationsが非空の場合も必ずFAILにする。C1aの58試験と旧期待値は変更しない。
- 節なし/旧節だけ/フェンスだけは同一fixtureのbefore/afterで全JSON・format・exitを比較する。未回答blocking・未承認仮定の併存では他checkとdecisionが基準のままであることを確かめる。
- 新規 `packages/cli/test/verify-dependency-guidance.test.ts` は既存CLI試験と同じ main(argv,IO) 経由でspec-onlyの「!」・doneの不足/exit1・--jsonの2.0.0スキーマ適合・stdoutがJSONのみを確認する。CLI実装は変更せず、withProjectと既存schemaを使う。
- trace本文readの回数とgh/gitの依存由来追加呼出し0を宣言なしとの比較で確認する。既存qualityのgit利用や通常openspecを禁止したとは扱わない。既存入力上限/UsageError/abort試験を期待不変で回帰する。
- 保持REQ：034〜042/046/047/132/172/183/298/299/303/308/309/311/319/360/361/394。既存assert・期待・skip・期限・設定を変えない。
## Risks / Trade-offs
- 未確認でもspec-onlyのPASSを依存完了と誤解しうる → 全宣言に未確認を明示し、doneは必ず不足とする。後続の正の照合は別changeで追加する。
- CLI試験と全計画を含め300行を超えうる → 下の見積を実装前に確認し、試験を削らず先に分割する。
## 全差分の見積
計画の実数はproposal15 + design27 + trace28 + tasks9 + yaml2 + delta26 = 107行。main同期26 + 接続17 + kit試験75 + CLI試験35 + 日誌8 + changeset4を加えて272行、予備15行を含め287行を見込む。C1a source/specはこの子に重ねて数えず、main受入済みを前提とする。
## Migration Plan
C1a受入と仕様ゲート後に、新規試験の意味あるRED、最小接続、既存回帰と通常localdone0を順に確認する。自身の仕様同期・archiveを同じ実装PRに含め、最終CIのarchive通常done・必須5・3OS・独立レビューで受け入れる。計画だけのPRは作らない。
## Open Questions
C1bにブロッキングな未回答はない。必要CI集合U1と他project producer契約U2は正の照合を実装する後続の未決であり、おすすめを本人回答にしない。Q-DEPの4回答だけで全DoDの立証済みとはしない。親#285は未完。
