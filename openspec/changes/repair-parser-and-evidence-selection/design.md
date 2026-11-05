## 設計
Opus session b9406d29-f2e9-4d79-89c1-81cc9da676e9 の設計を採用する。ただし候補名の fallback 案は利用者回答に従い採用しない。正規名だけを候補にし、承認された fixture 名と期待パスだけを移す。

閉じフェンスのみ末尾を制約する。表は空行で終える。splitLines は先頭 BOM を一つだけ除き、setTraceCells の直列化では元の BOM を戻す。Source は初出順で重複を除く。表ごとに Map で最初の ID 行を記録し、全行は保持する。

SHA は既存 evidenceProblem の 40/64 桁・大小文字可の正規表現を共用する。単独で正しい SHA は既に受理されており、修理は別の不正 field を SHA と誤診断する点に限る。JSON Schema と record は変えない。

修正前の実 CLI では台帳・回答済み質問・仮定の重複が spec-only exit 0。一方、後続の未回答質問は exit 1 であり、その回避は再現しなかった。基準 main 5c15baf0 の初回走査は 145 trace で、表内重複は 0 件。その後の main 873d47a9 の #415 archive と本 change を含む走査は 147 trace である。過去の保存 trace に新しい解析エラーがあれば report は既存の UsageError を使う。無視した名前の警告と agreement 編集の仕様変更は加えない。

## 独立レビューと Windows の fixture 修理

Opus の独立レビュー session 2143633a-0d26-484f-a0f3-c1c3fb325e08 を受け、古い 45MiB の証拠 3 件は別秒の正規名へ分け、合計 128MiB の予算を超える古い証拠を読まない元の検査経路を保つ。既存の質問 ID を一意にした案内試験は保持し、元の Q-17 重複入力の厳密な案内と解析不合格を独立の新規試験で確かめる。

Windows の CI では、生成された CRLF の質問表に LF 固定の置換が当たらず、未回答の質問を挿入しないまま進んだ。復旧 fixture の挿入は節内の区切り行を探して明示的に assert し、元の LF/CRLF で行を挿入する。改行の有無と 7/9 列を含む純粋な入力試験と、既存の実 CLI 操作試験を併用する。旧 assertion・閾値・timeout は変えない。

## 最終レビューの互換比較と artifact の作成方法

元の core parser（5c15baf0）と現 parser に、現存する 147 trace の同じ原文を渡した。各表の行数と ID 配列は全件で一致し、双方の解析エラーは 0 件。各原文の SHA と表ごとの結果は作業証跡に保存した。

この change は root を確認してから proposal・specs・design・tasks・trace を直接生成し、`openspec new change` は使っていない。そのため `.openspec.yaml` は作成時から存在せず、archive でも生成されなかった。schema は既存の `openspec/config.yaml` に従い spec-driven として解決しており、空の metadata を後付けしない。

schema の試験 fixture は読み込み後の CRLF/CR を LF にそろえてから表内へ Q/A 行を挿入する。製品のパーサー・原本 hash 用 decode・Git の autocrlf・CI 設定は変えず、LF/CRLF/CR と EOF の有無を同じ Linux 試験で確かめる。
