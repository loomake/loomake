---
"@loomake/runner": minor
"loomake": patch
---

`loomake run` は、エンジンを呼ぶ前後で git の設定ファイルとフックのディレクトリを比べ、エンジンが書き換えていたら git add・git commit をせずに止まる。記録の前に置き換える秘密情報に、npm・Slack・GitLab・Google のトークン、JWT、秘密鍵のブロック、Bearer のトークンを足す。
