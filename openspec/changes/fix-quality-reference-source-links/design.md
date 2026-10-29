# Design

## Context

動機と変更範囲はproposalを参照する。対象はPR149のhead `64e5c459961d39313959231023d7997b9de3b141`。rendererと生成済みページの2つの相対hrefは、GitHubではソースURLへ、サイトでは同じサイトの `/packages/` へ解決される。観測したのはURL解決とローカルファイルの存在であり、HTTP到達や公開の確認ではない。

T-URL-01は未回答で、回答・回答者・回答日は空である。以下は承認待ちの案であり、人がAを承認した場合に限って使う。A/Bの採否は決めない。Aの承認記録、別のapply指示、仕様ゲートexit 0がそろうまで、renderer・生成ページ・試験は編集しない。Bまたは空欄なら実装しない。

## Goals / Non-Goals

**Goals:** 同じ2ソースをGitHubとサイトから参照できるようにし、2つのラベルとhref、実ファイル、描画後のHTMLを照合する。

**Non-Goals:** URL設定、依存、ソースのコピー、siteのルートや設定を追加しない。表、title/description、再生成方法、他の文書リンク、公開API/JSON、品質設定、CLI生成器、C-001は変更しない。#103の完了や、siteの担当変更・push・公開を含めない。

## Decisions

### 2つのhrefリテラルだけを置き換える

承認後、`scripts/quality-reference.mjs` の既存文字列内にある2つのhrefだけを次のURLへ変える。リンクラベル、前後の日本語、隣の空文字列は保持し、定数・option・環境変数を増やさない。

- `https://github.com/loomake/loomake/blob/main/packages/core/schema/quality.schema.json`
- `https://github.com/loomake/loomake/blob/main/packages/core/src/quality-schema.ts`

生成ページは既存コマンドで再生成し、差分が生成元リンクの1行だけであることを確認する。手でページを直して生成一致の検査を避けない。siteにソースを複製したりルートを足したりする方法は、別の同期と設定が必要になるため採らない。

### 承認対象の1 assertionと追加試験

置換する既存assertionはproposalのコード例に示した1つだけとし、他の既存assertionを保持する。追加するREQ-322試験は、既存計画どおりrenderer出力と保存済みページの両方を対象とする。

| 検査 | 確認すること | 修正前の期待 |
|---|---|---|
| 2リンクの完全一致 | quality.schema.jsonとquality-schema.tsのラベル/hrefを抽出し、対象が合計2つ、各組が1回で、上記URLと一致する | href不一致で失敗 |
| 旧相対hrefの排除 | 出力に `../../../packages/` を残さない | 失敗 |
| GitHubを基準にした解決 | 文書URLをbaseにしても同じ上記URLになる | 既存の成功を保持 |
| サイトを基準にした解決 | 末尾slashあり/なしの両baseで同じ上記URLになる | サイト内パスへ解決されて失敗 |
| ソースの実在 | `/blob/main/` 以下の既知のパスをリポジトリ内の2パスへ対応付け、`isFile()`で通常ファイルと確かめる | 既存の成功を保持 |

GitHubのbaseは `https://github.com/loomake/loomake/blob/main/docs/guide/3.reference/4.quality-yaml.md` とする。サイト側はネットワークへ接続せず、例えば `https://site.example.invalid/guide/reference/quality-yaml` と `https://site.example.invalid/guide/reference/quality-yaml/` を使う。存在するだけの確認へ弱めず、2つの通常ファイルと正確なhrefを確かめる。

承認後、対象64e5c45の未修正rendererで新しい宛先・旧相対href・サイトbaseの試験が失敗することを先に確認する。GitHubの解決とソースの実在は、修正前から成功する保持用の検査として区別する。

### 保持する内容と差分

生成ページの1行以外、title/description、表、再生成方法、他のリンクをbyte一致で保持する。生成物checkが成功し、2回目の再生成で差分が出ないことを確認する。REQ-320/321、REQ-322の全文と既存3 Scenario、既存の1 assertion以外の試験、package.json/lockfile、公開JSON/exports、品質設定、CLI生成器、C-001に差分を入れない。差分仕様は既存の1 Scenario追加案を保持する。

### 固定SHAで描画後のhrefを確認する

管理役が扱う既存siteのコミットと、修正後のdocsコミットを固定し、公開しないローカルbuildでqualityページの2つのsource anchorのhrefを抽出する。両方が上記URLと一致することを確認し、site/docs SHAと抽出結果を記録する。

buildできなければ理由と未実施を記録し、URL解決の単体試験で代用しない。その場合は統合確認を完了扱いにしない。siteへのpush・PR・設定変更・デプロイを行わず、公開サイトのHTTP到達も別の未確認事項として残す。

## Risks / Trade-offs

- mainへのリンクは現行ソースを指す。2つのパスの通常ファイルと完全なURLを試験し、ソース移動を検出する。
- 既存1 assertionの変更にはT-URL-01の人の承認が必要である。Aの承認・別apply指示・仕様ゲート成功がそろう前に実装しない。
- 単体試験、固定SHAのHTML照合、公開サイトのHTTP到達は証拠の範囲が違う。実施済みと未実施を分けて記録する。

## Migration Plan

T-URL-01のA承認を記録し、仕様ゲート成功と別のapply指示を確認してから、1 assertionの置換と追加回帰試験、rendererの2 href修正、既存コマンドでの再生成を行う。失敗時と修正後の試験結果、check出力、差分、site/docs SHAとHTMLのhrefを引き継ぐ。#103はこの修理だけでcloseせず、公開や品質設定の緩和を行わない。

## 設計の出典と実行記録

2026-10-29、実行ツールClaude Codeの新しいsessionで英語の設計を生成し、この文書へ反映した。対象は64e5c45、actual modelUsageは `claude-opus-5-5` のみ、sessionは `4190d7a2-20b1-42f3-8320-c16eded842bd`、exit 0、is_error=false、permission_denials=[]だった。toolsなし・strict empty MCP・safe-mode・plan・session保存なしで実行し、permission bypassとfallback指定は使っていない。

ローカルの原文とmetadataは `node_modules/.cache/quality-reference-source-links/opus-design/` に保持する。この1回は新規設計の生成であり、既存案の評価・設計レビュー・最終レビューではない。既存計画のrenderer/保存ページ双方の検査と通常ファイルの `isFile()` 確認を維持して反映した。AI評価は0回。後日の最終レビューは別の新しいOpus sessionで行い、自動botの予定分として1枠を確保する。両レビューとも今は未実施で、設計生成をレビュー回数へ数えない。
