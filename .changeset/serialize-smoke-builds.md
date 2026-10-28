---
---

試験の中で同時に動く配布物の準備（`scripts/package-smoke.mjs` の prepare）が、`pnpm -r build` と `pnpm pack` を 1 つずつ動かすようにする（Issue #34）。配布するパッケージは変えない。
