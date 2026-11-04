# Design

## Context

基準 main は `782d068b06c1e739872242337c61355d99344c21`。normal Opus 設計原本は `.loomake/claude/2fca513f-e2b7-4f8a-8cd9-509e0b3d5dc0/result.md`、監査は `.loomake/size-batch-design/design-read-audit.json`。これは機能改善の設計であり、難しいバグの独立調査ではない。

## Decisions

Q1=A で REQ-418 を ADDED、376/377 は不変。Q2=B で object 同一性ではなく既定4値を比較し、既存 `Object.entries(limits)` の検証値を再利用して getter 再読取りを増やさない。Q6=A で全行の mode/blob/OID/path/prefix/深さを純粋に判定し、不適格・空・単一・非既定予算なら例外を先に投げず旧ループへ進む。

適格な場合だけ OID を重複排除せず改行区切りで `cat-file --batch-check=%(objectname) %(objecttype) %(objectsize)` へ送る。stdin は pipe、stdout/stderr は既存16MiB上限とし、既存呼出しの options を変えない。Q3=A で行数・最後の改行・OID順・blob型・安全な非負整数 size を照合する。batch だけ raw Buffer を fatal UTF-8 decode し、不正UTF-8/valid非ASCII・missing・全形式不一致は全応答を捨て旧ループへ戻す。旧metadata/body decoderは不変。

Q4=A で ENOBUFS は既存メタデータ上限エラー。Q5=B は通常完了の数値 status 非0かつ signal なしに限定し fallback する。signal/timeout/中断/ENOENT等起動失敗は即伝播し後続操作を始めない。Opus Q5A の「旧-sも必ず失敗する」は batch 固有の未対応optionに成り立たないため不採用。採否は管理役の技術判断で、利用者本人の回答とはしない。

取得sizeは既存ループの照会だけを置換し、予算→個別blob→長さ照合→合計加算→decodeの順を保つ。先行合算は加えない。固定SHA・literal path・置換抑止・no checkout・全bytes/mode/oid・UTF-8/BOM・件数/深さ/予算、公開API/JSON/adoptionsVerifiedを保持し、Rawや未承認414へ広げない。

## Verification and independent review

同一L3内の2.1で現376のbaseline PASS、2.2で418専用RED、2.3でsource GREENを確認する。新規 `tests/trusted-git-object-sizes.test.ts` のローカルfixtureとpassthrough spyを共有し、baseline結果の期待を保持してbatch assertを追加する。全詳細は `.loomake/size-batch-design/baseline-task.md`。baselineだけでは現在のCI timeoutを直せないため、別PR/main受入を前提にしない。

| REQ-418 Scenario | 同じPRで直接確かめること |
|---|---|
| 1 複数文書 | 同じ4値の別object、mode100644/100755・入れ子・BOM・空・重複blobの実Gitと旧custom経路の全結果同値。入力OID順/重複保持/pipe/16MiB、-sがN回からbatch1回へ減る。原14文書/17起動とsnapshot照合 |
| 2 拒否順 | 先頭invalid UTF-8＋後方symlink/深さ33/2MiB、先頭2MiB＋後方正常、後方unsafe/prefix外のspy。1MiB×16＋末尾z empty/1Bで既定合計16MiB成功/+1失敗、超過blob未読・重複加算を実Git+spyで確認 |
| 3 fallback | 行欠落/余分/改行欠落/入替/OID不一致/型違い/負数/先頭0/unsafe整数/不正UTF8/valid非ASCIIで旧-s→blob列と同じ結果。実loose object欠落は先行blob後の旧エラー、通常数値非0のbatch固有失敗はfallback成功 |
| 4 停止 | batch maxBuffer=1でnative ENOBUFSと既存文言。signal/timeout/ENOENTのspyは元例外と同一、-s/blobなし |
| 5 旧経路 | 単一/tiny/custom/Number.MAX_SAFE_INTEGERの正整数予算・不適格行でbatchなし。既存native ENOBUFS3経路/tiny exact順を含む15試験、原文関連17例・2commitを無変更で再確認 |

新規実Git試験だけ作成時点で60秒を宣言する。既存5秒/expect/skip/fixture/設定は変えない。独立レビューは全5Scenarioと376/377、純粋判定・旧拒否順・getter再読取り・重複加算・16MiB等値/+1・全fallback/停止分類・本文未読を確認する。全差分を非起草自己レビューと別Opusへ渡す。

## Risks / Migration

異常応答時は1起動余分になる。正常14文書は1読取30→17、2読取60→34、#398fixture込67→41の静的見込みだけを示す。旧71→45は過去値であり、平均時間・Windows再発解消を保証しない。自前batchのC001原文入力2失敗は対象外。

全量は新規test170–200行（共有setup/fixture50–55、baseline結果/拒否順55–65、batch直接assert/異常/停止65–80）、source45–60行、本6文書139行、同期25行、changeset5行、日誌6行で390–435行、作業用目安405行。管理役が2026-11-04に採用した。300行は目安であり、fixture修理#399とsize取得は領域で分割済み、baselineだけの別PRは同じ契約の試験分離とCI待ちの循環を生むため、418は同じPRで扱う。全assert/Scenarioを保持し、圧縮や未使用helperで数字を合わせない。ls-tree -l案は方式変更の追加検討が必要で、今回の契約を分ける根拠としては未採用。

計画1.1のcommit後、#399受入後のmainを一度取り込み、同じ正式仕様ゲートの終了0を確認してから、小さいcommitでPASS→RED→GREENを保存する。local done・必須5チェック・3OS・独立重大0/軽微追跡を満たす。同期/archive・changeset・日別worklogも同PRに含め、archive後verifyと最終headを確認する。問題時も通常工程で修正し、期限や品質設定を緩めない。
