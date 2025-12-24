---
marp: true
theme: default
paginate: true
backgroundColor: #1e1e2e
color: #cdd6f4
style: |
  section {
    font-family: 'Noto Sans JP', 'Segoe UI', sans-serif;
  }
  h1, h2, h3 {
    color: #89b4fa;
  }
  strong {
    color: #f9e2af;
  }
  code {
    background-color: #313244;
    color: #a6e3a1;
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }
  a {
    color: #89dceb;
  }
  section.title {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  section.title h1 {
    font-size: 2.5em;
    color: #cba6f7;
  }
  .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2em;
  }
  .highlight-box {
    background-color: #313244;
    border-radius: 12px;
    padding: 1em;
    margin: 0.5em 0;
  }
  .emoji-large {
    font-size: 3em;
  }
  .step-number {
    display: inline-block;
    background: linear-gradient(135deg, #89b4fa, #cba6f7);
    color: #1e1e2e;
    width: 2em;
    height: 2em;
    line-height: 2em;
    border-radius: 50%;
    text-align: center;
    font-weight: bold;
    margin-right: 0.5em;
  }
---

<!-- _class: title -->

# 📋 入退場管理システム
## 第37回 模擬国連会議全日本大会

Discord × QRコードで**かんたん受付**

---

# 📌 今日お話しすること

1. **なぜこのシステムを導入するの？**
   - これまでの課題と解決策

2. **どうやって使うの？**
   - 参加者としての使い方
   - スタッフとしての使い方

3. **よくある質問**

---

# 🤔 これまでの受付の課題

<div class="two-column">

<div>

### 😫 混雑問題
- 6つの会議の受付が**一箇所に集中**
- 参加者が廊下まで溢れる…

### ⏰ 時間がかかる
- スプレッドシートに**手動で記録**
- 一人ずつ名前を確認 → 入力

</div>

<div>

### 🙋 担当者が固定
- 会議フロントが受付を兼任
- 担当者が遅刻したら大変！

### 📊 状況がわからない
- 「今、誰が来てる？」がすぐわからない

</div>

</div>

---

# ✨ 新システムで解決！

<div class="highlight-box">

### 🚀 スピードアップ
**QRコードをスキャン → 一瞬で完了！**
スプレッドシートへの手入力は不要に

</div>

<div class="highlight-box">

### 👥 誰でも受付できる
**スマホがあればOK**
特定の担当者に依存しない

</div>

<div class="highlight-box">

### 📱 リアルタイム確認
**Discordで出席状況をすぐチェック**
「あと何人来てない？」がすぐわかる

</div>

---

# 🔐 仕組みはシンプル

```
                 ┌─────────────────────────────┐
                 │        Discord              │
                 │   （普段使ってるアカウント）    │
                 └─────────────┬───────────────┘
                               │ ログイン
                               ▼
┌──────────────────────────────────────────────────┐
│                  受付システム                      │
│   ┌─────────────┐          ┌─────────────────┐   │
│   │  QRコード   │  スキャン  │   出席データ     │   │
│   │   発行     │ ─────────→│    自動記録     │   │
│   └─────────────┘          └─────────────────┘   │
└──────────────────────────────────────────────────┘
```

**ポイント**: 新しいアカウント作成は**不要**！
いつものDiscordアカウントでOK 👍

---

<!-- _class: title -->

# 参加者として使う

<div class="emoji-large">🎫</div>

---

# 📱 参加者の流れ（事前準備）

<div class="step-number">1</div> **システムにアクセス**

受付システムのURL（後日お知らせ）を開く

---

# 📱 参加者の流れ（事前準備）

<div class="step-number">2</div> **Discordでログイン**

「Discordでログイン」ボタンをタップ
↓
いつものDiscordアカウントで認証

> 💡 **ヒント**: スマホのDiscordアプリが開きます
> パスワード入力が面倒なら、事前にログインしておこう！

---

# 📱 参加者の流れ（事前準備）

<div class="step-number">3</div> **QRコードが表示される**

ログインすると、あなた専用のQRコードが表示されます

<div class="highlight-box">

### 🔒 このQRコードは…
- あなた**だけ**のもの
- スクリーンショットでもOK
- 画面の明るさを上げておくとスキャンしやすい

</div>

---

# 🏢 当日の受付

<div class="step-number">1</div> 会場に到着

<div class="step-number">2</div> スマホでQRコードを表示（または保存した画像を開く）

<div class="step-number">3</div> 受付スタッフにQRコードを見せる

<div class="step-number">4</div> スキャンされたら**完了！** 🎉

**所要時間: 約3秒**

---

<!-- _class: title -->

# スタッフとして使う

<div class="emoji-large">📷</div>

---

# 📷 スキャナーの使い方

<div class="step-number">1</div> **スタッフ用ページにアクセス**

スタッフ専用URLを開く（Cloudflare Accessで保護）

<div class="step-number">2</div> **カメラを許可**

「カメラへのアクセスを許可しますか？」→ **許可**

<div class="step-number">3</div> **QRコードをスキャン**

参加者のスマホ画面にカメラを向けるだけ

---

# 📱 スキャン結果の見方

| 画面の色 | 振動 | 意味 |
|---------|-----|------|
| 🟢 **緑** | 短く1回 | ✅ 成功！出席登録されました |
| 🟡 **黄** | 2回 | ⚠️ 既に登録済み（二重スキャン） |
| 🔴 **赤** | 長め1回 | ❌ エラー（無効なQRなど） |

<div class="highlight-box">

### 💡 便利機能
- **3秒後に自動リセット** → 次の人をすぐスキャン
- **ダブルタップで即消去** → 急いでるときに

</div>

---

# 💬 Discordコマンド

出席状況を**Discordから確認**できます

```
/attendance status
```
→ 今日の出席状況（出席済み / 未出席の人数）

```
/attendance present
```
→ 出席済みの人一覧

```
/attendance absent
```
→ まだ来ていない人一覧

---

# 📊 コマンド実行例

```
📊 出席状況 (2025-12-27)

✅ 出席: 45名
❌ 未出席: 55名
━━━━━━━━━━━━━━━━━━
合計: 100名
```

**リアルタイムで状況把握**できるので、
「あと誰が来てないの？」がすぐわかる！

---

# ❓ よくある質問

### Q. Discordにログインできない！
→ パスワードを忘れた場合は、Discordの「パスワードを忘れた」から再設定してください

### Q. QRコードをなくした / スクショ消した
→ もう一度システムにログインすれば、同じQRコードが表示されます

### Q. スマホの電池が切れた！
→ スタッフに相談してください。手動登録も可能です

---

# ❓ よくある質問（続き）

### Q. 誰かに自分のQRコードを使われたら？
→ QRコードはあなたのDiscordアカウントと紐づいています
   他人が使っても、**あなたの名前**で登録されるので意味がありません

### Q. ネットがつながらない場所では？
→ 事前にQRコードのスクリーンショットを保存しておけば
   オフラインでも表示できます（画像として保存）

---

# 📝 まとめ

<div class="two-column">

<div>

### 参加者
1. 事前にシステムにログイン
2. QRコードをスクショ or 表示
3. 当日、受付でスキャン

**準備は1分で完了！**

</div>

<div>

### スタッフ
1. スタッフ用ページを開く
2. カメラを許可
3. QRコードをスキャン

**誰でも受付可能！**

</div>

</div>

---

<!-- _class: title -->

# ご不明点があれば
# お気軽にご質問ください 🙋

運営Discordサーバーでもサポートします！

---

<!-- _class: title -->

# Appendix
## 技術的な補足情報

---

# 🛠️ 技術仕様（興味のある方向け）

| 項目 | 詳細 |
|------|------|
| 認証 | Discord OAuth2 |
| QRコード | SHA256署名付きトークン |
| データベース | SQLite |
| サーバー | Oracle Cloud (無料枠) |
| セキュリティ | Cloudflare Access |

**運用コスト**: ほぼ**0円**
（ドメイン代のみ、年間約1,000〜2,000円）

---

# 📊 期待される効果

| 指標 | 従来 | 新システム |
|------|------|-----------|
| 受付時間/人 | 30秒〜1分 | **約3秒** |
| 受付担当者 | 会議フロント限定 | **誰でも** |
| 出席確認 | スプシを目視 | **コマンド一発** |
| 待ち行列 | 廊下まで溢れる | **ほぼ解消** |

---

# 🔗 参考リンク

- **システムURL**: （後日Discordでお知らせ）
- **運営Discord**: （既存のサーバー）
- **このスライド**: 後日共有します

---

<!-- _class: title -->

# ありがとうございました！ 🎉

第37回 模擬国連会議全日本大会を
一緒に成功させましょう！
