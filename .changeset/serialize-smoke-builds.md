---
---

配布物を使う試験では、Vitest の globalSetup が試験を始める前に `pnpm -r build` と `pnpm pack` を 1 回だけ動かし、試験の中の prepare はその tarball を使う（Issue #34）。配布するパッケージは変えない。
