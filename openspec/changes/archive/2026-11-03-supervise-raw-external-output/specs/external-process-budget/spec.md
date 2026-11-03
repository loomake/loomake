## ADDED Requirements

### Requirement: バイト列を保持する私的な同期外部操作
私的な同期外部操作はstdoutとstderrを元のBufferで返し、既存の共有予算・期限・中断状態・子孫停止・保持役の準備待ちと解放を共有する SHALL。公開runExternalのAPI・型・文字列化・例外・戻り値のerror有無・同期性を変えず、私的入口をpackage barrelへ公開しない SHALL。

Source: REQ-412

#### Scenario: 不正UTF-8とBOMを含む原文
- **WHEN** 対象がstdoutとstderrへ不正UTF-8とBOMを含むバイト列を出力する
- **THEN** 各Bufferをバイト単位で一致させ、文字列への変換と再符号化を経由しない

#### Scenario: データ上限と親の制御用領域
- **WHEN** 私的入口へ明示する上限を検査し、64KiB以上の有効な上限では対象のstdoutとstderrの合計が上限ちょうど、または1バイト超になる
- **THEN** ちょうどならerrorなしで成功し、1バイト超なら監視役の実際の出力制限として失敗する。親の捕捉領域だけに既存64KiBを制御用として予約し、fd3を含めて捕捉するが、データ上限は増やさない。私的上限が省略・非正・安全な整数以外、または予約との加算が安全な整数でなければ対象の起動前にUsageErrorとする。有限の制御用領域を超えるnative ENOBUFSは既存のエラー処理を保つ

#### Scenario: 共有期限切れと中断後の未起動
- **WHEN** 同じ共有予算が既に期限切れ、または既存の外部操作で中断状態になったあとに私的入口を呼ぶ
- **THEN** 対象を起動せず、既存と同じ時間制限または中断として失敗する

#### Scenario: 通常終了と失敗の区別と公開範囲
- **WHEN** 私的入口で実行ファイルの不存在、通常の非0終了、監視の制限が起きる
- **THEN** ENOENTを持つ結果、非0 statusの結果、ProcessLimitErrorを区別し、成功・非0終了でerrorフィールドを追加しない。私的入口はpackage barrelから参照できず、公開runExternalの既存結果を保持する
