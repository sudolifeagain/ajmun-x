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
  img {
    max-height: 300px;
    max-width: 90%;
    object-fit: contain;
    display: block;
    margin: 0 auto;
  }
---

<!-- _class: title -->

# 入退場管理システム<br>「ピ逃げちゃん！」
## 第37回 模擬国連会議全日本大会

Discord認証 × QRコードによる受付システム

---

# 目次

1. 導入の背景 — 従来の課題と解決策
2. 参加者向け — QRコード取得と受付の流れ
3. スタッフ向け — スキャナーとDiscordコマンド
4. FAQ

---

# 従来の受付の課題

### 混雑・時間
- 7会議の受付が一箇所に集中し、廊下まで溢れる
- スプレッドシートに手動記録、一人ずつ名前を確認して入力

### 担当者の固定・状況把握
- 会議フロントが受付を兼任、担当者不在時の対応が困難
- リアルタイムでの出席確認ができない

---

# 新システムによる解決

| 課題 | 解決策 |
|------|--------|
| 受付時間 | QRスキャンで即完了。手入力不要 |
| 担当者固定 | 権限のあるスタッフならスマホ・PCから受付可能 |
| 状況把握 | Discordコマンドで即時確認 |

---

# システム構成

<center>

新規アカウント作成は不要。既存のDiscordアカウントを使用。

![システム構成図](./system-diagram.svg)

</center>

---

<!-- _class: title -->

# 参加者向け

---

# 事前準備 (1) システムにアクセス

受付システムのURLを開く: https://ajmun37.re4lity.com

---

# 事前準備 (2) Discordでログイン

「Discordでログイン」をクリック

**PCの場合**
Discordアプリまたはブラウザで認証画面が開く。ログイン済みならワンクリックで完了。

**スマホの場合**
Discordアプリで認証画面が開く。事前にログインしておくとスムーズ。

---

# 事前準備 (3) QRコードを取得

表示されたQRコードを保存

- 各自専用のQRコードが発行される
- スクリーンショットで保存可能
- 画面の明るさを上げておくとスキャンしやすい

---

# 当日の受付

1. 会場に到着
2. スマホでQRコードを表示（保存した画像でも可）
3. 受付スタッフにQRコードを提示
4. スキャン完了

所要時間: 数秒

---

<!-- _class: title -->

# スタッフ向け

---

# スキャナーの使い方

1. スタッフ用ページにアクセス
   - URL: https://ajmun37.re4lity.com/staff
   - Cloudflare Accessで保護
2. カメラを許可
3. 参加者のスマホ画面にカメラを向ける

---

# スキャン結果の見方

| ステータス | 表示内容 |
|-----------|---------|
| 成功 | ユーザー名、アバター、属性、所属サーバー |
| 重複 | 同上 + 「本日入場済み」メッセージ |
| エラー | エラーメッセージのみ |

- 数秒後に自動リセット / ダブルタップで即時リセット
- 振動フィードバックはAndroidのみ（iOS非対応）

---

# Discordコマンド（会議フロント/スタッフ向け）

organizer（会議フロント）以上のロールで実行可能

| コマンド | 説明 |
|---------|------|
| `/attendance status` | 出席済み / 未出席の人数 |
| `/attendance present` | 出席済み一覧 |
| `/attendance absent` | 未出席一覧 |

※ organizerは自分の所属サーバーのみ、staff/adminは全サーバーを確認可能

---

# Discordコマンド（スタッフ/管理者向け）

| コマンド | 必要権限 | 説明 |
|---------|---------|------|
| `/system sync` | staff以上 | メンバー情報を同期 |
| `/system show` | admin | 現在の設定を表示 |
| `/system config` | admin | 設定を変更 |
| `/system delete` | admin | 設定を削除 |

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

# FAQとTips

### QRコードを削除してしまった
再度システムにログインすれば同じQRコードが表示される。

### QRコードの保存機能
スクリーンショットまたは保存機能でQRコードを保存できる。
大会期間中のQRコードは同一のものであるため、一度保存すれば何度でも使用できる。

### QRコードを他人に使われたら？
QRコードはDiscordアカウントと紐付き、スキャン時に名前が表示される。

---

# まとめ

### 参加者
1. 事前にシステムにログイン
2. QRコードを保存
3. 当日、受付でスキャン

準備時間: 約1分

### スタッフ
1. スタッフ用ページを開く
2. カメラを許可
3. QRコードをスキャン

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
| サーバー | Oracle Cloud |
| セキュリティ | Cloudflare Access |

運用コスト: ドメイン代のみ（年間約1,000〜2,000円）
※Oracle Cloudは無料枠を活用している

---

# 期待される効果

| 指標 | 従来 | 新システム |
|------|------|-----------|
| 受付時間/人 | 30秒〜1分 | 数秒 |
| 受付担当者 | 会議フロント限定 | 権限のあるスタッフ |
| 出席確認 | スプシを目視 | コマンド一発 |
| 待ち行列 | 廊下まで溢れる | ほぼ解消 |

---

# リンク

| ページ | URL |
|--------|-----|
| メイン | https://ajmun37.re4lity.com |
| 使い方ガイド | https://ajmun37.re4lity.com/guide |
| スタッフ用スキャナ | https://ajmun37.re4lity.com/staff |
| 利用規約 | https://ajmun37.re4lity.com/terms |
| プライバシーポリシー | https://ajmun37.re4lity.com/privacy |

---

<!-- _class: title -->

# 以上
