---
"@loomake/kit": patch
"@loomake/runner": patch
"loomake": patch
---

エンジンの長い期限をタイマーの上限以下に分けて監視し、Git・gh の利用者による中断を interrupted と記録する。監視役の異常終了後は共有予算に理由を保持し、後続操作の拒否でも stopped として区別する。
