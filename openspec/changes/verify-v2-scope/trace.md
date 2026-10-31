# Trace: verify-v2-scope

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 親change `openspec/changes/verify-v2-c001/` | main 488edda2 | 2026-10-31 |
| 子change `verify-v2-wiring`（2b-1/6）・`verify-v2-evidence`（2b-2/6）・`verify-v2-strict`（2c/6） | main 488edda2 | 2026-10-31 |
| `.loomake/handoff/design-step8b-c001-acceptance-2026-10-31.md`（2章の4/6、4章の草案）、`design-step8-c001-split-2026-10-31.md`（PR3の段落） | main b29df8c2 基準 | 2026-10-31 |
| 管理役の決定（4/6の範囲：REQ-312・135・194・041・323・050） | 2026-10-31 | 2026-10-31 |
| docs/requirements/loomake-v0.11.md 7.3 | v0.11.3 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-312 | 親 trace、要件7.3・FR-12、現行REQ-042 | 機能 | scope省略時はdoneがci、spec-onlyがlocal。bare verifyは品質専用のlocalで、明示ciは使い方の誤り。環境変数CIでは既定値を変えない | 反映済 | specs/verify/spec.md |
| REQ-135 | 親 trace、現行cli「ヘルプと版」 | 既存変更 | verifyとtrace recordのhelpに `--scope local\|ci`、受理値、既定値を足す。helpでは検査せず終了コード0 | 反映済 | specs/cli/spec.md |
| REQ-194 | 現行cli「値をとるオプションの書き方」 | 既存変更 | `--scope` も空白区切りと等号区切りを受け付ける。空値と不正値は使い方の誤り（2） | 反映済 | specs/cli/spec.md |
| REQ-041 | 現行cli「オプションの書き方と知らないコマンド」 | 既存変更 | 値を取るオプションの例に `--scope` を足す。IDは現行verifyの「終了コード」と同じ（現行どおり） | 反映済 | specs/cli/spec.md |
| REQ-323 | 親 trace、現行reference-docs | 既存変更 | 未確定の契約を追加しないMUSTをCLI生成単独の範囲に限り、改版後の共通定義に従って生成する | 反映済 | specs/reference-docs/spec.md |
| REQ-050 | 親 trace、現行verify「性能」 | 既存変更 | `--done --scope local --skip-commands` の3秒条件（500要件・1,000ファイル）と、skipは不足1になること、処理量の保持 | 反映済 | specs/verify/spec.md |

REQ-312・050・323は親のdelta specsの本文をそのまま移した。REQ-312にはchangeなしの明示ciを拒否する一文とScenarioを足した（設計メモ4章の草案による）。REQ-135・194・041は親にdeltaがなかったので、`docs/c001-approved-decisions` の下書きの文を今のmainの本文に合わせて作った。cli仕様の「オプションの書き方と知らないコマンド」とverify仕様の「終了コード」は、どちらもSource: REQ-041を持つ。現行どおりで、この変更では新しいIDを作らない。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-01〜10 | 親の全Requirement | 親traceのR-C001-01〜10 | 親traceのとおり | 親traceのとおり | no | 親traceに記録済み（R05・06・07 A、R08 B、ほかA） | 親traceのとおり | 2026-10-30 |
| R-C001-05 | REQ-036〜041・050・055・073・093・100・114・115・135・164・183・191・203・274〜276・302〜306・307・315・322〜325 | 既存互換差分に加え、323/324の未確定契約追加禁止・help/usage/終了コード/8 JSON不変MUSTの範囲変更、100のlocal化、306の接続範囲を受け入れるか | A: 既存のv2形式・183/322範囲・未承認done1・040/050/191・CLI基準の非互換案を保持し、REQ-093のspec-only abortedをusage/config 2・その他3（不合格1のまま）へ分け、REQ-135のhelpへ --scopeのlocal/ciと既定値を追加し、323/324のMUSTを生成/集約単独へ限定、100を明示local、306を集約定義単独に限定 / B: これらの範囲と互換移行を再設計 | A。別の改版を永久に禁じない範囲へ限定する。未承認仮定done1、skip coverage省略/1、性能条件保持、CLI基準・help更新の方針を含むが、具体的assertion/旧46例の変更承認は別に取得する | yes | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6511434324) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| R-C001-06 | REQ-100・136・311・312・315・319、AGENTS DoD | done既定ciに対してローカルDoDをどう満たすか | A: ローカルは --done --scope local の0、最終受入は --done --scope ci の0と必須CIを要求するようREADME・CONTRIBUTING・delivery Skillを含む規約/guideを移行し、REQ-136を明示localへMODIFIEDして両req-to-openspec雛形を同期。kit-assets期待値変更は具体差分の個別承認後に行う / B: ローカルでもci証拠を取得し既定done 0を要求し、REQ-136本文と雛形の既定ciコマンドを保持 | A。ローカル完了と最終合格を区別し、CI証拠不足でローカル作業が恒久停止しない。AGENTS・配布規約・PRテンプレートも同時に修正する | yes | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6511434324) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| S8-05 | 全Requirement | 書く側のPRをどう分けるか | 親traceと `verify-v2-wiring` のtraceのとおり | A | no | A（2b-1・2b-2・2c・3/6〜6/6）。生成物は大きさから除く | 管理役（Claude Fable 5.1） | 2026-10-31 |

基準の具体差分（27例）は、R-C001-05 Aの方針の承認を根拠にしているが、具体差分そのものは利用者の個別承認が要る。承認は PR 本文で求める。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
