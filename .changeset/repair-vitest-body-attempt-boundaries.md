---
"@loomake/kit": minor
---
Vitest 5.0.5の試行ごとにbodyの記録を分け、timeout後に続く古いcallbackを閉じた記録や次のretryへ加算しないようにしました。

公開関数`createBodyRunner(Base)`を追加しました。利用側のrunnerファイルで標準の`TestRunner`または既存のcustom Baseを合成し、Vitestの`test.runner`へ設定してください。テスト内の`createBodyRecorder(chai)`と`body(ctx, fn)`の呼出しは保てます。

runner統合が未設定の場合、fnの1回実行と元の値・例外・非同期完了を保ちますが、新しい`loomakeBody`を作りません。旧consumerも設定移行が必要です。標準Baseは元のcallback wrapper、custom Baseは委譲した`Base.runTask`の完了・失敗とfinishedの早い方で記録を閉じます。custom Baseの後処理中は同じ元試行として扱います。詳しい導入と移行の手順は互換性ガイドに記載しました。
