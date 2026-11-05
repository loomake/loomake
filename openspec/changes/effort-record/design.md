# effort-record の設計

## Context

動機と範囲は proposal.md を参照する。基準 main は b2b3f824 である。実際の Opus 設計は `af787f62-4bed-4598-a940-1ee213a76ae4`（claude-opus-5-5、exit 0、ok true、対象head b2b3f824a8ec45bee4df50c5fafb6d004fff848d）。原本は `.loomake/claude/<session-id>/result.md` と manifest に保存してある。

管理役は2026-11-05に、PR1→PR2→PR3の通常L3分割、Q-01〜12の採用、下記の不整合の整理と秘密置換への依存を決定した。これは通常設計のおすすめ採用であり、新しい利用者の承認を作るものではない。全実装タスクは未着手である。

## Goals / Non-Goals

PR1 は同期の実績記録とCLIの入口までを実装する計画である。手書きの読取・集計・状況レポート接続や、実記録の運用受入をこの PR の成功へ含めない。親 #68 の残義務は trace.md に分けて残す。

## Decisions

### 独立した保存形式と入口

`runRecord` は変更せず、trace に `runEffortRecord` を置く。CLIは `--effort` の有無をquality schemaのロードより前に分岐し、通常recordでは従来の呼出を使う。runnerの `recordAndOpenPr` も変更しない。effort側はconfigとchangeの所在、git status、HEAD、記録時刻だけを使い、verifyやtrace/spec本文を取得しない。

保存は `.loomake/evidence/<change-id>/effort/`。この配下は既存gitignoreで追跡でき、reportとrunnerが直下の正規の日時名を探す処理に混ざらない。別の保存先とgitignore変更は不要である。activeを優先する `resolveChangeDir` を使い、一意なarchiveも受け付け、missing/ambiguousはUsageErrorにする。既存recordのactive限定は維持する。

最終レコードは次の排他的な形とする。必須は `schemaVersion: 1`、`kind: "loomake-effort"`、change、sha、recordedAtと、下のどちらか一方である。任意はdecisions・attempts・cost・noteで、省略値を作らない。

- 総計：`totalMinutes: number`。`minutes` とsearchは持たない。
- 区分：`minutes` にinstruct/review/rework/run/waitのうち1つ以上を持ち、searchは任意。省略した区分を0にしない。searchは既知5区分の和以下の内数である。

coreは新しい構造スキーマからEffortRecord・EffortMinutes・EffortCost等の型を導出し、定数と遅延loaderを公開する。coreの入口にzodを静的に読み込まず、取得・時計・判定を加えない。既存Evidence/Report型とJSON Schema生成対象・exports12本は変更しない。新形式の公開JSON Schemaは増やさない。

traceは同期の `effortProblem` と `serializeEffort` で保存する値を検査し、既存 `publishEvidence` を使って最終名へ原子的に公開する。整形は2字下げ・末尾改行、最終UTF-8 bytesは64KiB以下である。既存名への公開はfalseとして1を返し、保存前の不正値や保存失敗はUsageErrorとする。日時名のUTC秒とSHA先頭12文字は既存記録に合わせる。

### 公開APIと入力

新しいtrace公開APIは `runEffortRecord(options)`、`parseEffortOption(text)`、`parseCost(text)`、CLI用の `parseDuration(text)` とし、すべてnamed exportの同期関数とする。writerのoptionsはroot・changeId・effort（CLIと同じ文字列）・stdout、任意のdecisions/attempts（number）・cost（導出型の配列）・note（string）・now（Dateを返す関数）を受ける。使い方の不正はUsageErrorとし、CLIが終了コード2へ変換する。

時間は字句検査と数値検査を両方行う。hの十進値を整数で分へ変換し、小数の分を丸めて受理しない。各値の上限は100000分で、正規表現に一致しても100001mや999999mは拒否する。手書きの `分`・`時間` の読取はPR2のREQ-467で定義し、PR1で未仕様の日本語入力を追加しない。

費用は `kind:value` のカンマ区切りで、actual-usd/estimated-usdはUSD十進値から安全整数centsへ正確に変換し、tokensは安全整数countにする。USD値は数字列と任意の小数1〜2桁、tokensは数字列だけとし、符号・指数・空白を受け付けない。同じkindの反復を拒否し、別kindを合計しない。判断要求・試行も非負safe整数とする。M1/M2から回数を作らず、自己申告の費用だけでM5の取得範囲・単価出典と日付・トークン内訳を満たしたことにしない。M5の原文と手書きの詳細記録は保持する。

noteは入力も最終置換後もUnicode codepointで500文字以内とし、改行とUnicodeの制御文字を拒否する。原文の501文字を置換で短くして受理することはしない。CLIの値付きオプションの両構文と最後の値を使う規則は既存parseOptionsを使う。`--scope` の併用やeffortなしの付帯オプションは、外部操作の前に拒否する。

CLIリファレンスは `args.ts` の同じ表から `pnpm build && node scripts/generate-cli-reference.mjs` で再生成し、`--check` と既存 `tests/cli-reference.test.ts` で照合する。既存試験の期待値は変更しない。

### Opus案の不整合をどう整理したか

Q-13〜17を管理役が採用した。字句regexの桁数を数値上限と取り違えず、両方を条件にする。OpusのJSON例に同時にあったminutesとtotalMinutesは、本文の排他規則を優先し、例のtotalMinutesを採用しない。総計モードにsearchの置場を新設しない。未コミット拒否は同時操作のlockではないため、同じ出力名の衝突拒否を超える直列化やexactly-onceは保証しない。費用文法とnote文字数は、受入試験で判定できる形へ具体化した。

### NFR-09と未受入の共有置換への依存

Opus #68 の設計には秘密置換の記載がない。noteをそのまま保存してよいと解釈せず、要件定義L215のNFR-09と、#65 P1の既存Opus設計（7e9d5568-6df5-4ee8-9b3c-aaf939953f20、REQ-447）の共有APIを根拠に、管理役がQ-18のAを採用した。#68のOpusで秘密情報の扱いまでレビュー済みとは報告しない。

最終レコードにはkitの共有 `maskValue` を適用し、その後に構造・文字数・UTF-8 bytesを再検査する。入力を含み得る診断も同じ共有処理を使い、原文をmessage/cause・stdout/stderr・一時ファイルへ残さない。独自pattern、runnerからのコピー、traceからrunnerへの逆依存は作らない。任意の秘密・個人情報の検出を保証せず、入力しない案内を置く。元の申告値は入力不変で扱い、既存の古い記録を置換して書き直さない。

#65 P1はmain未受入でB01回答待ちである。共有maskValueを利用できると仮定せず、Q-19を未回答blocking依存として残す。したがって本計画の仕様ゲートは失敗のまま記録し、依存しない純関数や書式の実装にも進まない。共有実装のmain受入とAPIの一致を確認してQ-19へ根拠を記録し、仕様ゲートが成功してから着手する。

## Risks / Trade-offs

- 同時に異なる保存名を作る操作は直列化されない。未コミット検査をlockと説明せず、追記の再試行を自動で重ねない。
- C-001の作業単位は複数changeにまたがる。推定の24〜58時間と「未作成」を変えず、実績を勝手に対応付けない。
- C-002/C-003の原本の所在は利用者へ質問済みで未回答。これは親の実データ受入の未決であり、PR1の追加blockingにはしない。原本未取得をplaceholderで完了へ変換しない。
- 費用や判断要求は自己申告であり、M5の詳細や人力実測との比較を自動的に証明しない。後続の表は欠測を0で補わない。
- 秘密置換は既知の形に限る。入力しない案内と最終置換・再検査を用い、診断へ入力を複写しない。

## Migration Plan

共有置換の受入後に、core→trace→CLI→追加試験・リファレンス→changesetの順で小さく実装する。既存データの移行や削除、旧fixtureの変更は行わない。既存recordの呼出と同期性を保持し、追加機能の取り消しでも保存済みの実績は削除しない。PR1の通常DoDとCI・独立レビューを満たした後も、親#68の実記録受入とPR2/3は別に追跡する。
