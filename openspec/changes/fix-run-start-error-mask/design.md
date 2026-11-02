# Design

## Context

run.tsのstdout/progress保護は例外を包まない。GitErrorは外部stderrを含み、ロック取得とprepareのcatchからUsageErrorとしてCLIへ届く。

## Goals / Non-Goals

既存の表示保護を2経路へ適用する。collector、trace原文、設定エラー、RuntimeFailure、CLI、公開APIは変更しない。

## Decisions

Opus設計5164ff47と補足6a25d16fをrootが採用したB案：GitErrorをUsageErrorへ変換する2か所で既存maskSecretsを使う。CLIで全run例外を包む案より、今回の発生元だけを直しrunnerの責務を保てる。認識規則を増やさない。

追加試験1ファイルでkitのrunExternal境界だけを差し替え、条件外は本物へ渡す。CLI mainの同じ入口で経路2種×診断2種を確認する。既定timeoutを使い、設定を追加しない。

| 経路 | 合成秘密の負例と通常診断の対照で保持する条件 |
|---|---|
| lockのrev-parse失敗 | 対象応答1回、exit 2、usage、記録なし、Repo.calls()=[]、lock/recoveryなし |
| lock成功後prepareのstatus失敗 | 上記と、先行するlock取得のGit成功、finallyで解放 |

Repo.calls()は実装本体のclaude未実行を示し、--version準備probeは記録しない。差し替えた診断の観測を実Gitの秘密出力とは報告しない。通常文とBearerの語は保持し、合成トークンだけ既存規則で置換する。

## Risks / Trade-offs

別の例外発生元には広げない。REQ-192の実期限、REQ-118/153/199、既存CLIのexit/usage試験を無変更で回帰する。新L3 PRは本数条件で保留し、root許可のローカル準備と区別する。
