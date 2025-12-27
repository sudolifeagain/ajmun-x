# AJMUN 開発・デプロイガイド

このドキュメントでは、ローカル開発環境のセットアップから本番環境へのデプロイまでを説明します。

---

## 目次

1. [Discord アプリケーションの作成](#1-discord-アプリケーションの作成)
2. [ローカル開発環境](#2-ローカル開発環境)
3. [動作確認](#3-動作確認)
4. [本番環境デプロイ (OCI)](#4-本番環境デプロイ-oci)
5. [Cloudflare 設定](#5-cloudflare-設定)
6. [運用・トラブルシューティング](#6-運用トラブルシューティング)
7. [セキュリティ強化](#7-セキュリティ強化)
8. [データベースバックアップ](#8-データベースバックアップ)

---

## 1. Discord アプリケーションの作成

### 1.1 Developer Portal での設定

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」→ アプリ名を入力（例: `AJMUN Entry System`）

### 1.2 OAuth2 設定

1. **OAuth2** → **General** を選択
2. メモ: **Client ID** / **Client Secret**
3. **Redirects** に追加:
   - 開発: `http://localhost:3000/api/auth/discord/callback`
   - 本番: `https://your-domain.com/api/auth/discord/callback`

### 1.3 Bot 作成

1. **Bot** → 「Reset Token」でトークン取得
2. **Privileged Gateway Intents** で **SERVER MEMBERS INTENT** を有効化

### 1.4 Bot をサーバーに招待

1. **OAuth2** → **URL Generator**
2. SCOPES: `bot`, BOT PERMISSIONS: `View Channels`
3. 生成されたURLでBot招待

### 1.5 初期設定（/setup コマンド）

Botをサーバーに招待後、Discordで以下のコマンドを実行：

```
1. /setup target-guild enable:true    # 対象サーバーに設定
2. /setup operation-server enable:true # 運営サーバーに設定（該当する場合）
3. /setup admin-roles roles:<ロールID> # 管理者ロール設定
4. /setup staff-roles roles:<ロールID> # スタッフロール設定
5. /system sync                        # メンバー同期
```

> ⚠️ `admin-roles` を設定すると、以降は管理者ロール保持者のみが `/setup` を実行可能になります

#### ロールIDの確認方法
1. Discordの設定 → 詳細設定 → 開発者モードをオン
2. ロールを右クリック → 「IDをコピー」

#### 設定確認
```
/setup status
```

#### ロールと権限

| ロール | 設定キー | 権限 |
|--------|----------|------|
| **bot管理者** | `admin_role_ids` | `/system`、`/setup`（設定後）、`/attendance` 全機能 |
| **事務局員** | `staff_role_ids` | `/attendance` 全機能 |
| **会議フロント** | `organizer_role_ids` | `/attendance` 自会議のみ |
| **参加者** | - | QRコード受取（DM/Web） |

> 💡 bot管理者ロールは事務局員権限も含みます（上位互換）

#### リモートサーバー設定

運営サーバーから他サーバーを設定（会議サーバー登録に便利）:
```
/setup target-guild enable:true guild_id:123456789012345678
```

---

## 2. ローカル開発環境

### 2.1 環境変数 (.env)

```bash
# Discord OAuth2
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback

# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token

# データベース
DATABASE_URL=file:./prisma/dev.db

# QRコード署名
QR_SECRET=your-super-secret-key-change-this

# 本番環境用（オプション）
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Discord Webhookログ（オプション - 設定しない場合は機能無効）
# DISCORD_LOG_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/xxx
# DISCORD_LOG_MENTION_USER_ID=507198375473446923
```

### 環境変数一覧

| 変数名 | 説明 |
|--------|------|
| `DISCORD_CLIENT_ID` | OAuth2用クライアントID |
| `DISCORD_CLIENT_SECRET` | OAuth2用シークレット |
| `DISCORD_REDIRECT_URI` | OAuthコールバックURL |
| `DISCORD_BOT_TOKEN` | Bot認証トークン |
| `DATABASE_URL` | SQLiteデータベースパス |
| `QR_SECRET` | QRトークン・セッションJWT署名用キー |
| `EXPORT_API_KEY` | Googleスプレッドシート同期API認証キー |
| `DISCORD_LOG_WEBHOOK_URL` | ログ送信用Webhook URL（任意） |
| `DISCORD_LOG_MENTION_USER_ID` | エラー時メンションするユーザーID（任意） |

### 2.2 セットアップ

```bash
npm install
npx prisma migrate dev
```

### 2.3 起動

```bash
# Webサーバー
npm run dev

# Discord Bot（別ターミナル）
npm run bot
```

### 2.4 初期設定の流れ

#### 概要

1. **運営サーバー**にBotを招待し、設定
2. **会議サーバー**にBotを招待し、設定（複数可）
3. 必要に応じてメンバー同期

---

#### STEP 1: 運営サーバーの設定

運営サーバー（スタッフ全員が所属するサーバー）で以下を実行：

```
/setup operation-server enable:true   # 運営サーバーとして登録
/setup admin-roles roles:<ロールID>   # Bot管理者を設定（以降は管理者のみ/setup実行可能）
/setup staff-roles roles:<ロールID>   # 事務局員ロールを設定
/setup organizer-roles roles:<ロールID>  # 会議フロントロールを設定（複数追加可能）
```

#### STEP 2: 会議サーバーの設定

各会議サーバーで以下を実行：

```
/setup target-guild enable:true       # 出席管理対象として登録
```

**または**、運営サーバーからリモート設定：

```
/setup target-guild enable:true guild_id:<会議サーバーID>
```

#### STEP 3: メンバー同期（オプション）

Bot起動時に自動同期されますが、即時反映したい場合：

```
/system sync
```

---

#### 自動処理（コマンド不要）

| イベント | 自動処理 |
|---------|---------|
| **Bot起動時** | 全サーバーのメンバーを自動同期 |
| **メンバー参加** | 新メンバーを自動登録、属性を自動判定 |
| **ロール変更** | 属性（staff/organizer/participant）を自動再計算 |
| **メンバー脱退** | メンバーシップを削除（ユーザー自体は残る） |

---

#### 属性判定ロジック

ユーザーの**全ギルドのロール**を集約して判定：

```
staff_role_ids に一致 → "staff"（事務局員）
organizer_role_ids に一致 → "organizer"（会議フロント）
どちらでもない → "participant"（参加者）
```

> 💡 会議サーバーAで会議フロントロールを持っていれば、そのユーザーは全体で「organizer」として認識されます。

---

#### 設定確認コマンド

| コマンド | 説明 |
|---------|------|
| `/setup status` | 現在のサーバーの設定状況（運営/会議/ロール） |
| `/system show` | 全体のシステム設定（全サーバー一覧を含む） |


---

## 3. 動作確認

### 3.1 ユーザーフロー (Web)
1. http://localhost:3000 → 「Discordでログイン」
2. QRコード画面が表示されれば成功

### 3.2 ユーザーフロー (DM配布)
1. Bot管理者として `/system send-qr target:specific_users specific_user_ids:<自分のID>` を実行
2. DMでQRコードが届けば成功


### 3.2 スキャナーフロー
1. http://localhost:3000/staff → カメラ許可 → QRスキャン

### 3.3 Bot コマンド

#### 基本コマンド

| コマンド | 権限 |
|---------|-----|
| `/attendance status` | organizer以上 |
| `/attendance present` | organizer以上 |
| `/attendance absent` | organizer以上 |
| `/attendance checkin` | organizer以上 |
| `/system sync` | 権限未設定時：誰でも / 設定後：staff以上 |
| `/system show` | admin |
| `/system config <key> <value>` | admin |
| `/system delete <key>` | admin（確認ダイアログ付き） |
| `/system send-qr` | admin |
| `/system dm-status` | admin |
| `/help` | 誰でも |

#### 出席コマンドのフィルタオプション

`/attendance status`、`/attendance present`、`/attendance absent` は以下のフィルタをサポート：

| オプション | 説明 | 例 |
|----------|------|-----|
| `conference` | 会議（サーバー）で絞り込み | オートコンプリート対応 |
| `attribute` | 属性で絞り込み | そのほか/会議フロント/事務局員 |
| `date` | 日付で絞り込み | YYYY-MM-DD形式（省略時は本日） |

**使用例:**

```
/attendance status                                      # 本日の全体状況
/attendance status conference:会議A                      # 会議Aの今日の状況
/attendance status attribute:staff                      # 事務局員の今日の状況
/attendance present date:2025-12-25                     # 12/25の出席者一覧
/attendance absent conference:会議B date:2025-12-26      # 会議Bの12/26未出席者
/attendance checkin user:ユーザー名                       # 手動チェックイン
```

> 💡 `conference` を指定した場合、`attribute:staff` は無視されます（事務局員は運営サーバーに所属のため）

> 💡 会議フロント（organizer）は自分の担当会議のみ表示可能です

---

## 4. 本番環境デプロイ (OCI)

### 4.1 OCI インスタンス作成

| 設定 | 値 |
|-----|-----|
| イメージ | Ubuntu 24.04 |
| シェイプ | VM.Standard.A1.Flex (ARM) |
| OCPU / メモリ | 4 / 24 GB |

セキュリティリストでポート 22, 80, 443 を開放。

### 4.2 GitHub SSH キー設定

```bash
# SSHキー生成
ssh-keygen -t ed25519 -C "your-email@example.com"

# 公開鍵を表示
cat ~/.ssh/id_ed25519.pub
```

表示された公開鍵を [GitHub Settings → SSH Keys](https://github.com/settings/keys) に追加。

### 4.3 サーバー初期設定

```bash
sudo apt update && sudo apt upgrade -y

# Node.js インストール (nvm経由)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 22

# PM2 インストール
sudo npm install -g pm2
```

### 4.3 アプリケーションデプロイ

```bash
git clone git@github.com:sudolifeagain/ajmun-x.git
cd ajmun-x
touch .env && nano .env  # 環境変数を設定
npm install
npx prisma generate
npx prisma db push
npm run build
```

### 4.4 PM2 プロセス管理

```bash
pm2 start npm --name "ajmun-web" -- start
pm2 start npm --name "ajmun-bot" -- run bot
pm2 startup && pm2 save
```

**更新時:**
```bash
cd ~/ajmun-x && git pull && npm run build && pm2 restart all
```

### 4.5 Nginx リバースプロキシ

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/conf.d/ajmun.conf
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t && sudo systemctl enable nginx && sudo systemctl start nginx
```

---

## 5. Cloudflare 設定

### 5.1 DNS

| タイプ | 名前 | 内容 | プロキシ |
|-------|------|------|---------|
| A | ajmun37 | OCI パブリック IP | オレンジ雲 |

### 5.2 SSL/TLS

- モード: **フル**
- 「常に HTTPS を使用」: 有効

### 5.3 Cloudflare Access (スタッフページ保護)

1. [Zero Trust](https://one.dash.cloudflare.com/) → **Access** → **Applications**
2. **Self-hosted** を選択

| 設定 | 値 |
|-----|-----|
| Application domain | `ajmun37.re4lity.com` |
| Path | `/staff` |
| Policy | Allow - 指定メールアドレス |

### 5.4 Prisma Studio (データベース管理GUI)

ブラウザからDBを確認・編集できるツール。Access保護付き。

#### DNS追加

| タイプ | 名前 | 内容 | プロキシ |
|-------|------|------|----|
| A | `db` | OCI パブリック IP | オレンジ雲 |

#### Nginx設定

```bash
sudo nano /etc/nginx/conf.d/prisma-studio.conf
```

```nginx
server {
    listen 80;
    server_name db.ajmun37.re4lity.com;

    location / {
        proxy_pass http://127.0.0.1:5555;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### Cloudflare Access

| 設定 | 値 |
|-----|-----|
| Application domain | `db.ajmun37.re4lity.com` |
| Policy | Allow - 管理者メールのみ |

#### PM2起動

```bash
pm2 start "npx prisma studio --port 5555 --browser none" --name ajmun-db --cwd ~/ajmun-x
pm2 save
```

アクセス: https://ajmundb.re4lity.com

### 5.5 Google Sheets 出席同期

スプレッドシートに出席データを自動同期する機能。

#### 環境変数

```bash
EXPORT_API_KEY=ランダムな文字列を生成して設定
```

#### Apps Script 設定

1. 対象スプレッドシートを開く
2. **拡張機能** → **Apps Script**
3. `docs/google-sheets-sync.js` の内容を貼り付け
4. `CONFIG.API_KEY` を環境変数と同じ値に変更
5. 保存 → 実行（初回は権限許可が必要）

#### 使い方

| 方法 | 説明 |
|------|------|
| 手動 | メニュー「出席同期」→「今すぐ同期」 |
| 自動 | トリガーで定期実行（5分ごとなど） |

#### 同期されるデータ

| フィールド | 説明 |
|-----------|------|
| Discord ID | ユーザーID |
| グローバル名 | デフォルト表示名 |
| ニックネーム | サーバー固有名 |
| 会議名 | 所属サーバー |
| 属性 | 参加者/会議フロント/スタッフ |
| 出席状況 | ✅ 済 / ❌ 未 |
| スキャン日時 | チェックイン時刻 |

#### 設定オプション

```javascript
const CONFIG = {
  API_URL: "https://ajmun37.re4lity.com/api/attendance-export",
  API_KEY: "ここにAPIキーを入力",
  SHEET_NAME: "受付出席管理",  // ← 既存のタブ名を指定可能
};
```

| 設定 | 動作 |
|------|------|
| 既存タブ名を指定 | そのタブにデータを上書き |
| 存在しないタブ名 | 新規タブを作成 |

#### 権限について

**必要な権限:**
- 外部サービスへの接続（API呼び出し）
- スプレッドシートの編集

**初回実行時:**
1. 「このアプリは確認されていません」と表示
2. 「詳細」→「〇〇（安全ではないページ）に移動」
3. 「許可」をクリック

> 💡 スプレッドシートのオーナーまたは編集者がApps Scriptを設定してください

---

## 6. 運用・トラブルシューティング

### ログ確認

```bash
pm2 logs ajmun-web --lines 30
pm2 logs ajmun-bot --lines 30
```

### プロセス管理

```bash
pm2 status
pm2 restart all
pm2 delete all  # 完全停止（環境変数更新時）
```

### データベース

```bash
# ユーザー確認
sqlite3 prisma/prod.db "SELECT discordUserId, globalName FROM User;"

# 出席ログ確認
sqlite3 prisma/prod.db "SELECT * FROM AttendanceLog;"

# 出席ログ詳細（JST時刻付き）
sqlite3 prisma/prod.db "SELECT u.globalName, a.checkInDate, datetime(a.checkInTimestamp/1000, 'unixepoch', '+9 hours') as checkInJST, a.attribute FROM AttendanceLog a JOIN User u ON a.discordUserId = u.discordUserId ORDER BY a.checkInTimestamp DESC;"

# 特定ユーザーの出席履歴
sqlite3 prisma/prod.db "SELECT * FROM AttendanceLog WHERE discordUserId = 'ユーザーID' ORDER BY checkInTimestamp DESC;"
```

### Prisma クリーンビルド

```bash
rm -rf node_modules/.prisma .next
npx prisma generate
npm run build
    pm2 restart all
```

### データベースリセット

```bash
pm2 stop all
rm -f prisma/prod.db
npx prisma db push
pm2 restart all
```

> ⚠️ 全データが削除されます

### ユーザー再同期（設定保持）

```bash
sqlite3 prisma/prod.db "DELETE FROM UserGuildMembership; DELETE FROM User;"
pm2 restart ajmun-bot
```

### OAuthエラー: `invalid_redirect_uri`
- Developer Portal と `.env` の `DISCORD_REDIRECT_URI` が一致しているか確認

### Botコマンドが表示されない
- `applications.commands` スコープがあるか確認
- グローバルコマンドは反映まで最大1時間

### ネットワーク確認

```bash
# パブリックIP確認
curl -s ifconfig.me

# ポート確認
sudo ss -tlnp | grep -E '80|3000'

# iptables ルール確認
sudo iptables -L -n | head -15

# 外部からの接続テスト
curl -I --connect-timeout 10 http://$(curl -s ifconfig.me)
```

### Nginx 確認

```bash
# ステータス
sudo systemctl status nginx

# 設定テスト
sudo nginx -t

# 再読み込み
sudo systemctl reload nginx

# ホストヘッダー付きテスト
curl -I -H "Host: your-domain.com" http://localhost
```

---

## 7. セキュリティ強化

### 7.1 アプリケーションセキュリティ

#### セッション認証（JWT）
- セッショントークンは **JWT（HS256署名）** で保護
- 署名キーは `QR_SECRET` 環境変数を使用
- 7日間の有効期限付き
- 改ざん検知により不正アクセスを防止

#### QRコード署名
- QRトークンは **SHA256 HMAC** で署名
- 署名キーは `QR_SECRET` 環境変数を使用
- 偽造されたQRコードはスキャン時に拒否

#### APIレート制限

| API | 制限 | キー |
|-----|------|------|
| `/api/scan` | 100リクエスト/分 | IPアドレス |
| `/api/attendance-export` | 5リクエスト/分 | APIキー |

#### API認証（Authorizationヘッダー）

`/api/attendance-export` は `Authorization: Bearer <API_KEY>` ヘッダーで認証:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.com/api/attendance-export?dates=2025-12-27"
```

#### ログイン試行追跡

以下のエラーがDiscordにログ送信されます:
- CSRF検証エラー（state不一致）
- 認可コード欠落
- サーバー設定エラー
- 対象サーバー未参加によるアクセス拒否

### 7.2 インフラセキュリティ

```bash
chmod 600 ~/ajmun-x/.env

# iptables 永続化
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

### 7.3 Nginx セキュリティヘッダー

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

### 7.4 SSH 強化 (`/etc/ssh/sshd_config`)

```
PasswordAuthentication no
PermitRootLogin no
MaxAuthTries 3
```

### 7.5 fail2ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban && sudo systemctl start fail2ban
```

### 7.6 自動セキュリティ更新

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 7.3 運用フロー: QRコード配布

今大会では、参加者へのQRコード配布は **BotによるDM一斉送信** を基本とします。

1. **Bot管理者**が以下のコマンドを実行し、全員にQRコードを配ります。
   ```
   /system send-qr target:全員
   ```
   - ログイン未完了のユーザーにも、自動的に正規QRトークンが生成され送信されます。
   - DMブロック等で送信失敗した場合、ログに記録されます。
   - **所要時間**: 300名規模の場合、API制限回避のために **約3〜5分** かかります。
     - 処理中はBotを停止・再起動しないでください。
     - ステータスは随時更新されます。

2. **参加者**は、DMで届いたQRコードを入場証として使用します。
   - スクリーンショットを推奨してください。

3. **DMが届かない場合（例外対応）**
   - DM設定で受信拒否している場合などは、従来の **[Webログイン](https://ajmun37.re4lity.com/)** によるQR表示を案内してください。
   - ログインすれば同じQRコードが表示されます。

---

## 8. データベースバックアップ

### 8.1 定期バックアップの設定

日本時間23:00に毎日バックアップを実行する設定：

```bash
# バックアップ用ディレクトリ作成
mkdir -p ~/ajmun-x/backups

# crontab編集
crontab -e
```

以下を追加（日本時間23:00 = UTC 14:00）：
```cron
0 14 * * * cp ~/ajmun-x/prisma/prod.db ~/ajmun-x/backups/prod_$(date +\%Y\%m\%d).db
```

### 8.2 バックアップ確認

```bash
ls -la ~/ajmun-x/backups/
```

### 8.3 ロールバック手順

1. **Botを停止**
   ```bash
   pm2 stop ajmun-bot
   ```

2. **現在のDBをバックアップ**
   ```bash
   cp ~/ajmun-x/prisma/prod.db ~/ajmun-x/prisma/prod_before_rollback.db
   ```

3. **バックアップから復元**
   ```bash
   cp ~/ajmun-x/backups/prod_YYYYMMDD.db ~/ajmun-x/prisma/prod.db
   ```

4. **Botを再起動**
   ```bash
   pm2 start ajmun-bot
   ```

> **注意**: ロールバックすると、そのバックアップ以降の変更は失われます。

---

## 参考リンク


- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [PM2](https://pm2.keymetrics.io/docs/usage/quick-start/)
