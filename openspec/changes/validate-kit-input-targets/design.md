# 設計：validate-kit-input-targets

## 出典と採用した整理

Issue #417 の本文を修理の出典とする。Opus の初回設計 ca5641b2、追補設計 64dc68b3（いずれも実モデル claude-opus-5-5）を読み、本体の指示に従って採用した。元の Issue が指定するバックスラッシュの POSIX 正規化、通常の入力の互換、既存リンクの終了 1、2000ms の既存定数を維持する。新しい猶予値や品質設定は作らない。

## 実装の順序

1. report の文字の形を正規化し、root 内の対象であることを config の明示値・既定値とも検査する。init の unsafeTarget は runtime の小さな共通 module に移し、外部・dangling リンクを同じ基準で拒む。削除の直前にも検査し、外部検証中の置換を捕まえる。
2. init は全置き先の種類をリンクの検査のあとに確かめる。配置判断後に最終的な report を検査してから何かを書く。上書き対象の古い不正 report を修復不能にしない。
3. gitignore の literal 行を共通化し、既定行を維持して特殊文字をエスケープする。doctor の案内も同じ値を使う。
4. spawnSync に残り時間と既存2000msの猶予を足した整数期限・SIGKILLを設定する。小数は切り上げ、長い有限期限を2^31msへ短縮しない。結果なしのETIMEDOUTは子孫を片付け、理由つきtimeoutを返し、共有予算と単独verifyの後続を止める。有効な結果があれば正常の経路を保つ。
5. change の lstat は ENOENT・ENOTDIR のみ不在とし、他の誤りは cause を持つ UsageError にする。

## 仕様との整合

watchdog の timeout 分類と既存 REQ-250 の「中断として返す」を整合させるため、250 の元の本文と Scenario を保ち、例外条件だけを MODIFIED に足す（新Source428）。後片付けと REQ-253・254・337 の後続停止は維持する。これは Issue の timeout 指定と既存の安全性を両立する必要な整合であり、新しい未決事項にはしない。

## 検証

専用tmpでroot外削除・init部分配置・ignore誤り・lstat誤分類・監視役の停止待ちを修正前に再現済み。既存3suite186件は成功した。新規REQ付き回帰は修正前REDを保存してから修理し、正常系・省略した既定値・内部安全リンク・長い期限も確認する。既存テスト・期待・skip・timeout・設定は変えない。全件doneは本体と枠を調整し、最後に同じPRへ同期/archiveを含める。
