## Why

doctorはパッケージマネージャーがあるだけで品質コマンドを合格にし、対象のscriptがなくても見逃す。検査できた範囲と、実行していない内容が区別できる診断へ改める。

## What Changes

- **BREAKING** 単純なnpm・pnpmのscript呼び出しを静的に調べ、欠落・空のscriptや不正なpackage.jsonを問題にする。
- 未対応のシェル構文やYarnの解決先は推測せず、検査できた範囲と次の確認方法を示す。
- 実行権限とファイル・ディレクトリの種類を確認し、Git診断には共有期限を適用する。
- ファイルや設定を変えず、品質コマンド・認証確認・ネットワーク接続を実行しない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `doctor`: 既存の導入診断を保ち、静的なscript検査・診断範囲と資源の境界を補足する。

## Impact

kitのdoctor、CLIの診断試験、導入と診断の文書。依存の追加なし。DoctorCheckの形と問題1・問題なし0の終了コードを維持する。
