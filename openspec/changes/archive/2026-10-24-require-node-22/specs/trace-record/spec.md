## REMOVED Requirements

### Requirement: 動作環境
**Reason**: 下限を Node.js 20.19 から 22.12 に上げる。シナリオの名前が版を含むため、「Node.js の下限」に置き換える
**Migration**: 「Node.js の下限」の Requirement を見る

Source: REQ-142

## ADDED Requirements

### Requirement: Node.js の下限
`loomake trace record` は、Node.js 22.12 以上で動作する SHALL。

Source: REQ-142

#### Scenario: Node.js 22.12 で動く
- **WHEN** Node.js 22.12 の環境で trace record のテストを実行する
- **THEN** テストが合格する
