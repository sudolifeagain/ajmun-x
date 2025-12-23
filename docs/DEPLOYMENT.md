# デプロイメントガイド

このドキュメントでは、Oracle Cloud Infrastructure (OCI) へのデプロイと Cloudflare Access によるアクセス制御の設定手順を説明します。

---

## 目次

1. [OCI インスタンスのセットアップ](#1-oci-インスタンスのセットアップ)
2. [アプリケーションのデプロイ](#2-アプリケーションのデプロイ)
3. [Cloudflare DNS 設定](#3-cloudflare-dns-設定)
4. [Cloudflare Access 設定](#4-cloudflare-access-設定)

---

## 1. OCI インスタンスのセットアップ

### 1.1 Always Free インスタンスの作成

1. [Oracle Cloud](https://cloud.oracle.com/) にログイン
2. **コンピュート** → **インスタンス** → **インスタンスの作成**
3. 以下の設定を選択：

| 設定項目 | 値 |
|---------|-----|
| イメージ | Ubuntu 24.04 |
| シェイプ | VM.Standard.A1.Flex (ARM) |
| OCPU | 4 (無料枠上限) |
| メモリ | 24 GB (無料枠上限) |
| ブートボリューム | 200 GB (無料枠上限) |

4. SSH公開鍵を登録
5. **作成**をクリック

### 1.2 ネットワーク設定 (セキュリティリスト)

VCN のセキュリティリストで以下のイングレスルールを追加：

| ポート | プロトコル | 用途 |
|-------|----------|------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP (Cloudflare経由) |
| 443 | TCP | HTTPS (Cloudflare経由) |

### 1.3 OS の初期設定

```bash
# SSH接続
ssh -i ~/.ssh/your_key ubuntu@<パブリックIP>

# パッケージ更新
sudo apt update && sudo apt upgrade -y

# nvm をダウンロードしてインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# シェルを再起動する代わりに以下を実行 (必ず実行すること)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# ↑を実行後、Node.js v22 をインストール
nvm install 22

# バージョン確認
node -v  # v22.x.x
npm -v   # 10.x.x

# PM2 インストール (プロセスマネージャー)
sudo npm install -g pm2

# Git インストール
sudo apt install -y git
```

---

## 2. アプリケーションのデプロイ

### 2.1 GitHub SSH キーの設定

```bash
# SSHキー生成
ssh-keygen -t ed25519 -C "your-email@example.com"

# 公開鍵を表示
cat ~/.ssh/id_ed25519.pub
```

表示された公開鍵を [GitHub Settings → SSH Keys](https://github.com/settings/keys) に追加。

### 2.2 リポジトリのクローン

```bash
cd ~
git clone git@github.com:sudolifeagain/ajmun-x.git
cd ajmun-x
```

### 2.3 環境変数の設定

```bash
touch .env
nano .env
```

```env
# Discord設定
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_REDIRECT_URI=https://ajmun37.re4lity.com/api/auth/discord/callback

# データベース
DATABASE_URL="file:./prod.db"

# QRコード署名
QR_SECRET=your_random_secret_32chars_or_more
```

### 2.3 依存関係のインストールとビルド

```bash
npm install
npx prisma generate
npx prisma db push
npm run build
```

### 2.4 PM2 でプロセス管理

```bash
# Next.js アプリ起動
pm2 start npm --name "ajmun-web" -- start

# Discord Bot 起動
pm2 start npm --name "ajmun-bot" -- run bot

# 自動起動設定
pm2 startup
pm2 save

# pm2 startup で表示されるコマンドを実行 (例)
sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v22.21.1/bin /home/ubuntu/.nvm/versions/node/v22.21.1/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 2.5 Nginx リバースプロキシ (推奨)

```bash
sudo apt install -y nginx

sudo nano /etc/nginx/conf.d/ajmun.conf
```

```nginx
server {
    listen 80;
    server_name ajmun37.re4lity.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 3. Cloudflare DNS 設定

### 3.1 サブドメインの追加

`re4lity.com` は既に Cloudflare で管理されているため、サブドメインの A レコードを追加するだけで OK。

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. `re4lity.com` を選択
3. **DNS** → **レコード** → **レコードを追加**

| タイプ | 名前 | 内容 | プロキシ |
|-------|------|------|---------|
| A | ajmun37 | OCI パブリック IP | プロキシ済み (オレンジ雲) |

### 3.2 SSL/TLS 設定

1. **SSL/TLS** → **概要**
2. モードを **フル** に設定 (Let's Encrypt を使わない場合)
3. **Edge 証明書** → **常に HTTPS を使用** を有効化

---

## 4. Cloudflare Access 設定

### 4.1 Zero Trust ダッシュボードへのアクセス

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) にアクセス
2. 初回は組織名を設定（例: `ajmun`）
3. **Free プラン**を選択

### 4.2 スタッフページへのアクセス制限

1. **Access** → **Applications** → **Add an application**
2. **Self-hosted** を選択
3. 以下を設定：

| 設定項目 | 値 |
|---------|-----|
| Application name | AJMUN Staff Scanner |
| Session Duration | 24 hours |
| Application domain | `ajmun37.re4lity.com` |
| Path | `/staff` |

4. **Next** をクリック

### 4.3 ポリシーの設定

1. **Policy name**: `Allow Staff`
2. **Action**: `Allow`
3. **Include** ルール:
   - **Selector**: `Emails`
   - **Value**: スタッフのメールアドレスをカンマ区切りで入力
   
   または
   
   - **Selector**: `Emails ending in`
   - **Value**: `@your-organization.com` (ドメイン全体を許可)

4. **Save** をクリック

### 4.4 認証方法の設定 (オプション)

1. **Settings** → **Authentication**
2. **Login methods** で以下を追加可能:
   - **One-time PIN** (メール OTP) - デフォルト有効
   - **Google** (Google Workspace 連携)
   - **GitHub** (GitHub 組織連携)

### 4.5 動作確認

1. シークレットウィンドウで `https://ajmun37.re4lity.com/staff` にアクセス
2. Cloudflare のログイン画面が表示されることを確認
3. 許可されたメールアドレスでログイン
4. スキャナーページにアクセスできることを確認

---

## トラブルシューティング

### ログ確認

```bash
# アプリログ（直近30行）
pm2 logs ajmun-web --lines 30

# エラーログのみ
pm2 logs ajmun-web --err --lines 20

# ログをクリア
pm2 flush
```

### PM2 プロセス管理

```bash
# ステータス確認
pm2 status

# 再起動
pm2 restart all

# 完全停止して再起動（環境変数を更新）
pm2 delete all
pm2 start npm --name "ajmun-web" -- start
pm2 start npm --name "ajmun-bot" -- run bot

# プロセス保存（再起動後も自動起動）
pm2 save
```

### データベース確認

```bash
# テーブル一覧
sqlite3 ~/ajmun-x/prisma/prod.db ".tables"

# ユーザー確認
sqlite3 ~/ajmun-x/prisma/prod.db "SELECT discordUserId, globalName FROM User;"

# QRトークン形式確認
sqlite3 ~/ajmun-x/prisma/prod.db "SELECT substr(qrToken, 1, 30) FROM User LIMIT 3;"

# 出席ログ確認
sqlite3 ~/ajmun-x/prisma/prod.db "SELECT * FROM AttendanceLog;"
```

### Prisma クリーンビルド

```bash
cd ~/ajmun-x
rm -rf node_modules/.prisma .next
npx prisma generate
npm run build
pm2 restart all
```

### データベースリセット

```bash
cd ~/ajmun-x

# 1. アプリを停止
pm2 stop all

# 2. 既存のデータベースを削除
rm -f prisma/prod.db

# 3. 新しいデータベースを作成
npx prisma db push

# 4. アプリを再起動
pm2 restart all
```

> ⚠️ **注意**: データベースリセットを実行すると、すべてのユーザーデータ、出席ログ、設定が削除されます。

### ユーザー再同期（出席ログ・設定を保持）

出席ログと設定を残したまま、ユーザー情報だけを再同期する場合：

```bash
cd ~/ajmun-x

# ユーザーテーブルのみクリア
sqlite3 prisma/prod.db "DELETE FROM UserGuildMembership; DELETE FROM User;"

# Bot を再起動（自動でユーザーが再同期される）
pm2 restart ajmun-bot
```

> 💡 Bot 起動時に全サーバーのメンバーが自動同期されるため、ユーザーデータは復元されます。

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

### iptables ルール追加

```bash
# ポート 80/443 を開放（REJECT ルールを削除してから追加）
sudo iptables -D INPUT -j REJECT --reject-with icmp-host-prohibited
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -j REJECT --reject-with icmp-host-prohibited

# ルールを永続化
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
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
curl -I -H "Host: ajmun37.re4lity.com" http://localhost
```

### Git 更新とデプロイ

```bash
cd ~/ajmun-x
git pull
npm run build
pm2 restart all
```

### Cloudflare Access が機能しない

1. DNS がプロキシ済み (オレンジ雲) になっているか確認
2. Application の Path が正しいか確認
3. ブラウザのキャッシュをクリア

---

## 5. セキュリティ強化

### 5.1 ファイル権限

```bash
chmod 600 ~/ajmun-x/.env
```

### 5.2 iptables 永続化

```bash
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

### 5.3 Nginx セキュリティヘッダー

`/etc/nginx/conf.d/ajmun.conf` に以下を追加：

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5.4 SSH セキュリティ強化

`/etc/ssh/sshd_config` の設定：

```bash
# 認証
MaxAuthTries 3
PubkeyAuthentication yes
PasswordAuthentication no
PermitRootLogin no

# タイムアウト（10分で自動切断）
ClientAliveInterval 300
ClientAliveCountMax 2

# 不要な機能を無効化
X11Forwarding no
AllowAgentForwarding no
```

```bash
sudo systemctl restart ssh
```

### 5.5 fail2ban（ブルートフォース対策）

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 状態確認
sudo fail2ban-client status sshd
```

### 5.6 自動セキュリティアップデート

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 参考リンク

- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
- [Cloudflare Access ドキュメント](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [PM2 ドキュメント](https://pm2.keymetrics.io/docs/usage/quick-start/)

