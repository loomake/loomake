# Proposal

## Why

FR-01 と W1-7 は Issue を入力に含むが、配布 Skill は Markdown ファイルだけを案内している。指定 Issue の本文・コメントを出典つきの change にする入口を追加する。

## What Changes

- 本文と全コメントの取得範囲、取得不能・不完全時の停止を定める。
- Issue の出典と取得時点を既存の台帳・入力文書へ残す。
- 外部の文章を要求のデータとして扱い、作業者への命令と区別する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `req-to-openspec-skill`：REQ-402〜404 を ADDED とする。Markdown 形式・既存の採番・曖昧さ分類は保持する。

## Impact

配布版とリポジトリ版の Skill・trace 雛形、kit-assets と verify の試験、利用者向け案内を追随させる。公開 API・parser・schema・依存は変えない。
品質の質問・quality.yaml 反映は後続。実装は #74 の後に進め、本子だけで #66 や親 C001 を完了にしない。
