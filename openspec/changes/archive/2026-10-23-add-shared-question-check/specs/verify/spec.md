## ADDED Requirements

### Requirement: 同じ確認事項の回答の照合
仕様ゲートは、質問に「<change-id> の Q-xx と同じ質問」と書いた確認事項について、参照先の change の trace.md にある同じ ID の確認事項と回答を比べ、違えば不合格にする SHALL。片方の回答だけが空のときも違うとみなす SHALL。参照先は進行中の change から探し、なければ archive から探す SHALL。参照先の change か、その中の確認事項が見つからないときは不合格にする MUST。

Source: REQ-034

#### Scenario: 回答が同じ
- **WHEN** change B の Q-01 の質問に「（A の Q-01 と同じ質問）」とあり、change A の Q-01 と回答が同じ状態で、B に `--spec-only` を実行する
- **THEN** この検査は合格する

#### Scenario: 回答が違う
- **WHEN** change B の Q-01 の質問に「（A の Q-01 と同じ質問）」とあり、A と B で Q-01 の回答が違う状態で、B に `--spec-only` を実行する
- **THEN** 不合格となり、Q-01 と、A と B それぞれの回答が出力され、終了コードは 1 である

#### Scenario: 片方だけ回答がある
- **WHEN** change A の Q-01 には回答があり、印のある change B の Q-01 の回答が空の状態で、B に `--spec-only` を実行する
- **THEN** 不合格となる

#### Scenario: 参照先が archive にある
- **WHEN** 印の参照先の change A が `archive/2026-10-01-A` にあり、Q-01 の回答が同じ状態で、B に `--spec-only` を実行する
- **THEN** この検査は合格する

#### Scenario: 参照先が見つからない
- **WHEN** 印の参照先の change が進行中にも archive にもない状態で `--spec-only` を実行する
- **THEN** 不合格となり、見つからない change-id が出力される

#### Scenario: 印がない
- **WHEN** 別の change と同じ ID の Q-01 を持つが、質問に印がない change に `--spec-only` を実行する
- **THEN** 回答が違っても、この検査は不合格にしない
