# Design: classify-unchanged-archive-metadata

状態：具体案は2026-11-01に利用者が明示承認。承認された設計を仕様ゲート後に実装し、通常L3の受入とmain採用前は他PRへ適用しない。

## Context

動機と品質コマンドの省略範囲は `proposal.md` を参照する。基準は main `3a54614e`。REQ-270 の文書許可リストには YAML がなく、REQ-342 の archive 例外は全パスが L1 のときだけ成立する。現実装はこの規範に一致し、コードだけの不具合修理として例外を加えることはできない。

`scripts/ci-docs-only.mjs` は `decideTier` の前に文書外パスを拒否するため、段階判定だけの変更では quality と gate が食い違う。REQ-270 の「文書だけの PR の品質ジョブ」は段階 L1 に従い、REQ-343 も段階から動作を決める。文書の定義は保持し、PR の文脈でだけ REQ-362 の限定例外を共有する。

出典は Opus 改訂設計（専用 tree の `.loomake/claude/5ecd33d1-be58-4a57-8ebc-4da703bcc384/result.md`）。REQ-362 は [中央予約](https://github.com/loomake/loomake/issues/121#issuecomment-6551110472)済み。予約は規則の承認ではない。

## Goals / Non-Goals

**Goals:**

- 移動元・移動先・raw diff の状態とモード・完全 blob ID・同行する文書を合わせ、例外の成立を同じ関数で判定する。
- quality の差分失敗、main 以外の base、main push、全パスへのモード検査・ツリー検査・大文字小文字衝突検査を保つ。
- 既存の期待値を維持し、REQ-362 と REQ-342 の追加試験で正例と例外外を確かめる。

**Non-Goals:**

- YAML の一般許可、内容が変わった metadata の許可、元の change の DoD の代用。
- CI 設定や archive スキルの命名規則、ADR 0006、delivery 規則、REQ-270・281・282・343・132・049/273・214 の変更。
- 新規則の採用前に #238 の archive 案へ適用すること。

## Decisions

以下はQ1で承認された具体案の構成である。Q2〜Q6の回答と出典はtrace.mdに記録する。

### Q2：完全な blob ID を照合する案

R100 だけには依存せず、候補の移動について merge-base の旧パスと HEAD の新パスを `git rev-parse` で解決し、完全な ID が一致したときだけ採用する。失敗、空、2 行以外、不正な OID、不一致は偽とする。raw diff の短縮 OID は比較に使わない。候補がないときは照合を呼ばず、既存試験の git 呼び出し数を変えない。

`ci-tier.mjs` は純粋な判定関数 `archiveMetadataPaths(entries, sameBlob)` を置き、成立した前後パスの集合を返す案とする。`sameBlob` の既定値は偽。既存の `classifyPath` と `isDocumentPath` は単独では `.openspec.yaml` を L1・文書にしない。安全なパスの検査を共有しても、既存文書の判定は変えない。

### Q3：同じ archive へ文書を足すか移すことを要求する案

別の entry が A または R で、変更後が文書の許可リストに当たり、同じ `openspec/changes/archive/<名前>/` の下にあることを求める。metadata だけの移動で主仕様の Requirement 変更を L1 にする経路を防ぐ。ほかの全パスは従来の分類を使い、既存の archive 例外そのものは広げない。

quality はこの集合だけを文書外パスの事前拒否から除き、モード・パス・ツリーの全検査を維持する。遅延 merge-base と OID 照合の共通処理を gate も利用する。gate は同じ集合を段階判定と change 選択に用い、明示した存在しない change の拒否や L3 の none 拒否は維持する。

### Q4：AGENTS の対象行に最小限の追記をする案

`proposed/AGENTS.md.patch` は L1 の対象セルだけへの追記で、未適用。限定条件は REQ-362 を参照し、一般の YAML や metadata の内容変更は対象にしない。Q1 で規則変更を承認されたあとに通常の実装差分へ含める。

### Q5：既存の日付命名規則と一致させる案

archive スキルは `YYYY-MM-DD-` で始まる id に日付を重ねない。インストール済み CLI の `dist/core/archive.js` 28 行・1331〜1333 行も `/^\d{4}-\d{2}-\d{2}-/` で同じ判定をする。既存の日付付き id は同名、ほかは実在する日付と `-<id>` の対応だけを認める。JST の作業日で付けた archive 名を使い、分類器は時計の現在日とは比較しない。CLI 自体はローカル日付を使うので、archive 作業では JST を確認する。

`2026-1-01-c1` は prefix に当たらず、`2026-11-01-2026-1-01-c1` を受け入れる案である。`0050-01-01-c1` は実在する日付として扱う案とし、JavaScript の `Date.UTC` が 0〜99 年を 1900 年代へ読み替える性質に依存しない。civil-date の検査か `setUTCFullYear` を使い、正常日と閏年・不正日を追加試験で確かめる。これらは例外の対応だけを決め、archive の命名処理は変更しない。

### Q6：予約済み ID の所有

ADDED の Source は REQ-362 だけとし、REQ-342 を重ねない。MODIFIED は REQ-342 の原文を全体複写し、L1 の 1 行だけ変更する。13 Scenario を保持し、重複許可一覧は変更しない。

## Risks / Trade-offs

- [品質の省略範囲が広がる] → Q1の明示承認を取得済み。省略範囲とgateの残る検査を保持し、通常L3の受入とmain採用まで適用しない。#260 の承認は流用しない。
- [gate と quality の判定がずれる] → 同じ集合と OID 読み取りを共有し、純粋判定・偽 git・実 git・gate 子プロセスの 4 層で追加試験する。
- [OID が読めない、モードやパスが不安全] → 例外不成立とし、既存の安全側の段階と全パス検査へ戻す。
- [archive の同期元が未完了] → 元の change の DoD と独立レビューを確認してから archive する。分類器の成功を実装完了とみなさない。

## Migration Plan

1. 全 artifact と未適用 AGENTS パッチを人がレビューし、Q1 への回答を出典・承認者・JST 日付つきで記録する。選択が変われば差分仕様と設計を再作成する。
2. 仕様ゲートの成功後に、通常 L3 の実装作業を新たに開始する。新規追加試験で現 main の RED を観測し、共有判定と呼び出し側を実装して GREEN を確かめる。
3. REQ-362・342 の対応試験、既存回帰、完了ゲート、3 OS 品質、必須 5 チェック、独立 Opus レビューを通す。AGENTS の承認済み追記も含めて main に採用する。
4. main 採用後から #238 の archive 案を取り込み直し、主仕様の原文反映と6ファイル移動を保って CI の L1 を確かめる。

ロールバックは通常の変更 PR で例外を戻す。採用前の archive を下げる本文指定や metadata 削除で迂回しない。

## Observed evidence

- archive 案 `da72cf88` の metadata は基準 main と同じ完全 blob ID `25002a8e8151998b10d369d4a0ccd578f8ba97f9`。raw diff は前後 100644、R100 である。OID の一致は今回の読取確認であり、規則の承認ではない。
- `tests/ci-gate-process.test.ts` の `withProject` は `dir` と `git` を渡す。追加 case 内で metadata をベースへコミットし、origin/main を更新してから移動できる。既存 case の期待値は変えない。
- `docs/dev/ci.md` は docs_only と段階 L1 の共通判定を説明している。採用後に限定例外と REQ-362 の参照を補う文書更新を候補にするが、現時点では変更しない。

## Open Questions

承認と構成要素の回答は `trace.md` のQ1〜Q6に記録した。実装中に本文を変える曖昧さが見つかったら、仕様ゲートを止めて確認事項を追加する。

## 実装taskと外部受入の分離

5.2はレビュー/CI用証跡と4項目worklogの準備とし、CI完了・独立レビュー・main採用はWorkflow follow-upで必須条件のまま保持する。管理役が2026-11-01本セッションでこの循環修理を承認した。ゲート前に未実施の外部受入を完了扱いにしない。
