# Design

## Context

動機はproposal.mdを参照する。基準main`684abf0`のargs.tsはparseOptionsと候補計算を持ち、コマンド定義はmain.tsにある。現在は5トップレベル、traceの4操作を含む8末端である。表示・受理・業務側の条件を一律の引数ライブラリへ置き換えると、診断の順序やhelpの優先が変わるため、定義の共用に範囲を絞る。

quality先行changeはreference-docsを新設し、4.quality-yaml.md・guide入口・docs/dev/reference-generation.mdを整備した。CLIページは5.cli.mdとする。PR #142とarchive PR #143を受入済みのmain `8d2d7ce`で主仕様のPurpose・REQ-320〜322を確認し、実装開始の依存を解消した。

## Goals / Non-Goals

共通記述から受理名・help・リファレンスを導出し、REQ-323〜325を満たす。定義の必須性・既定値の注記は現在の実装と照合し、新しい検証器へ転用しない。

新コマンド・alias・CLIオプション・v2出力、C-001の決定、quality定義や生成器の改修、製品の公開API追加は対象外。生成は開発用の操作であり、loomake CLIへgenerateコマンドを足さない。サイトの公開・リリースも行わない。

## Decisions

### 1. args.tsの静的な共通記述

args.tsにnamed exportのコマンド記述を置く。コマンド名・操作名、全体help用の短い説明、個別helpの説明、現行usage、オプション名・値/flag・表示ラベル・説明・必須性・条件・既定値を持つ。各末端のOptionSpecと候補、COMMANDS、help一覧はこの記述から導出する。共有の--changeでも用途の説明は操作ごとに残す。doctorは空の定義を明示する。

usageは現行文字列を維持し、独自の構文木から推測して組み直さない。helpの既存width計算と空白・改行、trace全体の連結を保つ。解析用のvalue/flag順とhelp用の表示順を別々に記録する。trace answerはparserで--change、--question、--by、--date、--answerの順だが、helpでは--answerが--byより前に来る。runはusageの--engine claude-codeとhelp欄の--engine <名前>を別の表示として保持する。候補が同距離なら先にあるものを採る現行規則も保つ。

共有記述のlookupは配列のfindまたはown-property確認を使い、constructor/toStringを操作として拾わない。mainの業務dispatchは現行の分岐を残せる。コマンド名の配列だけを別途手書きして二重管理しない。汎用CLIライブラリや実行時依存を追加する案は、現行構文・診断の維持に余分な変換が要るため採らない。

### 2. 現在の条件と既定値の出典

必須性・省略時の意味は下表の現在の挙動を記述する。注記はパーサの新しいvalidationへ渡さず、handlerの検査・既定値適用とID付き試験で対応を確認する。特にrunAgreementのby/answerのtrimや、日付・changeの検査順序をmainへ移さない。

| 対象 | 記述する現在の条件・既定値 | 出典 |
|---|---|---|
| init | --codex・--devcontainerはflag、省略false | main.ts init |
| verify | --changeは任意。指定時は--spec-onlyか--doneの片方必須。ゲートを指定するとchange必須。--json・--skip-commandsはflag、省略false | main.ts verify |
| trace record | --change必須 | main.ts trace |
| trace report | --change必須、--formatはmd/json、省略md。htmlの既存専用診断も保持 | main.ts trace |
| trace answer | --change・--question・--answer・--by必須、--date任意。date省略は実行環境のローカル日付 | main.ts agreement、trace/src/agreement.ts |
| trace approve | --change・--assumption・--by必須、--dateはanswerと同じ | 同上 |
| run | --change必須、--engineはclaude-codeだけ、省略claude-code。--dry-run・--skip-permissions省略false、後者はLOOMAKE_SANDBOX=1が必要 | main.ts run、runner/src/run/prepare.ts・engine.ts |
| doctor | 固有オプションなし | main.ts doctor |
| 共通 | -h/--helpは業務処理前に表示。-v/--versionは先頭でのみ版を表示。全コマンドの固有引数にversionを加えない | main.ts main |

値付きオプションの空白/等号、等号なら--始まりの値も渡せること、空値拒否、反復は最後の値、flagの反復、flagへの等号拒否、未知の位置引数、helpの先行検出を変えない。今回の記述整理を理由に未規定の入力正規化や短縮形を追加しない。

### 3. CLI専用の生成とcheck

専用スクリプトはscripts/generate-cli-reference.mjs、生成先はdocs/guide/3.reference/5.cli.mdとする。通常実行は対象ページだけを書き、--checkは読み取り専用で一致を判定する。パスはスクリプトの位置から解決する。製品のexportsやfilesへ生成器を追加しない。

開発用CLIはpnpm buildの後にpackages/cli/dist/args.jsの共通記述を読む。ソースの正規表現解析や、help文字列からの必須性の推測はしない。rendererとcheckは定義・ファイル操作を渡せるnamed exportに分け、importだけでビルドや生成を実行しない。ビルド不足は日本語で失敗させ、README相当の開発手順へビルド・生成・checkの順を記す。

CIの一致試験はVitestがargs.tsの記述を直接importして再生成する。これにより古いdistが残っていても古い生成物を正しいものとして通さず、単体試験だけを実行するときにビルドを重ねない。開発用の実行入口は、build済みの配布試験経路でも生成/checkの接続を確認する。

ページは固定のtitle/description、生成元と再生成方法、コマンド/操作ごとのusage・説明・オプション表・共通構文を持つ。必須値の既定値は「なし」、flagはfalse、日付は動的なローカル日付とし、生成当日の日付を埋めない。順序は定義の明示順、出力はUTF-8・LF・末尾改行1つ、時刻・絶対パスを含めない。checkではCRLFだけをLFへ正規化し、それ以外の差分を検出する。欠落・不一致・読取/生成失敗は非0、日本語の対象と再生成手順を返し、修復しない。

縦棒・バッククォート・改行・HTML記号を文字として表示する。quality専用生成器や共有helperを同時に編集しない。必要な小さい表示処理はCLI側へ閉じ、共通化は別の必要が生じた段階で判断する。

起動判定では`process.argv[1]`と`import.meta.url`のファイルパスをNode標準のrealpathで正規化して比較する。単なるresolveとURL文字列の比較では、親ディレクトリのsymlinkやWindows junctionを含むパスから起動したときに、生成器本体を通らず0で終わるためである。直接実行と判定した後にだけ既存の引数検査と生成/checkを呼ぶ。argvがない場合や別のentryからのimportでは呼ばず、パスの比較に失敗してもimportを直接実行扱いにしない。新しい共有helperや実行時依存は追加しない。

有効な定義と書出し先での生成は0、一致するcheckは0、欠落・不一致のcheckは1、不明引数や未対応の引数の組合せは2を返す。実パス・親ディレクトリのsymlink・Windows junctionのどの経路でも同じ判定と診断を返し、checkと不正引数では生成物を作成・上書きしない。importだけでは標準出力・標準エラー・ファイルへの副作用を起こさない。

### 4. ID付き回帰とCI

REQ-323は全8末端・trace親・共通操作とオプション一覧、必須/任意・条件・既定値を明示的な期待値で確認する。実装から期待値を同じ計算で作らず、下位handlerの既存試験と突き合わせる。REQ-324は変更前に基準mainのhelp/usage全文のfixtureを固定し、全体・各末端・trace親・未知操作のhelpと診断を照合する。既存REQ-041/135/194/195/202/203の試験の期待値は変えない。

新しいCLI試験で値/flag・未知/空値・反復・同距離候補の順序、verifyの組合せ、formatのmd/json/html/不正値、answer/approveの不足値と診断優先、runの既定engineと環境条件を確認する。副作用のある業務処理はspyか既存fixtureで分離し、helpが業務処理を呼ばないことも確認する。zod遅延起動と既存のCLI入口試験を維持する。

REQ-325はtests/cli-reference.test.tsで実定義と保存ページの一致、再生成の決定性、LF/CRLF、特殊文字、欠落・改変・read/render失敗を確認する。失敗時の非変更は一時ディレクトリで確認し、実ページを試験のために壊さない。pnpm testから既存のCIとdoneへ載せ、新しいCIジョブ・設定の緩和・skipは追加しない。docsだけの変更でも既存gateの品質コマンドが一致検査を実行する。

タスク2.4の回帰は生成器の実プロセスを使い、専有一時ディレクトリの実パスと別名経由で、生成0・一致check0・欠落/改変check1・不明/未対応引数2・importだけの無副作用を確認する。POSIXではディレクトリsymlink、Windowsではjunctionを作り、各OSで同じ期待値を検査する。既存のビルド不足やcwd非依存の試験を残し、既存期待値・期限・skip・設定を緩めない。今回のLinux再現だけでmacOSやWindowsの成功を扱わず、修正後のOS別CI結果を受入根拠にする。

PR #144は実装headの独立レビュー1回と最終headのbotレビュー1回で、AIレビュー2回を消化している。追加のAIコードレビューは依頼しない。修正後のhead、回帰結果、完了ゲートとCIの結果を揃え、M144-01の人の最終判断へ回す。旧headの合格やAIレビューを人の承認として扱わない。

### 5. 依存、導線、changeset

quality生成のPR受入・完了ゲート・全tasks完了と、reference-docsのarchive/主仕様反映を確認するまで実装に進まない。その後に最新mainを取り込み、品質側のPurpose・REQ-320〜322とページを保持したままREQ-323〜325を追加する。guide/index.mdとdocs/dev/reference-generation.mdは、その受入後にだけCLI分を追記する。

CLIの配布コードargs.ts/main.tsが変わるため、loomakeをpatchにするchangesetを作る。文書だけの空changesetにせず、既存引数・help・診断を維持して生成元を共用したことを記す。CLIの新動作を追加した説明にしない。core・kit・trace・runnerの版や公開APIは変更しない。

## Risks / Trade-offs

- 静的な必須/既定注記がhandlerからずれる → 受理名は直接共用し、意味の注記は明示期待値と下位処理の回帰で照合する。汎用必須チェックへ移さない。
- 表示順への集約で候補の優先が変わる → 解析順・help順・usage表示を別に保持し、変更前fixtureと同距離候補を確認する。
- 手元のdistが古くなる → 生成の前にbuildする手順を明記し、CIはソース定義との一致を直接調べる。
- 先行qualityと同じ仕様/文書を編集する → 実装を依存受入後に限定し、同時編集をしない。PurposeとREQ-320〜322を変更しない。

## Migration Plan

計画はcommit `9db6f64`で完了した。依存受入と仕様ゲートを再確認してから、既存delivery指示によるapplyで進める。共通記述と互換回帰、ページ生成/check、導線・開発手順・changeset、全体ゲートと独立レビューの順に小さくコミットする。問題があれば実装を差し戻し、旧help fixtureや既存試験を弱めて合わせない。Issue #104はqualityとCLIの両方を受け入れてから完了判断する。

旧head `6b8a390`の合格後に入口の不具合が判明したため、タスク2.4を追加し3.1を未完了へ戻した。既存delivery依頼の通常修正として計画と仕様ゲートを整えた後、別のapply作業でCLI側だけを修正する。main側のquality生成器の修正は別change `fix-reference-entrypoint-paths`へ任せ、同時編集しない。M144-01の対象headと依頼内容の更新、push・PR更新・マージは管理役が扱う。
