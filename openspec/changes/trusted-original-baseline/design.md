# Design: trusted-original-baseline

## Context

Opusの2026-11-01の分割設計§2 C1と§3 C1に従い、S1の原本読取り・復元・構造照合を独立して受け入れる。原14文書はPR #306でmainへ受入済み。参照する実装はS1の固定版で、製品コード9ファイルと試験6ファイルに限定する。

## Goals / Non-Goals

この子は固定入力から返すmanifest・復元集合・候補の構造照合を完成させる。REQ-376/377を満たしても、S1の6要件・28 Scenario・14タスク、親C001の全契約、T PASS・live・S2の受入は完了しない。

具体的なC001初回候補の公開と採否主体・API・連鎖・有効基準の検証は後続で行う。既存の公開API・JSON・CLI・run.ts・依存・品質設定・保護期待値は変えない。

## Decisions

### 元の本文を保って移管する

| 要件 | 実装 | 試験 |
|---|---|---|
| REQ-376 | canonical.ts・git-objects.ts・spec-manifest.ts | trusted-git-objects・trusted-spec-manifest・trusted-main-spec-manifest |
| REQ-377 | original-snapshot.ts・original-contracts.ts・original-cross-conditions.ts・baseline-types.ts・baseline-shape.ts・baseline.ts | trusted-original-snapshot・trusted-original-contracts・trusted-baseline |

実装は`packages/kit/src/verify/trusted/`、試験は`tests/`に置く。packageの公開exportsへは追加しない。初回移管では元S1版から全実装blobと各試験callback本文を照合し、試験名には新しい要件番号だけを加える。元の370/371タグ、期待値、期限、skip条件を保持する。既存109件のcallbackは不変とし、バイト上限・ADDED・入力不変を直接確認する3試験（T-A/B/C）を追加する。baselineのJSON境界3宣言には376タグも加える。未登録タグを理由に元タグを置き換える案は採らない。

### 原本と所有の根拠を分ける

原本は`ORIGINAL_C001_SNAPSHOT_DIR`の14文書を固定manifestと照合し、論理的な原pathへ戻して復元する。元commitをremoteから取得する必要はなく、原commit本文・作者情報も追加しない。固定manifestと現在の候補を同時に書いたことを独立した採否検証とは呼ばない。

差分manifestは変更種別を必須とし、主仕様のunchangedは別の入口で扱う。所有本文は公開parserの開始行と全Scenarioを含むhashで照合する。JSONの非列挙欄・Symbol・配列追加欄・getterを落とす直列化は使わない。

### 構造照合の責任を限定する

初回候補は閉じた形で読み、原47 identityと158 Scenario、16条件、所有本文、補完と置換、open、非空の採否参照、ID付き試験参照を照合する。正例は原14文書から作る独立fixtureであり、現在のC001具体候補の受入票ではない。

主体の固定対応、GitHub API、コメントの編集状態、新しい実行の一意なfile/fullNameは後続の責任である。構造成功でも`adoptionsVerified:false`を返し、結果を防御的に複製・凍結する。

### 通常の受入を使う

この子だけを`loomake-change: trusted-original-baseline`として宣言し、通常のlocal done、ci gate、必須5チェック、3OS、別担当の自己レビューと独立Opusを通す。親C001のtasks・記録とS1の規範はこのPRで変更しない。同期とarchiveの段階は実差分で判定し、L1と決めつけない。

### 公開レビューで見つかった既存仕様の漏れを直す

自動Codexの指摘4435217459を採用し、REQ-377の集合重複拒否へ合わせる。`baseline.ts`に補完参照の一意性検査を加え、同じ有効参照1件は受理し、同じ参照2件は拒否する追加回帰T-DでREDからGREENを確かめる。8実装のblobと既存53宣言のcallback・入力表・期待値・期限は保持し、`baseline.ts`だけの修理差分を別に照合する。最初の3追加試験も保持し、全113ケースで検証する。

2要件・全10 Scenarioと原集合は変えない。Opusの元設計にある集合の重複拒否という受入条件を再利用し、私的部品の境界や入出力は追加しない。旧headのCI・レビューは履歴として保持し、修理後のheadで通常検証と必要なレビューを行う。統合前の別の残条件は[Issue #310](https://github.com/loomake/loomake/issues/310)で追跡する。

### 置換に関する集合の重複も拒否する

補完参照のT-Dを保持して17箇所の正例と重複を照合したところ、置換レコード、Scenario置換の採否参照、句置換の採否参照の3箇所は重複を受理した。REQ-377の集合重複拒否へ合わせ、既存のcanonicalな一意性検査を各箇所へ加える。正しい1件は受理し、同じ記録や参照を複製した入力は拒否して基準とdigestを返さない。追加回帰T-E/F/Gで修理前の失敗と修理後の成功を確認する。

元の8実装blob・53試験宣言と、追加済みT-A〜Dのcallback・期待値・入力表・期限を保持する。製品の修理は引き続きbaseline.tsだけで、この段階の全116ケースを確認した。2要件・10 Scenario・原集合・公開API・設定は変えない。当時送信承認待ちだった8363とその依頼は別の固定worktreeに保持し、同じ担当がこの隔離worktreeで追加修理する。並行するchangeや担当は増やさない。

## Risks / Trade-offs

- Git読取りはC1では試験からだけ呼ぶ未接続の部品である。verify・CLIへ統合する前にREQ-180/183の期限・出力予算へ接続し、不正UTF-8の拒否も保持する。既存規範の免除や統合済みという意味ではない。

- 構造成功が承認済みと誤読されるおそれがあるため、戻り値と試験に未検証の主体を明記する。
- callbackのタグ追加でfullNameは変わるため、後続の初回データは新しい全体reportから参照を確認する。旧reportを新headの適格な実行とは記録しない。
- WindowsのGit・CRLF・一時repositoryを3OSで確認する。元の期限を延ばして成功させない。
- PRが200KiBを超えた場合は設計のC1a/C1bに分ける。集合・試験・受入を削って収めない。

## Migration Plan

私的部品なので利用者の移行操作はない。受入後はこの子を同期・archiveし、後続のデータと採否の子で利用する。S1本体は子の全受入を待ち、最後に通常DoDと統合試験を通す。


### 同じ句の異なる記録を重複として拒否する

自己レビューの軽微1は、同じclauseに異なるbyまたはownerを付けた記録が受理される点である。REQ-377の集合重複拒否へ合わせ、supersessionsとopenの識別子をclauseとし、同じ句の2件を拒否する。採否の複数参照は同じレコード内のby配列に保ち、句の二重記録で表さない。各正常な1件が受理されることと、異なる採否/ownerでも同じ句が拒否されbaselineとdigestを返さないことを、新T-H/IでREDからGREENへ確認する。

8実装blobと既存60宣言、元53宣言と追加T-A〜Gのcallback・入力・期待値・期限を保持する。baseline.tsの2つの識別子を直し、追加のarchive修理も含めて全119関連ケースと通常品質・local done、修理後の自己レビューと独立最終レビュー・3OS CIを確認する。今回と後続headの同じ24ファイル・2要件10 Scenarioでの送信/公開は、利用者が本会話の質問call_c55b70faへ明示承認した。


### archive所有先の省略形と明示形の重複

自動Codex指摘4435476339を採用する。ownerBlockがarchive pathからchangeを解決し、本文・Scenarioまで照合した後で、実fileとRequirement名の組が一意か確認する。既存の入力側の重複検査や不正change拒否は残し、正規化用の別parserや公開APIを追加しない。新T-Jは明示形と省略形が各1件なら受理され、両方を同じ所有先へ並べた候補はbaselineとdigestを返さないことをREDからGREENへ確かめる。元62宣言と8実装blobを保持し、新しい拒否検査1行と新1宣言だけを加える。
