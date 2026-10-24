---
"@loomake/kit": minor
"@loomake/runner": patch
"loomake": minor
---

`--skip-commands` で品質コマンドを省いたとき、結果に `skip` の「品質コマンド」の項目を加え、表示の最後の行にも書く。外部操作の時間・出力の上限や中断による停止を `RuntimeFailure` にし、CLI は終了コード 3 を返す（以前は 2）。run は壊れた `loomake.config.json` を設定エラーにする。値をとるオプションで `--name=value` の形を受け付け、知らないサブコマンドとオプションには近い候補を示す。
