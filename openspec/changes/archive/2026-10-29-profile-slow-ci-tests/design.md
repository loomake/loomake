# Design

## Context

動機はproposal.mdに記載した。調査で、期限試験には既存のfixture-ready・run-start・run-endと偽CLIのstall-startがあり、配布物操作には既存のコマンド別durationMsがあることを確認した。現在はこれらの一部が後片付けで消える。

## Goals / Non-Goals

対象は配布物シナリオの2ケースとpush・createの期限試験。全体時間の短縮やシャードの変更はこの測定結果を見て別途判断する。今回、40秒の予算を短くしたり、遅いテストを外したりはしない。

## Decisions

### 明示的に有効化する記録

`scripts/test-phase-profile.mjs` に記録と集計の名前付きexportを置く。`LOOMAKE_TEST_PHASE_PROFILE_DIR` がある場合だけ、固定のケース名・区間名・開始終了・経過時間を保存する。stdout・stderr・環境変数全体・利用者のファイル内容・コマンドの引数は保存しない。

イベントはプロセスごとのJSONLへ追記し、1ファイル1MiBを上限にする。区間の欠損、不正な時刻、上限到達は計測不足として報告する。通常テストで記録のために待ち時間を入れない。記録自体の失敗は元のテスト失敗を隠さず、計測結果側でも不足として扱う。

### 区間の定義

期限試験は開始から最初のrun直前までを準備、run開始からstall-startまでを停止前の処理、そこからrun終了までを停止待ちと停止処理とする。再実行と後片付けは独立して測る。検査のためのassertion・ファイル照合など、区間外の時間は「その他」にし、単独の区間を総時間へ二重加算しない。

配布物操作では `scripts/ai-journeys.mjs` のprepare全体を測り、既存のstep.durationMsをnpm・Git・CLIへ分類する。元のjourneys.jsonに含まれる標準出力などは保存せず、時間と固定のシナリオ識別子だけを転記する。試験側で子プロセス全体と後片付けを測り、共有の `tests/package-build.setup.ts` のbuild・packは別の共有準備として残す。コマンド分類に当てはまらない時間は推測で埋めない。

### CIの実行と保存

既存のci.ymlとは別に `.github/workflows/profile-slow-tests.yml` を追加する。このworkflow自身、計測スクリプト、計測用テスト、対象テスト、関係する文書を変えたPRで起動する。手動起動も定義する。Windows・Node24でサンプル1〜3を独立したmatrixジョブとして実行し、fail-fastはfalseにする。

固定SHAのcheckout・pnpm setup・Node setupを使い、権限はcontents:read、checkoutの資格情報保存はfalse。テストは既存Vitest設定のまま、配布物操作とpush・createの4ケースへ絞る。テスト後はキャンセルされておらず実行環境が準備できていれば、失敗時にも集計とuploadを試みる。生成とuploadを分け、元の失敗を消すcontinue-on-errorを付けない。

計測JSONはschemaVersion、runと試行、sample、checkout SHA、OS、Node、テストステップの結果、区間の一覧、不足した区間を持つ。日本語要約は32KiB以内で、表示する名前はエスケープする。artifactは `ci-phases-<run>-<attempt>-<sample>` とし、計測JSONとsummary.mdだけを7日保存する。生のJSONLや元のjourneys.jsonはuploadしない。

PR #118を土台にした別ブランチで実装する。必要ならそのブランチをbaseにPRを作り、既存の診断の変更と分ける。実際のWindows結果を3サンプル取得して、各区間の中央値と範囲を比較する。別マシンで並行実行するため、そのばらつきも観測値として扱う。

## Risks / Trade-offs

- 計測の出力自体にも時間がかかる。明示的に有効にした実行だけへ限定し、結果を通常CIの時間そのものとは言い切らない。
- 偽CLIの停止時刻は壁時計なので、時刻が逆転した区間は不正として示す。
- 共有準備と個別ケースを混ぜると原因を誤るため、共有build・packは別枠で表示する。
