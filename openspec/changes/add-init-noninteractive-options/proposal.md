# add-init-noninteractive-options

## Why

#357 の reweave 通し確認で、端末のない AI シェルから既存ファイルのある導入先へ init できないことが分かった。上書きするか残すかを明示できるようにする。出典は [Issue #407](https://github.com/loomake/loomake/issues/407)。

## What Changes

- `init --yes` で配置対象をすべて上書きし、`--keep-existing` で既存の配置対象を残す。どちらも確認を省き、不足ファイルを置く。
- 無指定・非 TTY で差分があるときは、無配置・終了コード 1 を保ち、両オプションを案内する。
- ヘルプ・生成リファレンス・導入案内を追従し、同期と archive を同じ PR に含める。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `init`: 明示オプションによる既存ファイルの扱いと、非 TTY の案内を定める。

## Non-goals

#408 の品質条件・タスク手順、prompt の EOF 処理全般、短い別名、品質設定・規則・CI の変更、採点・監査、公開とリリースは対象外。

## Impact

`packages/kit/src/init/init.ts` の公開オプションと `packages/cli/src` の引数・ヘルプ、対応テスト、導入ガイド、CLI リファレンスに影響する。依存は追加しない。
