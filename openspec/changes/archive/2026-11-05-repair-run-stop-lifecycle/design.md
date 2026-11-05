## 根拠

Issue #416（2026-11-05 全体レビュー）と、独立 Opus 設計（claude-opus-5-5、session 48d5f01c-2e0e-475c-82c9-8f61c77150e3）を使う。設計の一部を以下のとおり補正して適用する。

## 判断

- change 全体の仕様ゲートが成功してから製品を変更する。
- dry-run はタスク読み取りから表示までを try/finally で囲み、例外でも元のブランチへ戻す。通常の run の例外では切り替えたブランチを保持する。開始を拒否する既存の早期 return は保つ。
- runLocked の catch へ伝わった未分類例外だけを、マスクした理由で停止記録に書いたあと RuntimeFailure に変換する。既知の GitError・UsageError・RuntimeFailure、REQ-337 の interrupted 判定、PR 公開の既存 catch は変えない。rec.finish 自体の例外は保存失敗としてマスクし、exit 3 を保つ。
- 2 回目の信号は利用者が案 A を承認した。異種も通算し、実際に受けた 2 回目の信号の 128+番号で process.exit する。同期 JavaScript I/O の途中へ信号ハンドラーは割り込めない。強制終了は summary 完成・プロセス停止・ロック解放を保証しない。同ホストで所有 PID の消滅を確認できるロックは既存の回復処理に委ねる。
- エンジンの exit 後に通常結果を時間切れ・中断へ変えない。停止の Promise が完了してから、既存の停止猶予と同じ 250ms で stdout/stderr を destroy する。close が先なら猶予を取り消す。別セッションの子の停止は保証しない。
- 新しい試験は全 OS で有効な信号ハンドラー契約を検査し、POSIX の実信号・離脱子を使う経路も実測する。既存の試験は弱めない。

## 再現

偽 claude が別 PGID・SID の孫へ出力を継承して exit 0 した場合、200ms の期限と 250ms 後の abort は、ともに外側の 1500ms watchdog まで返らなかった。所有 PID だけを清掃した。正常終了を保つ修理後は、これらを後処理だけで timedOut/aborted へ変えない。

## R1 M-2 の説明

dry-runの復帰git switch自体が失敗すると、そのGitErrorが元の例外を置き換え、開始前のgit失敗として終了コード2になる。元のOpus設計と既存の仕様ゲートの例外経路と同じ扱いを保ち、例外の合成や終了値の変更は加えない。重複SIGHUPの規範変更と回答は、後続のcoalesce-run-hangup-signalsに置く。
