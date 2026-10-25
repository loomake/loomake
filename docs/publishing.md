# 公開経路と公開元の確認

この文書は、現在のrelease.ymlが実行する手順と、保守担当者が公開後に確認する内容を示す。実際のnpm公開やattestationの検証は、今回のローカル試験では実行していない。

## 公開前の条件

changesetで対象パッケージの版を更新し、その変更をmainへ入れる。未消化のchangesetが残ると公開ワークフローは止まる。版を上げるPRはchangesetを消化するので`changeset status`は失敗するが、変えたファイルがpackage.jsonの版・CHANGELOG.md・消化したchangesetだけなら、公開準備の検査（REQ-056）は合格する。公開するコミットの版・配布内容・CI結果を確認してから、mainを対象にreleaseを手動実行する。

同じチェックアウトで、lockfileを固定した導入、lint・型検査・テスト・ビルド、tarballの作成と独立したプロジェクトからの検査を行う。検査が失敗した場合は公開しない。配布物の検査は出典とprovenanceの設定、exports、スキーマ、binと主要コマンドを含む。

## 権限と認証

ワークフローの既定権限はcontents readとする。公開ジョブだけがタグ送信のcontents writeとprovenanceのid-token writeを持つ。これらはジョブ全体の権限であり、ステップ単位でGitHubの権限が切り替わるという意味ではない。

checkoutは資格情報を保存しない。npm公開の認証情報は`pnpm changeset publish`のステップだけへ渡す。タグ送信のGH_TOKENは、公開が成功した後の`gh auth setup-git`と`git push --follow-tags`のステップだけへ渡す。

現在のワークフローは、公開ステップの`NODE_AUTH_TOKEN`へGitHubのsecret `NPM_TOKEN`を渡す。secretが未設定なら値は空になり、npmのTrusted Publishing（OIDC）を使う想定である。ワークフローの設定だけでは、Trusted Publisherの登録や、`pnpm changeset publish`を経由したOIDC認証の成功は確認できない。初回のトークン利用と移行手順は[release.md](release.md)にまとめる。実際のOIDC公開とprovenanceの発行・検証は未確認である。

## provenance

5パッケージに、`git+https://github.com/loomake/loomake.git`と各packagesディレクトリをrepositoryとして設定し、publishConfig.provenanceをtrueにする。公開ステップもNPM_CONFIG_PROVENANCEをtrueにする。npmの公式文書では、対応するクラウドCI、OIDC権限、公開元と一致する公開repositoryの設定などが必要である。provenanceはコードに悪意がないことを保証するものではない。[npmのprovenance文書](https://docs.npmjs.com/generating-provenance-statements/)

リポジトリの可視性や認証などの前提が整っていない場合は、公開の失敗理由を確認する。成功させるためにprovenanceの要求や品質検査を外す手順にはしない。

公開後は、npmにある各パッケージの版・repository・配布物と、provenanceの公開元・対象コミット・ワークフローを確認する。独立した確認用プロジェクトに公開版を導入し、`npm audit signatures`の結果も記録する。ローカルで作ったtarballの試験と、registryから取得した公開版の検証は区別する。

公開が途中で失敗した場合は、どのパッケージの版が公開済みか、対応するタグがあるかを調べる。既に公開した版を別の内容で置き換えようとせず、失敗原因と残る公開対象を確認してから同じコミットの公開を再試行する。

## Actionsと依存の更新

外部Actionsは完全なコミットSHAに固定する。`github/codeql-action/init`のようにサブパスを持つ参照も同じで、記録とはリポジトリとSHAで照合する。今回確認した参照元は[.github/action-pins.json](../.github/action-pins.json)に記録した。固定は更新を不要にする仕組みではない。

更新時は公式リポジトリの参照先と完全なSHA、変更内容とセキュリティ上の修正、Nodeやrunnerの要件を確認する。ワークフローと参照元の記録を同時に変更し、品質と対象OS・Nodeの配布物検査を通す。既定権限、checkoutの資格情報、公開とタグ送信の認証範囲もレビューする。

npm依存の更新では、lockfileと直接・推移的依存の変更を確認し、公式の変更履歴・アドバイザリと`pnpm audit`の結果を読む。指摘を解消するか、到達可能性・影響・回避策と受容する理由を記録する。監査コマンドの成功だけで安全性を保証しない。更新のPRを自動マージする方針は、この文書では設定しない。

脆弱性の報告は[SECURITY.md](../SECURITY.md)、貢献の手順は[CONTRIBUTING.md](../CONTRIBUTING.md)を参照する。
