# Design: verify-answer-guidance

## Context

動機と範囲はproposal.mdを参照する。採用済み478c0e52（claude-opus-5-5）の全文を出典とし、Mac側の未取得成果の回収ではなく、この環境で正式文書と新試験を再構成する。設計head6faと基点main5f1b4d73の準備入力18件は16件一致で、差はtest/project.tsの任意baseと、#296によるREQ-038の前回レポートfixture強化だけだった。対象run/format/parser/CLIの実装と関連Requirementは同一であり、これらの差を保持して設計を再利用する。

## Goals / Non-Goals

- Goals：changeごとの事実をspec-onlyのreasonへ示し、共通の操作案内を人向けformatへ示す。既存判定を使い、新しい案内でpendingや要判断を増やさない。
- Non-Goals：JSON schema・legacy1.0.0・既存blocking詳細・done判定・元assert/期待値/期限/設定の変更、C001全体の受入、旧Mac10件の再現扱い、#282の製品実装。

## Decisions

関連列から完全一致するREQ IDを取り出し、traceの表の順でQ IDを重複なく並べる。部分一致はREQ-0270などを誤対応するため使わない。回答済みは既存と同じく空でない回答で判定し、回答者/日付のない古いtraceも保持する。

項目1〜3はspec-onlyだけでreasonへ出し、doneの既存出力を保つ。項目4〜5はformatV2だけで詳細の後に一行を足し、検査のreasonやJSONへ入れない。共通案内をreasonへ足す案は旧toEqualを変えてしまうため採らない。1.0.0の表示は保持する。

参照を探す範囲は自changeの差分仕様のコードブロック外で、回答済みのQ IDとの完全一致だけとする。coreのsplitLines/fenceMaskを公開exportして再利用し、コードブロックを新しい独自規則で解析しない。古いmainのREQ-036/038をMODIFIEDにする案は未同期C001の所有と衝突するため採らず、verifyに2 ADDEDを置く。

### 採用設計の全ACと確認方法

- 「回答済み」は、既存の判定 `!q.answer` の反対です。parser がセルを trim するので、空でない値なら回答済みです。
- 確認事項の ID は、trace の `ID` と完全一致で比べます。
- 新しい検査は **spec-only でだけ**記録します。既存の `確認待ちの要件` も spec-only だけです（`run.ts:252`）。

| AC | 実装（`packages/kit/src/verify/run.ts` の `checkSpec`） | 試験（`packages/kit/test/verify.test.ts` に新しい describe） |
|---|---|---|
| AC285-1 [REQ-360] | L252 の詳細を `REQ-027（Q-15）, REQ-029（Q-15・Q-17）, REQ-002` の形にします。<br>・関連列から `/(?<![A-Za-z0-9])REQ-\d{3,}/g` で ID を取り出し、完全一致で照合します（貪欲な一致なので REQ-0270 は REQ-027 になりません）。<br>・Q は表の順に並べ、重複を除きます。<br>・関連が無いときは表示を今と同じにします。 | ・1 件の対応<br>・複数・重複・区切り（`, `・`・`）<br>・境界（`REQ-0270`、`XREQ-027` は対応しない）<br>・関連なしでは `REQ-002` のまま<br>・decision が `{required:false}`、local の pending が 0、終了コード 0<br>・`formatVerifyResult` に `! 確認待ちの要件\n    REQ-027（Q-15）` が含まれる |
| AC285-2 [REQ-360] | L252 の直後に、新しい検査 `回答済みの確認事項の反映` を warn で追加します。詳細は 1 つの Q ごとに 1 行で、`Q-15（回答済み）：REQ-029 が確認待ちです` の形です。条件が成り立つときだけ記録します。 | ・回答済みで、関連の要件が確認待ち（ブロッキングが yes でも no でも）→ warn、終了コード 0<br>・未回答なら記録しない<br>・関連の要件が反映済なら記録しない<br>・done では記録せず、既存の done の期待値（`verify.test.ts:478-494`）が変わらない |
| AC285-3 [REQ-360] | 差分仕様を読むループ（L258-263）で同じ本文を使い、コードブロックの外の行から `/(?<![A-Za-z0-9-])Q-\d+(?!\d)/g` を探します。自分の trace で回答済みの ID と完全一致したものだけを、`回答済みの確認事項の参照` として warn で記録します。詳細は `specs/x/spec.md:5 Q-15` の形で、ファイル・行の順に並べます。<br>・`fenceMask`・`splitLines` は core にありますが、index から export されていません。`packages/core/src/index.ts` から export して再利用します（Q-285-03）。 | ・回答済みの参照 → warn、終了コード 0<br>・未回答の Q、trace に無い Q-19、コードブロックの中、`Q-150`・`AQ-15` は記録しない<br>・1 つのファイル内の複数の参照は行の順<br>・done では記録しない |
| AC285-4 [REQ-361] | `packages/kit/src/verify/format.ts` の `formatV2` で、`id==='ブロッキング確認事項' && result==='FAIL'` のとき、詳細の後に字下げした 1 行を足します。<br>`回答の書き方：change <change> の trace.md「確認事項」の表で、該当する行の「回答」に回答を決めた人が書きます（loomake trace answer --change <change> --question <Q-ID> --answer <回答> --by <回答者>）`<br>・検査 ID は、`NOTICE` と同じように重複して定義し、「run.ts と同じ」とコメントします。<br>・1.0.0 の結果の表示は変えません。 | ・`check()` の詳細が今と同じ `toEqual` のまま通る<br>・人向けの表示にこの行が詳細の直後に出る<br>・最後の行は今と同じ verdict<br>・`JSON.stringify(r)` に `回答の書き方` が含まれない<br>・ブロッキングが無いときは出ない |
| AC285-5 [REQ-361] | 同じ場所で、`id==='仮定の承認'` のとき（spec-only では PASS の案内、done では不足）に足します。<br>`承認の書き方：trace.md「仮定」の表の該当する行の「承認」に「承認」と書きます（loomake trace approve --change <change> --assumption <A-ID> --by <承認者>）`<br>・空でない値を承認とみなす今の扱い（承認の方針）は変えず、REQ-203 が書く語を例として示すだけです。 | ・spec-only の `!`、done の `?` の両方でこの行が出る<br>・終了コードは 0 と 1 のまま<br>・decision の reasons が変わらない<br>・未承認が無いときは出ない |
| AC285-6（維持） | — | 既存の試験には手を入れません。CLI（`packages/cli/test/verify-v2-cli.test.ts`）に、`--json` の stdout が単独の JSON として解析でき、案内の文を含まないことを確かめる試験を 1 本足します（[REQ-361]）。 |


## Risks / Trade-offs

- [例として回答済みQを書いた場合も案内され得る] → 自changeの回答済みIDとコードブロック外に限定し、file:行を示して人が見直せるようにする。
- [doneでは回答後のspec参照を案内しない] → 既存doneの判定/詳細を保持する採用範囲とし、別の振る舞いへ拡張しない。
- [過去の試行値が未取得] → 未測定と明記し、Macでの停止や未収集をこの環境のREDへ読み替えない。

## Migration Plan

正式文書・strict/specgate→新ID試験の意味あるRED→採用案の最小実装→旧試験保持とGREEN→試行集計/changeset/worklog→正常local done→管理役の独立確認/新Opus/正常CIと3OSの順に進める。最終マージは別に利用者へ確認する。追加の実装前人確認は設けず、仕様外の解釈が必要になれば管理役へ返す。試行1/7（版1）の集計は記録だけで、工程・ゲートを新設しない。

## Open Questions

設計のQ-285-01〜06は採用されたおすすめで回答済みとしてtraceへ記録する。実装の未回答判断はない。最終マージ確認は後続の試行確認点であり、未回答の仕様ゲート質問として実装を止める扱いにはしない。
