# row runtime 基盤の先行準備

1. split-slow-ci-checks の task 2.7 から既存の row runtime・native fixture・6試験の3fileを元byteのまま取り出した。2.5の監査とinventoryは同じ後段PRに保ち、2.7と全changeは未完了のままとした。
2. spec-only・strict・lint・型検査が成功し、row 6件と既存partition 24件の計30試験が成功した。全体は未完了のためdoneの成功を主張しない。
3. Q-115をADR 0006の包括承認として記録した。C1・一般oracle・実registry・OS割当と全体の完了ゲート・CI・レビューは未受入のまま残る。
4. 管理役が差分境界を既存Issueへ記録し、独立レビューとCIへ進める。段階受入規則の未決判断をこの準備で代用せず、mainへの統合は全受入後に行う。
