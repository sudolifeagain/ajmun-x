---
marp: true
theme: default
paginate: true
backgroundColor: #f8f9fa
color: #333333
style: |
  section {
    font-family: 'Noto Sans JP', 'Segoe UI', sans-serif;
  }
  h1, h2, h3 {
    color: #2563eb;
  }
  strong {
    color: #dc2626;
  }
  code {
    background-color: #e9ecef;
    color: #1a1a2e;
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }
  pre {
    background-color: #f1f3f4;
    border: 1px solid #dee2e6;
    border-radius: 8px;
  }
  a {
    color: #2563eb;
  }
  section.title {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  }
  section.title h1 {
    font-size: 2.5em;
    color: #1e40af;
  }
  .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2em;
  }
  .highlight-box {
    background-color: #e0f2fe;
    border-left: 4px solid #2563eb;
    border-radius: 8px;
    padding: 1em;
    margin: 0.5em 0;
  }
  .step-number {
    display: inline-block;
    background: linear-gradient(135deg, #2563eb, #7c3aed);
    color: #ffffff;
    width: 2em;
    height: 2em;
    line-height: 2em;
    border-radius: 50%;
    text-align: center;
    font-weight: bold;
    margin-right: 0.5em;
  }
  table {
    border-collapse: collapse;
  }
  th {
    background-color: #2563eb;
    color: white;
  }
  td, th {
    border: 1px solid #dee2e6;
    padding: 0.5em 1em;
  }
  blockquote {
    border-left: 4px solid #6b7280;
    background-color: #f3f4f6;
    padding: 0.5em 1em;
    margin: 0.5em 0;
  }
---

<!-- _class: title -->

# 入退場管理システム
## 第37回 模擬国連会議全日本大会

Discord認証 × QRコードによる受付システム

---

# 目次

1. **導入の背景** — 従来の課題と解決策
2. **参加者向け** — QRコード取得と受付の流れ
3. **スタッフ向け** — スキャナーとDiscordコマンド
4. **FAQ**

---

# 従来の受付の課題

<div class="two-column">

<div>

### 混雑
- 6会議の受付が一箇所に集中
- 参加者が廊下まで溢れる

### 時間
- スプレッドシートに手動記録
- 一人ずつ名前を確認して入力

</div>

<div>

### 担当者の固定
- 会議フロントが受付を兼任
- 担当者不在時の対応が困難

### 状況把握
- リアルタイムでの出席確認ができない

</div>

</div>

---

# 新システムによる解決

<div class="highlight-box">

### 受付時間の短縮
QRコードスキャンで即座に完了。手入力不要。

</div>

<div class="highlight-box">

### 担当者の分散
スマホがあれば誰でも受付可能。特定担当者への依存を解消。

</div>

<div class="highlight-box">

### リアルタイム確認
Discordコマンドで出席状況を即時確認。

</div>

---

# システム構成

```kroki-mermaid
flowchart TB
    subgraph Discord
        D[普段使っているアカウント]
    end
    
    subgraph System[受付システム]
        QR[QRコード発行]
        Scan[スキャン]
        Log[出席データ自動記録]
        QR --> Scan --> Log
    end
    
    D -->|ログイン| QR
```

新規アカウント作成は不要。既存のDiscordアカウントを使用。

---

<!-- _class: title -->

# 参加者向け

---

# 事前準備 (1) システムにアクセス

<div class="step-number">1</div> **受付システムのURLを開く**

URLは後日Discordで案内する。

---

# 事前準備 (2) Discordでログイン

<div class="step-number">2</div> **「Discordでログイン」をクリック**

<div class="highlight-box">

### PCの場合
Discordアプリが自動起動し、ワンクリックで認証完了。パスワード入力不要。

</div>

<div class="highlight-box">

### スマホの場合
Discordアプリが開く。事前にアプリでログインしておくとスムーズ。

</div>

---

# 事前準備 (3) QRコードを取得

<div class="step-number">3</div> **表示されたQRコードを保存**

- 各自専用のQRコードが発行される
- スクリーンショットで保存可能
- 画面の明るさを上げておくとスキャンしやすい

---

# 当日の受付

<div class="step-number">1</div> 会場に到着

<div class="step-number">2</div> スマホでQRコードを表示（保存した画像でも可）

<div class="step-number">3</div> 受付スタッフにQRコードを提示

<div class="step-number">4</div> スキャン完了

**所要時間: 約3秒**

---

<!-- _class: title -->

# スタッフ向け

---

# スキャナーの使い方

<div class="step-number">1</div> **スタッフ用ページにアクセス**

専用URL（Cloudflare Accessで保護）

<div class="step-number">2</div> **カメラを許可**

ブラウザのカメラアクセス許可をON

<div class="step-number">3</div> **QRコードをスキャン**

参加者のスマホ画面にカメラを向ける

---

# スキャン結果の見方

スキャン後、スタッフ側の画面にユーザー情報がオーバーレイ表示される。

| ステータス | 表示内容 |
|-----------|---------|
| **成功** | ユーザー名、アバター、属性バッジ、所属サーバー |
| **重複** | 同上 + 「既に出席済みです」メッセージ |
| **エラー** | エラーメッセージのみ |

<div class="highlight-box">

### 操作
- 3秒後に自動で待機状態に戻る
- ダブルタップで即時リセット
- 振動フィードバックはAndroidのみ対応（iOSは非対応）

</div>

---

# Discordコマンド

出席状況をDiscordから確認可能。

```
/attendance status
```
→ 出席済み / 未出席の人数

```
/attendance present
```
→ 出席済み一覧

```
/attendance absent
```
→ 未出席一覧

---

# コマンド実行例

```
出席状況 (2025-12-27)

出席: 45名
未出席: 55名
━━━━━━━━━━━━━━━━━━
合計: 100名
```

---

# FAQ

### QRコードを削除してしまった
再度システムにログインすれば同じQRコードが表示される。

### ネットがつながらない場所では？
事前にスクリーンショットを保存しておけば、オフラインでも表示可能。

### QRコードを他人に使われたら？
QRコードはDiscordアカウントと紐付いている。他人が使用しても本人の名前で登録されるため、不正使用のメリットがない。

---

# まとめ

<div class="two-column">

<div>

### 参加者
1. 事前にシステムにログイン
2. QRコードを保存
3. 当日、受付でスキャン

**準備時間: 約1分**

</div>

<div>

### スタッフ
1. スタッフ用ページを開く
2. カメラを許可
3. QRコードをスキャン

**誰でも対応可能**

</div>

</div>

---

<!-- _class: title -->

# Appendix

---

# 技術仕様

| 項目 | 詳細 |
|------|------|
| 認証 | Discord OAuth2 |
| QRコード | SHA256署名付きトークン |
| データベース | SQLite |
| サーバー | Oracle Cloud (無料枠) |
| セキュリティ | Cloudflare Access |

**運用コスト**: ドメイン代のみ（年間約1,000〜2,000円）

---

# 期待される効果

| 指標 | 従来 | 新システム |
|------|------|-----------|
| 受付時間/人 | 30秒〜1分 | **約3秒** |
| 受付担当者 | 会議フロント限定 | **誰でも** |
| 出席確認 | スプシを目視 | **コマンド一発** |
| 待ち行列 | 廊下まで溢れる | **ほぼ解消** |

---

# 参考情報

- **システムURL**: 後日Discordで案内
- **運営Discord**: 既存サーバー
- **本スライド**: 後日共有

---

<!-- _class: title -->

# 以上
