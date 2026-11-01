# Design

## Context

動機は proposal.md の Why を参照する。`findProducer` は `quality-receipt.ts` 内の内部 API で、直接の caller は `runVerify` だけ。現在はファイルシステムの最上位まで探索する。`runVerify` は検証ルートを実パスへ直してから receipt を組み立てる。

採用済み Opus 設計に従う。既存の Q-03 はルートから上へ探索する方針を決めたが上限を定めていない。REQ-319 は進行中の `verify-v2-quality` の ADDED にあり、主仕様には未同期のため、その本文・2 Scenario・Source を変えず、REQ-359 を `verify` へ追加する。

## Goals / Non-Goals

**Goals:**

- 検証ルートを含む現在の Git 作業ツリーを探索位置の境界にする。
- Git で境界を確かめられない場合は検証ルートだけを調べ、偶然の上位依存から producer を補わない。
- root から親への探索順、同じディレクトリ内の vitest → jest の優先順、reader と receipt 型、正常・不足・不正の分類を保つ。

**Non-Goals:**

- ランナー実体の hash・method の全面照合、公開 API・JSON 形式・設定キー・依存の追加。
- 既存の正常例、assert、timeout、skip、品質設定の変更。親 C001 の受入と S1 の代替。

## Decisions

### 1. 現在の作業ツリーを Git に問い合わせる

既存の `runExternal` で `git rev-parse --show-toplevel` を検証ルートから実行する。`--git-common-dir` や主 checkout、superproject へ探索を広げず、`.git` の独自探索もしない。monorepo の子プロジェクトは現在の作業ツリー内の上位依存を使え、nested repo・submodule・linked worktree はそれぞれの境界で止まる。

品質コマンドの実行と receipt の組み立て順は変えない。追加の Git 操作も既存の期限・中断・出力上限を使い、raw spawn や別の予算を作らない。

### 2. 境界が不明なら検証ルートだけを使う

Git 不在、非 Git、通常失敗、空・相対パスの出力、実パス解決失敗、ルートを含まない出力では上限を検証ルートにする。親まで探索を続ける案は採用しない。検証ルート自身の runner を調べることは維持し、producer なしに固定する案も採用しない。非 Git の target 不明の扱いを含む既存の品質判定は保持する。

### 3. 探索位置とリンク先実体を分ける

ルートと Git 最上位の比較には `realpathSync.native` と `path.relative` を使い、同一パスまたは内包と確かめられた最上位だけを採用する。Windows の大小文字・短縮名は native の実パスを基準に扱い、絶対パスの相対結果や `..` への脱出は受け入れない。

ループは root から親へ上り、Git 最上位を含めて止める。ファイルシステム最上位で止める既存の安全側の条件も残す。`node_modules/<runner>` の symlink/junction 自体は拒否しない。pnpm の store と既存の実 Vitest fixture が外部実体を指すためである。最後の package.json の reader 制約は変えない。

### 4. 観測と試験

修理前の不具合は未再現で、設計時点では source inspection による推論である。実装では次の独立 fixture を先に追加し、修理前に失敗する負例と、既存の成功条件を分けて記録する。

| 対象 | 試験と期待 |
|---|---|
| repo 外、nested repo、linked worktree | 外側に負例専用 sentinel の package.json だけを置き、内側の producer に採用しない |
| 子プロジェクトと優先順 | 同じ作業ツリー内の実 Vitest を利用し、root 優先と vitest → jest の順を保つ |
| Git 不明・失敗・不正・不一致 | root 内だけを調べ、上位の sentinel を使わない |
| root のリンクと runner のリンク | 探索位置を実パスで比べ、範囲内の junction から実 Vitest を使える |
| CLI/API | 外側 sentinel が存在しても root 内の Vitest を外したら両入口が不足/1。既存の正常 PASS・古い結果拒否・不正 aborted を保持 |

負例専用 sentinel を成功例の適格な実証跡には使わない。`ProjectFiles` への任意の `base` 追加は既定の `tmpdir()` と既存呼び出しを変えずに独立した外側ディレクトリを使うために限る。新試験名には `[REQ-359]` を付け、REQ-319 の既存受入も同時に確かめる場合は両 ID を並べる。

## Risks / Trade-offs

- 自分の node_modules を持たない linked worktree は、主 checkout の依存から producer を推測できなくなる。ローカルの既定完了ゲートは scope local を維持し、ci scope の検証はその作業ツリーに依存を置いて行う。
- Windows の Git 出力と 8.3 短縮名は設計時点では未観測。3 OS の正負 fixture で確認し、不一致なら上位へ探索を広げず root だけに止める。
- Git を 1 回多く呼ぶ。既存の監視役と期限を使い、新しい性能閾値や予算の変更を導入しない。

## Migration Plan

新規設定やデータ移行はない。kit の patch changeset と通常の L3 PR で配布する。実装・検証・独立最終レビュー・CI がそろうまで本 change の完了や Issue #238 の close を宣言しない。実装が受け入れられたあとは、この change 経由で仕様を同期し archive する。
