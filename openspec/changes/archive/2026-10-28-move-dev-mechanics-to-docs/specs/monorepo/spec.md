## REMOVED Requirements

### Requirement: devcontainer
**Reason**: このリポジトリの開発環境の決まりで、Loomake を導入する人にも配布物にも届かない。利用者に配る devcontainer の雛形は、init の仕様（`packages/kit/templates/devcontainer/`）で扱う
**Migration**: docs/dev/devcontainer.md を見る。`tests/monorepo.test.ts` の試験は、要件 ID を外した名前で残す

Source: REQ-004, REQ-061

### Requirement: PR の古い CI 実行の取り消し
**Reason**: このリポジトリの CI の待ち時間を縮める仕組みで、利用者にも配布物にも届かない
**Migration**: docs/dev/ci.md を見る。`tests/monorepo.test.ts` の試験は、要件 ID を外した名前で残す

Source: REQ-215

### Requirement: OS によらないテストの前提
**Reason**: このリポジトリのテストの書き方の決まりで、製品の振る舞いではない
**Migration**: docs/dev/testing-across-os.md を見る。`[REQ-236]` を付けていた試験は、ほかの要件 ID を残し、`[REQ-236]` だけを外す

Source: REQ-236

### Requirement: 外部操作の期限の試験の偽の CLI
**Reason**: このリポジトリの試験の作り方の決まりで、製品の振る舞いではない。外部操作の期限の振る舞いは、run・external-process-budget などの仕様に残る
**Migration**: docs/dev/testing-across-os.md を見る。`[REQ-240]` を付けていた試験は、ほかの要件 ID を残し、`[REQ-240]` だけを外す

Source: REQ-240
