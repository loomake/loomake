# docs/fix-guide-section-links

1. #100の先行修理として、2ガイドの4種類・5参照を明示アンカーへ向けた。#102で受入済みの文書内到達性を復元し、見出し・説明と製品動作は保持した。REQ-132に従う文書のみPRで、新change・REQ・試験は追加しない。
2. 既存doc-linksは41試験成功（Node24・pnpm12。専有領域への自動導入でロックのENOSPC警告あり）。固定版Nuxt Content parserで全6参照が解決し、未解決5→0、見出し29個の本文とID保持を確認した。diff check・日本語の推敲も実施。通常verify・全体試験・今回のsite fullbuildは未実施で、native CIへ残す。
3. この修理に未回答事項はない。#100全体とsiteの#103は未完。site担当の確認と公開承認は、それぞれの作業で扱う。
4. Draft PRを用意し、管理役へhead・検証結果を渡す。独立レビューと対象headの必須CI確認、マージは管理役へ引き継ぐ。

前作業の引継ぎ：[PR144](https://github.com/loomake/loomake/pull/144)はfinal `6b8a390`・CI40819669470のdone/必須CI/CodeQL成功（1,380試験・既存skip8）・全6task、M144-01のマージ承認待ちでarchive未実行。[Issue103](https://github.com/loomake/loomake/issues/103)は固定13ページのbuild成功を記録済みだが、リンクと旧ブランドの未達が残り受入前。
