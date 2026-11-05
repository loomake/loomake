# Design

## Context

設計の出典は [Issue #415](https://github.com/loomake/loomake/issues/415) の「直し方」であり、implementation-queue の既存設計を再利用する。モデルとセッションの識別情報は Issue にないため、確認済みとは記録しない。

平文の正規表現とストリームの末尾判定は PRIVATE KEY だけを認識し、PGP PRIVATE KEY BLOCK を通す。平文は END のない入力も通す。REQ-199 の既存 3 Scenario を保ち、今回の直接依頼の振る舞いを明記する。

## Goals / Non-Goals

**Goals:** PGP と END 行のない秘密鍵を両経路で隠す。PUBLIC KEY を保持し、既存の 4096 文字のヘッダ保留上限と状態遷移を保つ。

**Non-Goals:** 認証形式全般の追加、実際の鍵の利用、記録形式と公開 API の変更。

## Decisions

- Issue の既存設計に従い、平文では対のブロックを先に処理し、残った BEGIN から入力末尾までを次に処理する。対の正規表現だけを広げる案では END なしの漏れが残る。
- ストリームでは見出しと終端の末尾を PRIVATE KEY と PRIVATE KEY BLOCK の両方に合わせる。保留する末尾は長い方の固定長だけにし、秘密鍵本文を蓄積しない。
- 同じダミー入力を平文・直接の秘密鍵フィルター・診断ストリームに通し、分割位置ごとの結果を比較する。JSON の値と切断された値も確認する。

## Risks / Trade-offs

END のない秘密鍵の後ろにある文も隠れる → 入力の終わりまで秘密鍵として扱うという Issue の指定を優先する。PGP 公開鍵の過剰な伏せ字 → 非秘匿の回帰テストを残す。

## Migration Plan

既存の呼び出し側と記録形式を保持する。runner の patch changeset を追加し、仕様同期・archive は同じ PR に含める。
