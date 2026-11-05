# Trace: effort-record

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/loomake-v0.11.md | v0.11.3、FR-50 L202・NFR-09 L215・7.8 L494〜524 | 2026-10-29 |
| docs/adr/0006-standing-approval-for-autonomous-delivery.md | 基準main b2b3f824、決定B L104と通常設計のおすすめ採用 | 2026-11-05 |
| Issue #68 | 本文と範囲決定コメント6651340624、.loomake/design68/issue68.json | 2026-11-05 |
| Opus設計 af787f62-4bed-4598-a940-1ee213a76ae4 | actual claude-opus-5-5、対象b2b3f824、design、exit0・oktrue | 2026-11-05 |
| #65 P1共有置換の既存設計 | Opus 7e9d5568-6df5-4ee8-9b3c-aaf939953f20、REQ-447、PR #450・#453でmain受入済み | 2026-11-05 |
| 管理役の採用判断 | 本会話のPR1計画依頼、整合案(1)〜(5)採用、Q-18採用・Q-19実受入とAPI一致確認 | 2026-11-05 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-466 | 要件定義FR-50 L202・NFR-09 L215、ADR0006 B L104、Opus設計§2/3/6、管理役Q-13〜19 | 機能 | 単位と欠測を区別した人の実績を独立形式へ追記し、共通置換後に検査する。共有置換のmain受入前は実装しない | 反映済 | specs/effort-record/spec.md |
| REQ-066 | openspec/specs/trace-record/spec.md L8〜32、Opus設計§6 | 機能 | 既存の証拠記録と全Scenarioを維持し、effort指定時だけverifyを行わない例外を加える | 反映済 | specs/trace-record/spec.md |
| REQ-127 | openspec/specs/trace-record/spec.md L81〜89、Opus設計§6 | 機能 | 検証文書snapshotの全文とScenarioを維持し、effortを指定しないrecordに限定する | 反映済 | specs/trace-record/spec.md |
| REQ-128 | openspec/specs/trace-record/spec.md L90〜102、Opus設計§6 | 機能 | 検査前後の変更照合の全文と全Scenarioを維持し、effortを指定しないrecordに限定する | 反映済 | specs/trace-record/spec.md |
| REQ-067 | openspec/specs/trace-record/spec.md L33〜49 | 制約 | 未コミットの変更は新しい時間の記録でも拒否し、gitignoreで除外した変更は含めない | 既存仕様で充足 | 既存仕様維持、REQ-466の追加試験 |
| REQ-068 | openspec/specs/trace-record/spec.md L50〜62 | 制約 | 既存記録を上書きせず、同じ名前の公開を拒否する | 既存仕様で充足 | 既存仕様維持、REQ-466の追加試験 |
| REQ-083 | openspec/specs/trace-record/spec.md L72〜80 | 制約 | traceの実行時依存はcoreとkitだけにする | 既存仕様で充足 | 既存依存と試験維持 |
| REQ-084 | openspec/specs/trace-record/spec.md L63〜71 | 制約 | recordはネットワークなしで動作する | 既存仕様で充足 | 既存仕様維持、REQ-466の追加試験 |
| REQ-229 | openspec/specs/development-decisions/spec.md L34〜42 | 制約 | 比較方式・範囲・5区分と推定を持つ既存手書き様式を保持する | 既存仕様で充足 | docs/effort/の原文不変 |
| REQ-230 | openspec/specs/development-decisions/spec.md L43〜55 | 制約 | C-001の事前見積もり24〜58時間とchange未作成を保持し、実績へ転用しない | 既存仕様で充足 | docs/effort/c-001.md不変 |
| REQ-364 | openspec/specs/development-decisions/spec.md L56〜72 | 制約 | 計測の0・不明・非該当・観測中を区別し、M1/M2を判断要求/試行と同一にしない | 既存仕様で充足 | 既存計測定義維持 |
| REQ-365 | openspec/specs/development-decisions/spec.md L73〜89 | 制約 | 既存の柱1様式・M5の取得範囲・単価出典・費用/トークン内訳を保持する | 既存仕様で充足 | 既存計測定義・手書き様式維持 |
| REQ-467 | Opus設計§5/6、Issue68の承認済み範囲 | 範囲外 | 手書き記録を出典と欠測理由つきで読む。親義務のままPR2へ残す（フェーズ：W1 PR2） | 範囲外 | proposal.md Non-goals、親#68 |
| REQ-468 | 要件定義FR-50・7.8、Opus設計§4/6 | 範囲外 | change・比較方式・推定幅・人実績・削減率・比較種類・判断要求・試行・費用の9列を集計する。親義務を維持（フェーズ：W1 PR2） | 範囲外 | proposal.md Non-goals、親#68 |
| REQ-469 | 要件定義FR-30 L176・FR-50 L202・7.8、Opus設計§5/6 | 範囲外 | #70の状況レポートの回帰節直後へ効率表を接続し、単独表で完了にしない（フェーズ：W1 PR3） | 範囲外 | proposal.md Non-goals、親#68 |

## 確認事項

回答者「管理役Codex」はADR0006に基づくおすすめ採用であり、利用者の新しい承認ではない。Q-01〜12は設計の分担と親の受入を含み、PR1の仕様に関わるものだけblockingとする。Q-19は実受入と公開 API を確認して解消した。

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-466 | 手書き原本の欠測と製品をどう分けるか | A:欠測契約の製品と親の実取込受入を分ける / B:全停止 | A。欠測を偽装せず製品を検証できる | no | A。親の実記録受入はQ-10へ。出典:Opus§1、管理役PR1依頼、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-02 | REQ-467, REQ-468 | C-001と複数changeをどう結ぶか | A:単一の正しいidだけ対応 / B:推定配賦 | A。複製・按分しない | no | Opusの限定A。未作成や複数idは未対応。PR2へ保持。出典:Opus§1、管理役採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-03 | REQ-466 | 時間と内訳の入口は何か | A:単位つき非負整数分へ正規化 / B:暗黙時間 | A。省略と0を区別する | yes | A。総計または区分、0..100000整数分。詳細はQ-13/14。出典:Opus§2/3、管理役採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-04 | REQ-466, REQ-066, REQ-127, REQ-128 | 時間記録もverifyを実行するか | A:専用入口 / B:Evidence2へ必須追加 | A。品質合格を作らない | yes | A。runRecordを保持しrunEffortRecordを追加。出典:Opus§1/3/6、管理役採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-05 | REQ-467 | 手書き取込を保存するか | A:読取時の投影 / B:JSON複製 | A。正本を増やさない | no | OpusのAへ変更。原文・hash・行を読むだけで加算しない。PR2へ保持。出典:Opus§1、管理役採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-06 | REQ-466, REQ-468 | 部分計と付帯情報をどう扱うか | A:欠測保持・区分別 / B:経過時間代入 | A。時間・回数・費用を推測しない | yes | A。M1/M2代入なし、M5詳細を満たしたとしない。9列と集計はPR2へ。出典:Opus§1/4、管理役採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-07 | REQ-468 | 幅ゼロと削減率をどう計算するか | A:正分母で算出 / B:常に欠測補完 | A。幅ゼロは1点で計算 | no | OpusのA。逆転・0分母・欠測・重複は理由つき算出不能。PR2へ保持。出典:Opus§1/4、管理役採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-08 | REQ-469 | 状況レポートとの接続はいつか | A:#70後PR3 / B:既存release JSON変更 | A。回帰節直後へ接続する | no | A。単独CLI表は作らず接続まで親義務。出典:Opus§1/5、管理役採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-09 | REQ-466, REQ-467, REQ-468, REQ-469 | PR分割と予約は何か | A:通常L3を3本 / B:重複要件追加 | A。各PRに通常DoDを適用 | yes | A。PR1は466と既存066/127/128だけ。467〜469予約維持。help原本と旧assertを残し、新5の具体差分・総数27→32を整合。出典:Opus§5/6、管理役採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-10 | REQ-467, REQ-468 | C-002/C-003の原本が未取得なら親を閉じるか | A:placeholderで完了判断 / B:親を保留 | B。実取込の運用証拠を作らない | no | B。利用者へ所在を質問済み・未回答。親#68を開いたままにしPR1の追加blockingにしない。出典:管理役の本会話、Opus§8、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-11 | REQ-230 | C-001のchange欄を1つに書換えるか | A:未作成維持 / B:親へ寄せる | A。範囲の一致を捏造しない | no | A。24〜58hと原文を保持。出典:Opus§8、管理役採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-12 | REQ-466 | effortの保存先はどこか | A:evidence/id/effort / B:新設定とignore | A。既存の追跡と証拠選択を保持 | yes | A。未実装#69に依存しない。出典:Opus§0/8、管理役採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-13 | REQ-466 | 字句regexと100000分上限をどう整合させるか | A:字句と数値を両方検査 / B:桁数だけ | A。999999mは拒否する | yes | A。hも正確な整数分だけ受理。出典:Opus§2/3の不整合、管理役整合案(1)採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-14 | REQ-466 | JSON例のminutesとtotalMinutes併記を採るか | A:排他本文優先 / B:両方保存 | A。例のtotalMinutesを採らない | yes | A。totalにsearchなし、区分のsearchは既知合計以下。出典:Opus§2の不整合、管理役整合案(2)採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-15 | REQ-466 | 未コミット拒否で同時追記を直列化できるか | A:同名原子衝突拒否だけ / B:直列化保証 | A。status検査はlockではない | yes | A。異なる時刻/HEADのexactly-once保証なし。出典:OpusQ-04の過大な説明、管理役整合案(3)採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-16 | REQ-466 | 費用の文法と重複をどう決めるか | A:USD最大2桁とtokens整数 / B:暗黙変換 | A。safe整数へ正確に変換する | yes | A。同kind反復と定額を拒否し異種合算しない。出典:Opus§2/3の未詳述、管理役整合案(4)採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-17 | REQ-466 | note500文字の数え方は何か | A:codepoint / B:UTF-16単位 | A。Unicode文字として判定する | yes | A。改行/制御拒否、置換後も検査。出典:Opus§2の未詳述、管理役整合案(5)採用、ADR0006 | 管理役Codex | 2026-11-05 |
| Q-18 | REQ-466 | Opus68にない秘密置換をどう補うか | A:#65P1共有maskValue / B:独自コピー | A。NFR09と共通設計に従う | yes | A。最終置換後の構造/bytes検査、raw入力由来診断を残さない。出典:NFR09 L215、Opus65 REQ447、管理役採用。Opus68で評価済みとはしない。ADR0006 | 管理役Codex | 2026-11-05 |
| Q-19 | REQ-466 | #65P1の共有maskValueはmainで受入済みか | A:受入とAPI一致の根拠を記録 / B:未受入を維持 | A。実受入とAPI一致を確認する | yes | A。PR450=3f67db52、PR453=db893f01、CI42046155583必須5・通常3OS・ci23PASS。kit公開maskValue同期・入力不変を実確認。既存resolveChangeDirはnamed公開を追加。ADR0006 | 管理役Codex・実装担当 | 2026-11-06 |

## 仮定

未承認の仮定は置かない。未知の原本・未受入の共有APIを存在するものとして扱わない。

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
