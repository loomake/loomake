# Trace: validate-engine-json-result

本書は現在の出典と全元表を残す。詳細経緯・元資料/所有の対応・旧採否・失敗/再実行は[3b3bの元trace][original]、現在条件はdesignへ集約する。表のID/出典/質問/選択肢/おすすめ/回答/回答者/日付は原文不変で、最大欄長163字である。

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| plan90-2026-10-30.md のE3 | 2026-10-30・品質枠 | 2026-10-30 |
| Opus b95d2ffb-cf24-4196-a33a-084cd3f82257 最終設計 | head5c71ae0・claude-opus-5-5・未実装 | 2026-10-30 |
| 管理役 manager-decisions.md | Q1〜Q11・監査残5点・Q3 suffix明記 | 2026-10-30 |
| Issue121 comment6524458298 | 管理役のREQ-340/341予約 | 2026-10-30 |
| 現行main085aのrun/run-decision-policy | 085a82686dc1c14506fbdbad88b5b9b3961f522e | 2026-10-30 |

元8本文/41 Scenario、REQ-100のa1追加Scenarioと正式ID340/341の出典を保持する。元資料/manifest等の位置は[固定元][original]を参照する。

## S1の統合方針（2026-10-31）

Issue #243と分割設計（Opus `d8cc219c-81a8-4e8a-bf5a-1802b1c4c513`、対象 `d822e540`）を引き継ぐ。統合先の基点はmain `248c89b6`、ブランチは `integration/e3-result-20261031` とする。既存の古いローカルrefと元PR #185は保持した。仕様本文・Source・Scenarioは元headと同一で、コードのない2.1〜3.4の印を戻す。以下の元表は当時の判断の履歴で、実採集0/4と残る受入条件を省かない。表の外の本文にある13済/6未・旧5task・「状態は変更しない」もd822e540の履歴であり、S1作成時は4済/15未だった。現在の状態は[末尾のS4受入記録](#s4-acceptance-current)に記す。旧実装・試験を確定形で記した箇所もd822e540の履歴であり、この統合ブランチへの実装・試験の受入証明ではない。

REQ-100は進行中のverify-v2-wiringと重なるため[Issue #259](https://github.com/loomake/loomake/issues/259)で追跡し、現mainのREQ-331による変更なし停止、C001のlocal完了の区別、E3の異常停止をすべて保持して最終統合前に全文を再照合する。S1では元の仕様本文をbyte単位で変更しない。

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| E3-S1-01 | REQ-340・REQ-341 | 未完了changeをどう分割して受け入れるか | A：同一changeの統合先へ段階ごとに積む／B：未完了のままmainへ入れる | A。全19taskと実4件を保持する | yes | A。S1〜S5（#243〜246・#249）を統合先へ積み、F（#250）はdone成功後にmainへ出す。#247・#248は個別changeでmainへ入れる。各段レビューの積み上げは#250コメント6541939626の承認範囲で扱い、未完了のgateを成功とは呼ばない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| E3-S1-02 | REQ-340・REQ-341 | コードを含むPRでchange noneを使うか | A：使わない／B：開発用コードだけ例外にする | A。Q-S1の明示判断を守る | yes | A。noneは文書だけ。#247コメント6543723580と#248コメント6543723879に従い、採集入口と資格adapterは個別のchange・Opus設計・spec-only成功後に実装する。新しい設計や採集資格をこのS1で承認したとはしない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

## S2/S4順序の採用（2026-11-01）

管理役はOpus設計5f6412e0のQ-S2-01/02を理由付きで採用し、次のS2-Q01/02として記録する。設計の実行情報と適合確認の結果は [PR #261](https://github.com/loomake/loomake/pull/261) の証跡に記録する。S4の旧設計が現在の関数に適合するかを照合するまでは製品実装に進まない。

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| S2-Q01 | REQ-340・REQ-179 | 1200fileを使うS2保存試験とS4の順序 | A：S4を先行／B：Windows失敗を容認／C：recorder直接試験だけに代替 | A。旧d822は群化と併用しており、currentの引数長懸念を失敗容認や試験縮小で解消しない | yes | A。S4の2.5/3.5を先行し、その上へS2の2.1〜2.4/3.1/3.2全6taskと71件候補を移す。1200file・60秒・全assert・3OSを保持する。Windows失敗容認/recorderだけへの代替は不採用。引数長の懸念はモデルの未実測推論と区別する | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| S2-Q02 | REQ-100・REQ-331・REQ-340・REQ-317 | C001/current/E3のREQ-100全文の重なり | A：current振る舞いを保持しF前に全文統合／B：S2で元specを書換え／C：C001 archive待ち | A。currentのlocal完了と変更なし停止を巻き戻さず、S1の仕様原文保持も守る | yes | A。current mainのlocal/CIの区別とREQ-331の変更なし停止、E3異常停止を全て保持する。本文はIssue #259で最終統合F前に全文再照合し、S4では元仕様8件/41Scenario/Sourceを変更しない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-099 | b95 §2.4・main run「タスクごとのコミット」 | 機能 | 正常タスクのcommitを維持し、結果異常では未完了で止める | 反映済 | specs/run/spec.md |
| REQ-100 | b95 §2.8・a1追加Scenario・管理判断 | 機能 | 正常な完了ゲートと直しを保ち、異常結果の直しはcommit/再gateしない | 反映済 | specs/run/spec.md |
| REQ-204 | b95 §2.1・main run-decision-policyの同名見出し | 機能 | 既存停止順を保ち、結果異常のholdと変更理由の順を定義する | 反映済 | specs/run-decision-policy/spec.md |
| REQ-330 | b95 §2.5/2.6・main runの二見出し | 機能 | 空差分停止と正当なNoChangeの正常動作を保ち、結果異常で完了しない | 反映済 | specs/run/spec.md（変更を残さずに終えたタスク・変更が要らないタスクの合図） |
| REQ-331 | b95 §2.7・main run | 機能 | 空の直しで再gateせず、結果異常ではその理由で止める | 反映済 | specs/run/spec.md |
| REQ-340 | plan90 E3・b95 §2.2/§4・管理判断Q1/Q7・予約comment6524458298 | 機能 | 終了コード0の失敗/形の異常でguard後にindexを外し停止し、理由に本文を含めず確認先を示す | 反映済 | specs/run/spec.md |
| REQ-341 | b95 §2.3/§4/§5〜6・管理判断Q2/Q3・予約comment6524458298 | 機能 | 元出力の失敗優先分類と純粋AfterGuardを持ち、実4件と直接/変異試験で確かめる | 反映済 | specs/run-decision-policy/spec.md |
| REQ-112 | main run-guardsの差分表示と承認・管理判断Q7 | 制約 | 不正な直し方では差分と案内を表示し、変更を作業ツリーへ残す | 既存仕様で充足 | openspec/specs/run-guards/spec.md |
| REQ-118 | main runの秘密情報保護・b95 R-16 | 制約 | 既存の秘密情報の置換を維持する | 既存仕様で充足 | openspec/specs/run/spec.md |
| REQ-154 | main runの秘密情報保護・b95 R-16 | 制約 | 出力と記録の既存保護を維持する | 既存仕様で充足 | openspec/specs/run/spec.md |
| REQ-179 | main run-record-budget・管理判断Q1/残件4 | 制約 | 予約量超過はstop形式、保存不可は表示と終了1を保つ | 既存仕様で充足 | openspec/specs/run-record-budget/spec.md |
| REQ-109 | main run-guards「テストの削除とskip・todo」「宣言書換え」 | 制約 | 群化後もfile内の削除/skip/宣言検出と順序を保持する | 既存仕様で充足 | openspec/specs/run-guards/spec.md |
| REQ-110 | main run-guards「設定の変更の検出」 | 制約 | config/package scripts検出を保持する | 既存仕様で充足 | openspec/specs/run-guards/spec.md |
| REQ-111 | main run-guards「仕様とtrace.mdの変更の検出」 | 制約 | spec/change文書変更の検出を保持する | 既存仕様で充足 | openspec/specs/run-guards/spec.md |
| REQ-137 | main run「実行中の失敗」 | 制約 | Git失敗を既存の停止/保存経路へ返す | 既存仕様で充足 | openspec/specs/run/spec.md |
| REQ-138 | main run-guards「特殊文字を含むパスのガード」 | 制約 | 日本語/空白/tab/newlineを分断せず検出する | 既存仕様で充足 | openspec/specs/run-guards/spec.md |
| REQ-180 | main external-process-budget「期限と出力を監視する外部操作」 | 制約 | 各操作30秒とstdout/stderr合計64MiBを維持する | 既存仕様で充足 | openspec/specs/external-process-budget/spec.md |
| REQ-201 | main run-guards「テストの検査を弱める変更の検出」 | 制約 | 検査削減/自明assertをfile単位で検出する | 既存仕様で充足 | openspec/specs/run-guards/spec.md |

「反映済」は差分specへの反映だけで、製品/実4件/done成功を意味しない。Source204の別契約/330の二見出しは別扱い、新規採番なし。

## 確認事項

表の承認はADR0006に基づく方針決定で、利用者本人のレビュー/採集資格ではない。後続の限定改訂だけを優先し、外部条件不明は未収集・Issue/taskへ残す。

### 初期Q-01〜Q-11

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-340・REQ-341 | 理由をつなぐ順 | E3が先／違反が先 | **E3が先** | yes | 結果の異常を先、不正な直し方を後にする。REQ-179 の短い停止情報でも主因と確認先を先に示す。ガードの検査と表示は省かない（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-02 | REQ-340・REQ-341 | `type` が数値のとき | 形の異常／見ない | **形の異常** | yes | 既知 metadata の型不正として shape にする。既に採用済み。未知の文字列や未知欄の互換と区別する（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-03 | REQ-340・REQ-341 | 表示する subtype の文字 | `[a-z0-9_]{1,64}`／制御文字だけ除く / subtype全体64字（先の管理表の短い記述） | **前者**（管理役は元案のsuffix1〜64字を採用。全体最大70字） | yes | `error_` の後ろの suffix が `[a-z0-9_]{1,64}` の場合だけ、その subtype を表示する（全体は最大70字）。元の341案と旧Q3の70字という理由を維持する。先の表はsuffixへの適用を省略していたため明記した。固定長と文字種で本文・制御文字の混入を防ぐ（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-04 | REQ-340・REQ-341 | 収集時の `DISABLE_AUTOUPDATER=1` | 付ける／付けない | **付ける** | yes | 採集時だけ DISABLE_AUTOUPDATER=1 を追加する。既存導入を更新せず、認証・保護・設定源を変更しない（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-05 | REQ-340・REQ-341 | 認証がsubscriptionでないか、分からないとき | 止める／続ける | **未収集として独立作業を続ける**（旧：止めて判断待ち） | yes | subscription と確認できなければ、その版・case を未収集として Issue に記録する。認証の切替は行わず、確認可能な既存方式を維持する。管理役の回答待ちに戻すのではなく、独立作業を続ける（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-06 | REQ-340・REQ-341 | MCPに deny を足すか | 足す／既存のまま | **mcp__*を追加拒否**（旧：既存のまま） | yes | 個別名を探索せず、公式 disallowedTools の mcp__* を追加拒否する。先の「既存のまま」というおすすめは上書き済み。設定源・hook・既存規則は無効にしない。必須 flag を対象版で確認できなければ起動しない（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-07 | REQ-340・REQ-112 | E3だけで止まるときに index を reset するか | する／しない | **する** | yes | 停止時に変更を index から外し、作業ツリーに残す。REQ-112 と既存停止時の状態を維持する（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-08 | REQ-340・REQ-341 | `--max-turns` は公式 reference に載っていますが、2.1.308 の help には載っていません | A：help にない flag は使わない（error_max_turns は未収集）／B：公式 reference に載っている flag も許し、unknown option で終われば未収集 | **B** | yes | 対象版で適用可能な公式 reference の根拠を保存できれば試す。unknown option は未収集にする。保護を変更する flag ではない。公式根拠がなければ起動しない。必須の error_max_turns 2 件を省かない（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-09 | REQ-340・REQ-341 | 既存の hook が記録を作るかは分かりません | 記録したうえで採集する／判断待ちで止める | **非永続化を確認できなければ未収集**（旧：記録して採集する） | yes | 保護を維持して原 raw・認証秘密の永続化を避けられると確認できなければ未収集。「無害な prompt なので不明のまま採集する」という旧おすすめは採用しない。親の privacy 条件を保つため（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-10 | REQ-340・REQ-341 | 2.1.307 に `--no-session-persistence` があるかは未確認です | 記録して採集する／未収集にする | **非永続化を確認できなければ未収集**（旧：記録して採集する） | yes | その版・case は未収集とし、Issue と未完了 task を残す。CLI 自身の会話記録を許して採集完了とする案は採用しない。既存保護を外して解決しない（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-11 | REQ-340・REQ-341 | 3xa は見積もり493で、余裕が7字です | 実測が500以下ならそのまま／超えたら §2.2 の削る候補を使う | 実測してから決める | yes | 予約照合後に 340/341 を割り当て、正式 ID・最新 main で正規 parser の 500 UTF-16 制限を再計測する。仮 ID の測定を正式本文の合格根拠へ流用しない。Source と全 Scenario を保つ（管理役判断。ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |

Q-08〜10の根拠/導入をtask4.1で確認しても、認証/保護/全保存経路が未証明の4.2や実4件の完了とはしない。

### 分類/保存の独立設計採用

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| E3-D01 | REQ-341・REQ-204 | 分類器・観測型・直接試験の置き方 | A1：decision-policyと構造化fault、新規試験／A2：理由文字列、既存件数更新 | A1。既存45件と期待値を保持 | yes | decision-policyに純粋関数を置き、構造化fault/pathと明示欄を渡す。新規試験で変異を検出し既存期待値を変えない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| E3-D02 | REQ-340・REQ-341 | hold後の判断とreset | 共通AfterGuard／holdだけ。reset常時／E3単独だけ | 共通AfterGuardとE3単独reset。既存guardを保つ | yes | task/repairの両経路を共通化。違反resetは既存guard、E3単独resetだけ追加。reset失敗はREQ-137の既存GitError経路 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| E3-D03 | REQ-340・REQ-179 | 長いパスの確認 | Linux実path限定／startRecording直接試験／両方 | 全OS直接試験。新skipとpath制限を避ける | yes | 短pathは実run、長pathはstartRecording直接試験。recorder/logs/log-policyは再利用し変更しない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| E3-D04 | REQ-340・REQ-341 | projectionとraw hashの保存 | 正規表現／閉集合／全derived。hash例外あり／一律なし | 閉集合とhash一律なし。表/schemaを一致させる | yes | design4章のliteralだけprojection、その他は全型・分類・表示を保つderived。元raw/元値hashを保存しない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| E3-D05 | REQ-340・REQ-341 | collectorの場所とsuccessの成立 | scripts／test内。任意string／OKだけ | scriptsと任意string。許可集合を共通化 | yes | collector/validatorはscripts。successのOK以外はderived。実case/fixtureの真偽を維持 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| E3-D06 | REQ-340・REQ-341 | settings読取と会話外書込の限界を安全性の代わりにするか | Bの読取/限界記録案／保護確認まで採集しない | 採集しない。原raw/秘密の非永続化を弱めない | yes | Q-B3/B4案を安全性の証明に代用しない。実4件未収集・task未完了を保ち、依存しない製品D01〜D05だけ先行 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

### 採集制御3203554f

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| CD-1 | REQ-340・REQ-341 | 子のauto-memoryを止めるか | A：公式環境1追加／B：updaterだけ | A | yes | A採用。子だけに追加し既存保護を維持 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| CD-2 | REQ-340・REQ-341 | hook/plugin確認のため設定を読む範囲 | A：限定readonly probe／B：全hook無効／C：通常利用同等を許容 | A | yes | A採用。native既知ローダーの非認証settings JSONだけをメモリで読み固定boolean/理由だけ返す。旧読取禁止の限定手順改訂で、秘密/原文/値/パス/例外を保存しない。読取成功を安全性へ代用しない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| CD-3 | REQ-340・REQ-341 | managedを確認できない場合 | A：拒否／B：保証外へ外す | A | yes | A採用。未証明はfalse/unknown。ローカル不在だけで管理ポリシーなしとしない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| CD-4 | REQ-340・REQ-341 | 診断用環境の扱い | A：固定名/接頭辞のset/nonemptyだけ確認／B：削除 | A | yes | A採用。値/名前一覧を保存せず削除もしない。settings envも確認し不明は拒否 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| CD-5 | REQ-340・REQ-341 | CLI state等の書込 | A：公式/対象版根拠で非永続化を確認／B：metadataなら許容 | A | yes | A採用。未証明なら起動しない。no-session-persistenceだけで全経路安全としない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| CD-6 | REQ-340・REQ-341 | 任意の事後検出 | 自己cwd由来1対象stat／実施しない | 任意 | yes | 自己作成cwd由来の対象だけstat可。予防証明には数えず、他領域の探索をしない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

CD-2は旧読取禁止を非認証3JSONの限定技術手順だけ改訂する。読取成功/会話外書込の限界記録を安全性証明へ代用せず、固定booleanには実証拠と管理確認を要する。

### 追加制御6c4bd8c7

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| QD-1 | REQ-340・REQ-341 | 追加OS制御の導入 | C launcher／ctypes／他ツール／導入なし | Cを調査候補 | yes | 調査候補だけ。実装/適用は未採用 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| QD-2 | REQ-340・REQ-341 | 制限下のgenuine資格 | hook/plugin空なら数える／数えない | 旧：前者 | yes | 未採用。空だけを資格にせず全証拠/P6を維持。空必須という一般条件も追加しない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| QD-3 | REQ-340・REQ-341 | pathname Unix制御 | seccomp調査／ABI9待ち／拒否 | 調査のみ | yes | 候補調査だけで実装/適用未採用 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| QD-4 | REQ-340・REQ-341 | host audit/eBPF/swap等の扱い | 新たな証明義務／従前境界を保持 | 従前境界 | yes | 無限の証明義務を追加せず、JSメモリ消去の限界とcollector/CLI/子孫の非保存を維持。実在診断B1等は未証明として拒否 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| QD-5 | REQ-340・REQ-341 | syscall試験の配置 | 全OS純粋試験+手動調査／新skip | 前者 | yes | 前者採用。新skip/設定緩和なし | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| QD-6 | REQ-340・REQ-341 | 診断の固定分類 | 固定分類／存在で拒否 | 後者維持 | yes | 後者維持。公開nativeの厳密な分類根拠だけ準備し環境値は読まない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

QD-1/3は調査候補だけでsandbox/launcher/seccompの実装適用は未採用。P1/P2/P3とfake lifecycleの先行実装を資格adapter/live/永続化台帳へ接続せず、P6拒否/実0/4を維持する。

### lifecycle dbfb3588

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| LC-1 | REQ-340・REQ-341 | 依存の利用境界 | 必須注入／TS/dist直結／公開export追加 | 必須注入 | yes | A採用。fake factoryだけ、実OS/CLI adapter既定なし | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| LC-2 | REQ-340・REQ-341 | close猶予 | 500/1000/5000ms | 1000ms | yes | 1000ms採用。既存5分/TERM5秒とgroup1秒を保持し終結を有界にする | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| LC-3 | REQ-340・REQ-341 | HUPを扱うか | 同中断／扱わない | 同中断 | yes | SIGINT/TERMと同じ中断。偽emitterだけで検証 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| LC-4 | REQ-340・REQ-341 | capture後の判定共有 | 純粋関数抽出／複製／proxy | 抽出 | yes | projectResultTransportへ抽出。既存36/66/45とmutation期待値を維持 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| LC-5 | REQ-340・REQ-341 | win32の動作 | tree adapter追加／factory0拒否 | 拒否 | yes | factory0でplatform-unsupported。実Windows通常終了の保証なし | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| LC-6 | REQ-340・REQ-341 | closeだけの場合 | exitへ代用／exit-unobserved | 後者 | yes | 後者採用。不一致はexit-close-mismatchでnot-collected。遅いgroup trueは期限後採らない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

### 受入規則の整合

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| WF-20261031 | REQ-340・REQ-341 | PR185の5.3を改訂レビュー規則へ合わせるか | 旧規則を残す／改訂ADRへ合わせる | 改訂ADRへ合わせる。利用者の明示採用と正本に整合する | yes | L3の重大な指摘ゼロ・最大2往復、Codex参考、指摘修正だけのhead差は管理役判定。3OS必須を明記し、実4件/P6/tasks/doneを免除しない | 利用者（ADR 0006 の包括承認・本会話の明示採用） | 2026-10-31 |

19task13済6未（3.5、4.2〜4.4、5.1/5.2）と非checkbox必須受入1未達を保持する。元18意図=17tasks+1の移動時点は履歴で、現件数へ転用しない。元8 Requirement/41 Scenario/Source・19task行と状態は変更しない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-LC-1 | REQ-340・REQ-341 | 注入clockは単調な有限ms、schedulerはcallbackを進める契約とする | 合成driverの契約であり、任意の同期依存がhostを停止する保証まで追加しない。実OS/資格の証明ではない | yes | 管理役root（ADR 0006） | 2026-10-31 |

D01〜D05に新仮定なし。C001/S1の契約を推測で混ぜない。各設計の未読/材料不足、重複実行の未実施を確認済みへ数えない（design7と固定元）。

## guard ecb3f21c/08fff24dと管理補正

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| G-BUDGET | REQ-180 | 表示群の出力予算をどう維持するか | stdout単独累計／返却stdout+stderr累計／kit protocolでwire計測 | 返却stdout+stderr。kitを変えず旧合計予算を保つ | yes | H-Q2=Aと管理補正採用。bytesは返却UTF8の値。末尾3byte以内はroomへ安全側課金。返却textのU+FFFDが同境界にあればbatchだけoutput停止し、不完全hunkも成功にしない | 利用者（ADR0006包括承認、管理役採用） | 2026-10-31 |
| G-DISPLAY | REQ-112・REQ-138 | 表示群で対象fileだけをどう保つか | 旧連結／literalだけ／literal+固定形式+file境界選別 | 最後。literalだけではdir子削除を含む | yes | H-Q1=B'・H-Q3=A no-renames・H-Q4=A固定を採用。filter前の全stdout/stderrを課金する | 利用者（ADR0006包括承認、管理役採用） | 2026-10-31 |

G-Q1/2/3/5/7とH-Qの採否はdesign10へ集約した。旧表示連結/stdout単独課金を不採用とし、返却UTF8 bytesとwireを同一視しない。U+FFFD境界/完全hunk/EOF/極小roomの拒否、constant textconvのM0、name-status終端/ペア/空項目/decoded重複の管理補正を保持する。旧git caller/kit protocol/品質設定/元1200fileと60秒/全旧assertは不変。

## S4受入前の未受入事項（履歴）

この節はS4受入前の履歴で、当時は実CLI起動0・実4件0/4、P6と親の旧5task/3.5/done/最終受入が未達だった。task 3.5の現在の受入状況と残る7taskは[末尾のS4受入記録](#s4-acceptance-current)とtasks.mdに記す。fixture投影の新literal候補は未採用/未実装である。原raw/元値hash非保存、保護維持、native/設定源/managed/hook/plugin/診断/stateの資格未成立、実OS/live/保存台帳の未実装を残す。採集制御の先行分割は親完成や元Source/Scenarioの削減にしない。

[original]: https://github.com/loomake/loomake/blob/3b3b6d7e2f68fd8c71a888a7302f28e6ef91c291/openspec/changes/validate-engine-json-result/trace.md


### Windows literal pathspec修正の本体技術採用（2026-10-31）

出典は独立Opus設計8afb8b0d-5775-47d6-81f7-cce858c5916eの全文と、本体rootの本会話での技術採用である。以下は利用者本人の新しい直接回答ではなく、既存設計のtask2.5内の修正判断として記録する。

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| W-GIT-01 | REQ-137・REQ-138 | Windows偽gitの先頭flag拒否をどう修理するか | A：batchOutput子envでliteral／B：native launcher | A。公式の等価指定で差分を限定 | yes | A。本体技術採用。子envだけにGIT_LITERAL_PATHSPECS=1を足し2argsの先頭flagを外す。元env・他caller・期限は不変 | 本体root（技術採用） | 2026-10-31 |
| W-GIT-02 | REQ-109・REQ-180 | literal群の呼出観測をどう移行するか | a：子envで選択し検査強化／b：旧flag選択を維持 | a。数値期待と検査強度を保持 | yes | a。本体技術採用。26/28/8192+152期待は不変、全群の先頭diff/flag不在と残2件のadd/name-status diffを追加確認。期待値緩和ではない | 本体root（技術採用） | 2026-10-31 |
| W-GIT-03 | REQ-137・REQ-138 | flag/envの等価性をどう確認するか | 公式と実Git／Git sourceを新規取得 | 公式と実Git。正負を実証 | yes | 本体技術採用。公式等価記述とW2でGLOB/ICASE衝突、NOGLOB、既存LITERAL=0、元env不変を確認する | 本体root（技術採用） | 2026-10-31 |
| W-GIT-04 | REQ-297 | push試験へdiff転送assertを追加するか | 追加しないでCI診断／追加する | 追加なし。既存試験を保持 | yes | 本体技術採用。external-budgetは変更せず、diffのshim/転送成功がpush停止前にあることを本体がCIで確認する。実3OSは未達 | 本体root（技術採用） | 2026-10-31 |


<a id="s4-acceptance-current"></a>

## S4 の段階受入を S2 へ記録（2026-11-01）

管理役は指定統合先へ受け入れた [PR #261](https://github.com/loomake/loomake/pull/261) の同 head の全 3 OS・専用 Windows・独立レビューと gate の実出力を確認した。S2 で task 3.5 の受入を記録し、既存 S2 の 6 task と合わせて 12 済・7 未とする。task 本文・配分・全仕様・実 0/4・P6・最終受入は維持する。

運用には main へ反映済みの [採用 ADR 0006](https://github.com/loomake/loomake/blob/620550a26fc39dff92b19d1d5289ab7742b85f88/docs/adr/0006-standing-approval-for-autonomous-delivery.md) を使う。この stage の古い規約ファイルを採用版へ更新したとは扱わず、main の製品差分も取り込んでいない。
