## 1. 公開取得器
- [x] 1.1 本人3回答と仕様ゲートexit0を保存する（REQ-393）
- [x] 1.2 型とkit公開取得器・導入案内を実装し、52境界の原観測と恒等版の全status/実exit一致を試験する（REQ-393）
- [x] 1.3 kit tarballの公開consumer・既存API/CLI保持を試験し、changesetと日別記録をそろえる（REQ-393）
- [ ] 1.4 `pnpm -s verify --change collect-vitest-body-evidence --done --scope local`を通す（REQ-393） <!-- loomake:gate=done -->
同期archiveと最終CI・3 OS・独立レビューはローカル完了後に行い、初子だけで親#278を完了にしない。
