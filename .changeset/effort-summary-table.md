---
"@loomake/core": minor
"@loomake/kit": minor
"@loomake/trace": minor
---

手書きの効率記録（docs/effort）と実績記録（Effort 1）を読み、推定との差を 9 列の表にまとめる同期 API を追加する。core に readTable と TableRow.size、kit に createByteInputReader、trace に readEffortInputs・parseManualEffort・buildEfficiencyTable・formatEfficiencySection を足す。既存の API と出力は変えず、CLI も足さない。0.x の未公開プレビューでの追加である。
