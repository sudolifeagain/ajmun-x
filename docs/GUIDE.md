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
| `QR_SECRET` | QRトークン署名用キー |
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

### 2.4 権限システムの初期設定

権限未設定時は誰でも `/system sync` を実行できます（初期セットアップ用）。

#### 手順1: メンバー同期

Discordで以下を実行（権限不要）：
```
/system sync
```

#### 手順2: 管理者ロール登録

DBに直接登録：
```bash
sqlite3 prisma/dev.db "INSERT INTO SystemConfig (key, value, description) VALUES ('admin_role_ids', 'ロールID', '管理者ロール');"
```

#### 手順3: 追加設定（Discord経由）

管理者として以下を設定：
```
/system config staff_role_ids <スタッフロールID>
/system config operation_guild_id <運営サーバーID>
```

#### 設定一覧

| 設定キー | 用途 | 必須 |
|---------|------|------|
| `admin_role_ids` | 管理者ロール | ✅ |
| `staff_role_ids` | スタッフロール | 任意 |
| `operation_guild_id` | 運営サーバーID（属性判定用） | 任意 |

---

## 3. 動作確認

### 3.1 ユーザーフロー
1. http://localhost:3000 → 「Discordでログイン」
2. QRコード画面が表示されれば成功

### 3.2 スキャナーフロー
1. http://localhost:3000/staff → カメラ許可 → QRスキャン

### 3.3 Bot コマンド

| コマンド | 権限 |
|---------|-----|
| `/attendance status` | staff以上 |
| `/attendance present/absent` | staff以上 |
| `/system sync` | 権限未設定時：誰でも / 設定後：staff以上 |
| `/system show/config` | admin |

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
| Application domain | `your-domain.com` |
| Path | `/staff` |
| Policy | Allow - 指定メールアドレス |

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

### 7.1 基本設定

```bash
chmod 600 ~/ajmun-x/.env

# iptables 永続化
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

### 7.2 Nginx セキュリティヘッダー

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

### 7.3 SSH 強化 (`/etc/ssh/sshd_config`)

```
PasswordAuthentication no
PermitRootLogin no
MaxAuthTries 3
```

### 7.4 fail2ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban && sudo systemctl start fail2ban
```

### 7.5 自動セキュリティ更新

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 参考リンク

- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [PM2](https://pm2.keymetrics.io/docs/usage/quick-start/)
