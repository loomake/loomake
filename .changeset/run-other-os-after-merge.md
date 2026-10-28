---
---

PR の CI では quality ジョブを ubuntu だけで実行し、macOS と Windows では main への push と毎日 1 回の定期実行で実行する。PR に `ci:all-os` ラベルを付けると、その PR でも 3 つの OS で実行する。配布するパッケージは変えない。
