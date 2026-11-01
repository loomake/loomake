# Design: trusted-original-baseline

## Context

Opusの2026-11-01の分割設計§2 C1と§3 C1に従い、S1の原本読取り・復元・構造照合を独立して受け入れる。原14文書はPR #306でmainへ受入済み。参照する実装はS1の固定版で、製品コード9ファイルと試験6ファイルに限定する。

## Goals / Non-Goals

この子は、固定入力から返すmanifest・復元集合・候補の構造照合を完成させる。REQ-376/377を満たしても、S1の6要件・28 Scenario・14タスク、親C001の全契約、T PASS・live・S2の受入は完了しない。

具体的なC001初回候補の公開と採否主体・API・連鎖・有効基準の検証は後続で行う。既存の公開API・JSON・CLI・run.ts・依存・品質設定・保護期待値は変えない。

## Decisions

### 私的部品を本文不変で移す

| 要件 | 実装 | 試験 |
|---|---|---|
| REQ-376 | canonical.ts・git-objects.ts・spec-manifest.ts | trusted-git-objects・trusted-spec-manifest・trusted-main-spec-manifest |
| REQ-377 | original-snapshot.ts・original-contracts.ts・original-cross-conditions.ts・baseline-types.ts・baseline-shape.ts・baseline.ts | trusted-original-snapshot・trusted-original-contracts・trusted-baseline |

実装は`packages/kit/src/verify/trusted/`、試験は`tests/`に置く。packageの公開exportsへは追加しない。元S1版から全実装blobと各試験callback本文を照合し、試験名には新しい要件番号だけを加える。元の370/371タグ、期待値、期限、skip条件を保持する。未登録タグを理由に元タグを置き換える案は採らない。

### 原本と所有の根拠を分ける

原本は`ORIGINAL_C001_SNAPSHOT_DIR`の14文書を固定manifestと照合し、論理的な原pathへ戻して復元する。元commitをremoteから取得する必要はなく、原commit本文・作者情報も追加しない。固定manifestと現在の候補を同時に書いたことを独立した採否検証とは呼ばない。

差分manifestは変更種別を必須とし、主仕様のunchangedは別の入口で扱う。所有本文は公開parserの開始行と全Scenarioを含むhashで照合する。JSONの非列挙欄・Symbol・配列追加欄・getterを落とす直列化は使わない。

### 構造照合の責任を限定する

初回候補は閉じた形で読み、原47 identityと158 Scenario、16条件、所有本文、補完と置換、open、非空の採否参照、ID付き試験参照を照合する。正例は原14文書から作る独立fixtureであり、現在のC001具体候補の受入票ではない。

主体の固定対応、GitHub API、コメントの編集状態、新しい実行の一意なfile/fullNameは後続の責任である。構造成功でも`adoptionsVerified:false`を返し、結果を防御的に複製・凍結する。

### 通常の受入を使う

この子だけを`loomake-change: trusted-original-baseline`として宣言し、通常のlocal done、ci gate、必須5チェック、3OS、別担当の自己レビューと独立Opusを通す。親C001のtasks・記録とS1の規範はこのPRで変更しない。同期とarchiveの段階は実差分で判定し、L1と決めつけない。

## Risks / Trade-offs

- 構造成功が承認済みと誤読されるおそれがあるため、戻り値と試験に未検証の主体を明記する。
- callbackのタグ追加でfullNameは変わるため、後続の初回データは新しい全体reportから参照を確認する。旧reportを新headの適格な実行とは記録しない。
- WindowsのGit・CRLF・一時repositoryを3OSで確認する。元の期限を延ばして成功させない。
- PRが200KiBを超えた場合は設計のC1a/C1bに分ける。集合・試験・受入を削って収めない。

## Migration Plan

私的部品なので利用者の移行操作はない。受入後はこの子を同期・archiveし、後続のデータと採否の子で利用する。S1本体は子の全受入を待ち、最後に通常DoDと統合試験を通す。
