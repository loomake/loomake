# Tasks

## 1. 仕様

- [x] 1.1 REQ-148・149の差分仕様と出典、J04の決定をそろえ、OpenSpecのstrict検査と仕様ゲートがexit 0になることを確かめてコミットする。

## 2. 移管

- [x] 2.1 既存2関数と結果型をkitへ移し、coreのモデル変換を保って利用側とテストを追従する。公開元のREQ-148・149のテストを追加し、既存の期待値を保つ。mutationハーネスの13条件・検出分類を維持して関連試験を通す。core・kitのminor changesetと移行説明を付けてコミットする。

## 3. 統合

- [x] 3.1 全要件のテスト対応、lint・型・配布物と既存verifyの回帰を確認し、作業記録を更新する。全タスクをチェックして `pnpm -s verify --change move-verification-policy-to-kit --done` がexit 0となることを確認してコミットする。 <!-- loomake:gate=done -->

## Workflow follow-up

- PRはIssue #63をRefsで参照し、W1-4全体やC-001全体を閉じない。レビューとCIを経て取り込んだあとにarchiveする。
