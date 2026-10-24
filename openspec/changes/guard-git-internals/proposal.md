# エンジンによる git のフックと設定の書き換えを止める

## Why

不正な直し方の検出は `git diff` だけを見る。`.git/hooks/` と `.git/config` は差分に出ないので、エンジンがフックや `filter` の設定を書き換えると、run 自身の `git add`・`git commit` でそのコマンドが動く。権限の確認を経ないコードの実行になる。

秘密情報の置換は 4 種類の形だけで、npm・Slack・GitLab・Google のトークン、JWT、秘密鍵、Bearer トークンは記録に残る。

## What Changes

- エンジンを呼ぶ前後で、git の設定ファイルとフックのディレクトリ（`core.hooksPath` を反映した場所）の中身を比べ、変わっていたらコミットせずに止まる
- 置換する秘密情報の形を足す

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run-guards`: git の設定とフックの変更の検出。
- `run`: 置換する秘密情報の形。

## Impact

runner のエンジンの呼び出し、ガード、秘密情報の置換とテストを変える。利用者が run の前から置いているフックは、これまでどおり動く。
