# Trace: close-engine-and-hook-safety-gaps

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-212 | 本会話のセキュリティ再レビュー後の仕様先行と修正の承認、../archive/2026-10-24-audit-scenario-evidence/security-followup-proposal.mdの確認した事実1・推奨する変更範囲 | 非機能 | 正常終了したPOSIXエンジンと同じプロセスグループの子を停止し、後処理を待ってから戻る | 反映済 | specs/run/spec.md |
| REQ-224 | 同承認、../archive/2026-10-24-audit-scenario-evidence/security-followup-proposal.mdの確認した事実2・推奨する変更範囲 | 非機能 | フック内の特殊ファイルを開く前に拒否し、日本語で対象と理由を示してコミット前に止める | 反映済 | specs/run-guards/spec.md |
| REQ-225 | 同承認、../archive/2026-10-24-audit-scenario-evidence/security-followup-proposal.mdの確認した事実3・推奨する変更範囲、REQ-204のリンク契約 | 制約 | リンク先をたどらない比較を保ち、リンク先のコードとプロセス停止の保護範囲を文書に明記する | 反映済 | specs/run-guards/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
| A-01 | REQ-212 | SIGKILLのあとに同じプロセスグループの終了を待つ上限は1000msとする | 実装の既定値（`GROUP_EXIT_TIMEOUT_MS`）から採った。カーネル内で待ち続ける子でrun全体を止めないための上限で、利用者が2026-10-25に承認した | 承認済（2026-10-25） |

## 決定と範囲

新しいREQUIREMENTのIDは、作成時点の要件台帳の最大REQ-206に続くREQ-207〜REQ-209を使った。その後、先にmainへ入ったlayer-kit-modulesがkitの依存方向にREQ-207を使っていたため、2026-10-25にこのchangeのREQ-207を未使用のREQ-212へ振り直した。さらに、先にmainへ入ったstop-engine-on-terminationがREQ-208を、bound-report-evidence-readingがREQ-209を使っていたため、2026-10-26にこのchangeのREQ-208を未使用のREQ-224へ、REQ-209をREQ-225へ振り直した。REQ-214〜REQ-223は、別のブランチのrecord-stack-and-versioning-decisionsが使っているので避けた。tests/kit-layers.test.tsのREQ-207はkit側の要件で、変えていない。既存の別changeで重複しているREQ-204は今回付け替えない。フックのリンク契約はfix-guard-review-findingsのREQ-204を指し、run-decision-policyの判断分離を指すものではない。

POSIXでは同じプロセスグループを停止する。別のセッションへ離脱した子の追跡と、Windowsでの通常終了後の子の停止の保証は今回追加しない。Windowsの明示停止時の既存taskkillは維持する。親の終了時点から後処理を始め、既存の結果と中断・時間切れ・出力上限を保つ方針はdesign.mdに記載した。

hooks内のリンクはREQ-204どおりリンク文字列だけを比べる。リンク先の実行ファイルを変えると、文字列が同じままフックの実行内容を変えられる再現は、現行REQ-204の実装違反ではない。リンク先と呼び出すコードも保護すると約束する変更は含めない。

## 再現結果の出典

承認前にLinux ARM64の一時リポジトリで実行した結果は、`/tmp/quality-security-runtime-results.json`と`/tmp/security-runtime-repros.mjs`にある。通常フックの対照は終了したが、FIFOでは外側の試験が1500msで強制停止した。エンジンが終了コード0で戻った後も同じグループの子が動き、遅延書き込みが起きた。この結果は修正前の再現であり、修正後の成功や実Claude・GitHub・別OSの成功の根拠にはしない。取り込む回帰と修正後の結果はこのchangeに別途記録する。
