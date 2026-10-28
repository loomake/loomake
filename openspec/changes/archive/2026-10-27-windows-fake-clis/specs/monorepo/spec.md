## ADDED Requirements

### Requirement: 外部操作の期限の試験の偽の CLI
外部操作の期限を確かめる試験は、ubuntu-latest・macos-latest・windows-latest のどれでも、偽の CLI（git・gh・OpenSpec CLI）を製品と同じ起動の仕方で呼ばせる SHALL。git は shell なしで、gh と OpenSpec CLI は Windows では shell 経由で起動する。試験は、偽の CLI が狙った操作で止まった印と、それより前の本物への転送が起動に失敗していないことを確かめてから、期限・終了コード・停止の理由・後続の処理を確かめる SHALL。予算を延ばした試験は、1 操作の期限または共有予算より長く待ったことと、期限に猶予を足した時間のうちに止まったことを確かめる SHALL。

Source: REQ-240

#### Scenario: 偽の git が呼ばれない
- **WHEN** 偽の git が呼ばれず、本物の git が動く
- **THEN** 試験は狙った段階に届いていないとして失敗し、期限と終了コードだけで合格にしない

#### Scenario: 準備で予算を使い切る
- **WHEN** 準備の外部操作だけで共有予算を使い切り、狙った操作に届かない
- **THEN** 試験は合格しない
