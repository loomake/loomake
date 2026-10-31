# E3 S4のguard群化（Issue #246）

1. やったこと：既存Opus設計の適合を確認して再利用し、S2-Q01/02を記録してS4を先行した。task2.5のguard群化とliteral子環境補正を局所hunkだけ移し、現在のGit読み取り集約・C001と既存assertを保持した。
2. verifyの結果：新batch60件を含むrunner回帰485件が成功し、失敗0・skip0。1200fileの13群・26diff/全28呼出・argv上限8192+152・60秒、既存Git読取とlocal/CI、期限と変異検出を保持し、build・型・lint・strict・spec-onlyも成功した。Linuxの結果で3OSを代用しない。
3. 確認事項・仮定：task2.5のみ完了で5済14未。task3.5はmacOS/Windowsとpush期限順の受入まで未完了で、S1のgate/merge・親done・実4件0/4・P6未成立も残る。規則や品質設定、1200fileと全assertを緩めていない。
4. 次にやること：管理役が独立レビューとCI・runner3OSを確認する。Windowsではdiff転送成功がpush停止より前にあることを実ログで確認し、3.5をその前に完了にしない。S2全6taskと71件候補を後段へ保持する。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| 未作成（Refs #246） | 対象外（適合を確認した既存設計の再利用） | 進行中（親done未達） | 未実施 | 未実施 | 未実施 |
