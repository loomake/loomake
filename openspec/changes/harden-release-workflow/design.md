# Design

## Context

CIはcontents readを既定とするが、公開ワークフローは全体がcontents writeである。Actionsはv4タグを参照する。公開する5パッケージにrepository情報がない。公開はmainからの手動実行で、同じコミットの品質と配布物を検査した後にchangeset publishとタグ送信を行う。

## Goals / Non-Goals

可変のActions参照と資格情報の不要な残存を避け、公開元検証を要求する。実際のnpm公開、GitHub設定の変更、Trusted Publisher登録は行わない。品質ゲートを省略したり、認証方式を自動で変更したりしない。

## Decisions

- GitHubコネクタで公式リポジトリのv4参照を取得し、完全なSHAとURLをaction-pins.jsonへ保存する。固定によって更新が不要になるわけではなく、依存更新の手順を文書化する。
- すべてのcheckoutにpersist-credentials falseを指定する。releaseの既定はreadにし、公開ジョブだけにcontents writeとid-token writeを付ける。ジョブ単位の権限はそのジョブ全体に及ぶが、npmとGit送信の資格情報は対応するステップだけへ渡す。
- タグ送信ステップでだけGH_TOKENを渡し、gh auth setup-gitを設定してから既存のgit push --follow-tagsを行う。品質コマンドやpublishへGitの資格情報を保存しない。
- パッケージにrepositoryのtype・url・directoryとpublishConfig.provenance trueを追加する。公開ステップにもNPM_CONFIG_PROVENANCE trueを渡し、token認証を維持する。配布物の検査でメタデータを確認する。
- 貢献・セキュリティ報告・サポート・互換性・脅威モデル・公開の文書を、既存実装と照合して整える。連絡先やSLA、未確認の保護や公開結果を作らない。文書の存在をなぞる単体テストは追加しない。

## Risks / Trade-offs

公開ジョブのOIDCとタグ書き込みの権限は、ジョブ全体の権限である。公開物の真正性は実際の公開後にregistryのattestationで確認する必要がある。provenanceはコードの安全性を保証しない。公開元のリポジトリが非公開など、npmの前提を満たさない場合は公開が失敗し、設定を外して回避せず原因を確認する。
