## MODIFIED Requirements

### Requirement: 対応環境での配布物の検証
CIは3OSのNode24で配布物の主要コマンドを検証する SHALL。配布物の宣言する下限Node22.12.0での確認は「Node.js のバージョン宣言」に従う。開発ツールを使う準備はNode24で行い、ランタイムの確認は指定したNodeで行う SHALL。

Source: REQ-144

#### Scenario: 3OSのNode24で配布物を検査する
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** quality ジョブのマトリクスの OS を決める式に ubuntu-latest・macos-latest・windows-latest が含まれ、Node24 で準備したあとに `package-smoke.mjs prepare` と `package-smoke.mjs check` を実行する

#### Scenario: Node下限で検査する
- **WHEN** Node24で準備した配布物を、配布物の宣言する下限Node22.12.0で使う
- **THEN** 開発ツールを実行せず主要コマンドの動作を確認する

## REMOVED Requirements

### Requirement: 3 つの OS での CI
**Reason**: CIのOS選択とテスト分割はADR0005の純開発運用である。利用者の1-1に従うnode20削除とPRのslow不実施を、製品契約と混ぜず開発文書で扱う。全case・assert・時計上下限・品質閾値は保持する。
**Migration**: docs/dev/ci.mdの「split-slow-ci-checksの移管保存」に取得main085aの全文・全Scenario・旧Source・raw hashを保存した。実装時に同文書の新運用を有効化し、push/schedule/localとreleaseの全件、PRのfast、OS/シャード・診断の保持を検証する。CI側の049/214/273タグの旧名対応を記録し、他契約と273の履歴矛盾は消さない。
Source: REQ-049, REQ-270, REQ-273

### Requirement: CI のテストの分割
**Reason**: CIのOS選択とテスト分割はADR0005の純開発運用である。利用者の1-1に従うnode20削除とPRのslow不実施を、製品契約と混ぜず開発文書で扱う。全case・assert・時計上下限・品質閾値は保持する。
**Migration**: docs/dev/ci.mdの「split-slow-ci-checksの移管保存」に取得main085aの全文・全Scenario・旧Source・raw hashを保存した。実装時に同文書の新運用を有効化し、push/schedule/localとreleaseの全件、PRのfast、OS/シャード・診断の保持を検証する。CI側の049/214/273タグの旧名対応を記録し、他契約と273の履歴矛盾は消さない。
Source: REQ-214, REQ-270
