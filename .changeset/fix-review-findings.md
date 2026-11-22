---
"@loomake/kit": patch
"@loomake/runner": patch
"loomake": patch
---

verify の品質コマンドの出力を maskSecrets で伏せ、予算がなくても監視役経由で実行して出力の上限と子プロセスグループの掃除を効かせる。runner では、ステージする差分に秘密情報らしいファイル名や既知形式のトークンがあれば止め、Windows のコマンド引用を CommandLineToArgvW の規則に直して %VAR% 展開を止める。minimatch を overrides で >=11.0.1 に固定する。
