## 1. 仕様
- [x] 1.1 monorepo の差分仕様に、「CI のテストの分割」（REQ-214）と「PR の古い CI 実行の取り消し」（REQ-215）を ADDED として書く。REQ-049 の本文は変えない

## 2. テスト
- [x] 2.1 `tests/monorepo.test.ts` に、ci.yml のシャードとカバレッジ付きの実行を確かめるテストを足す（REQ-214）
- [x] 2.2 `tests/monorepo.test.ts` に、ci.yml の concurrency を確かめるテストを足す（REQ-215）

## 3. 実装
- [ ] 3.1 `.github/workflows/ci.yml` の quality ジョブを、ubuntu ではカバレッジ付きで 1 回、macOS・Windows では 2 つのシャードでテストを実行するように変える（REQ-214）
- [ ] 3.2 `.github/workflows/ci.yml` に、PR の古い実行を取り消す concurrency を足す（REQ-215）

## 4. 確認
- [ ] 4.1 `pnpm -s verify --change speed-up-ci --done` を通す <!-- loomake:gate=done -->
