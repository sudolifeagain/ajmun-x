# AJMUN 開発環境セットアップガイド

このドキュメントでは、ローカル開発環境のセットアップ手順を詳しく説明します。

## 前提条件

- Node.js 18.x 以上
- npm または pnpm
- Discordアカウント（開発者ポータルへのアクセス権）

---

## 1. Discord アプリケーションの作成

### 1.1 Discord Developer Portal へアクセス

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 右上の「New Application」をクリック
3. アプリケーション名を入力（例: `AJMUN Entry System`）
4. 利用規約に同意して「Create」

### 1.2 OAuth2 設定

1. 左メニューから **OAuth2** → **General** を選択
2. 以下の情報をメモしておく:
   - **Client ID**: `DISCORD_CLIENT_ID` として使用
   - **Client Secret**: 「Reset Secret」をクリックして生成 → `DISCORD_CLIENT_SECRET` として使用

3. **Redirects** セクションで「Add Redirect」をクリック:
   ```
   http://localhost:3000/api/auth/discord/callback
   ```

### 1.3 Bot の作成

1. 左メニューから **Bot** を選択
2. 「Add Bot」をクリック（既に作成済みの場合はスキップ）
3. **TOKEN** セクションの「Reset Token」をクリック
4. 表示されたトークンをコピー → `DISCORD_BOT_TOKEN` として使用

> ⚠️ **重要**: トークンは一度しか表示されません。必ずメモしてください。

### 1.4 Bot の権限設定

1. **Privileged Gateway Intents** セクションで以下を有効化:
   - ✅ **SERVER MEMBERS INTENT**

2. 「Save Changes」をクリック

### 1.5 Bot をサーバーに招待

1. 左メニューから **OAuth2** → **URL Generator** を選択
2. **SCOPES** で `bot` にチェック
3. **BOT PERMISSIONS** で以下にチェック:
   - ✅ View Channels
4. 生成されたURLをブラウザで開き、対象サーバーにBotを追加

---

## 2. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成:

```bash
# Discord OAuth2 設定
DISCORD_CLIENT_ID=あなたのClient ID
DISCORD_CLIENT_SECRET=あなたのClient Secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback

# Discord Bot 設定
DISCORD_BOT_TOKEN=あなたのBot Token

# データベース設定
DATABASE_URL=file:./prisma/dev.db

# QRコード署名用シークレット（任意の文字列）
QR_SECRET=your-super-secret-key-change-this

# 本番環境用（オプション）
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 環境変数一覧

| 変数名 | 説明 | 取得場所 |
|--------|------|----------|
| `DISCORD_CLIENT_ID` | OAuth2用クライアントID | Developer Portal → OAuth2 |
| `DISCORD_CLIENT_SECRET` | OAuth2用シークレット | Developer Portal → OAuth2 |
| `DISCORD_REDIRECT_URI` | OAuthコールバックURL | 自分で設定 |
| `DISCORD_BOT_TOKEN` | Bot認証トークン | Developer Portal → Bot |
| `DATABASE_URL` | SQLiteデータベースパス | 自分で設定 |
| `QR_SECRET` | QRトークン署名用キー | 自分で生成（ランダム文字列推奨） |

---

## 3. プロジェクトのセットアップ

### 3.1 依存関係のインストール

```bash
npm install
```

### 3.2 データベースの初期化

```bash
# マイグレーションを実行
npx prisma migrate dev

# （オプション）Prisma Studioでデータ確認
npx prisma studio
```

---

## 4. ローカルでの起動

### 4.1 Web サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセス

### 4.2 Discord Bot の起動（別ターミナル）

```bash
npm run bot
```

Bot が正常に起動すると、コンソールに以下が表示されます:
```
Bot logged in as AJMUN Entry System#1234
Registering slash commands...
Slash commands registered.
```

---

## 5. 動作確認

### 5.1 ユーザーフロー

1. http://localhost:3000 にアクセス
2. 「Discordでログイン」をクリック
3. Discord認証画面で「認証」
4. QRコード画面が表示されれば成功

### 5.2 スキャナーフロー

1. http://localhost:3000/staff にアクセス
2. カメラ許可を与える
3. QRコードをスキャン
4. ユーザー情報とステータスが表示される

### 5.3 Bot コマンド

Discordサーバーで以下のコマンドを試す:
- `/attendance status` - 出席状況サマリー（staff権限以上）
- `/attendance present` - 出席者一覧（staff権限以上）
- `/attendance absent` - 未出席者一覧（staff権限以上）
- `/system sync` - メンバー同期（staff権限以上）
- `/system show` - 現在の設定表示（admin権限）
- `/system config` - 設定変更（admin権限）

---

## 6. 権限システムの初期設定

Bot コマンドには権限が必要です。初回セットアップでは、データベースに直接管理者ロールを登録する必要があります。

### 6.1 管理者ロールIDの取得

1. Discordの **開発者モード** を有効化
   - ユーザー設定 → 詳細設定 → 開発者モード を ON
2. 運営サーバーで管理者ロールを右クリック → 「IDをコピー」

### 6.2 データベースに初期設定を投入

```bash
# ローカル環境
sqlite3 prisma/dev.db "INSERT INTO SystemConfig (key, value, description) VALUES ('admin_role_ids', 'ここにロールID', '管理者ロール');"

# 本番環境
sqlite3 prisma/prod.db "INSERT INTO SystemConfig (key, value, description) VALUES ('admin_role_ids', 'ここにロールID', '管理者ロール');"
```

> ⚠️ **重要**: この初期設定を行わないと、誰も `/system config` を実行できません。

### 6.3 その他の設定（Discordから実行）

初期管理者の設定後、以下は Discord から設定できます：

```
/system config operation_guild_id <運営サーバーID>
/system config staff_role_ids <スタッフロールID>
/system config organizer_role_ids <会議運営者ロールID>
/system config target_guild_ids <会議サーバーID1>,<会議サーバーID2>
```

### 6.4 権限階層

| 権限レベル | 使用可能コマンド | 設定キー |
|-----------|-----------------|---------|
| なし | 不可 | - |
| staff | `/attendance *`, `/system sync` | `staff_role_ids` |
| admin | 上記 + `/system config`, `/system show` | `admin_role_ids` |

---


## 7. トラブルシューティング

### OAuth エラー: `invalid_redirect_uri`

- Developer Portal の Redirects に `http://localhost:3000/api/auth/discord/callback` が登録されているか確認
- `.env` の `DISCORD_REDIRECT_URI` と一致しているか確認

### Bot コマンドが表示されない

- Botに `applications.commands` スコープがあるか確認
- サーバーへの招待URLに `bot` と `applications.commands` が含まれているか確認
- コマンド登録には最大1時間かかることがある（グローバルコマンドの場合）

### データベースエラー

```bash
# データベースをリセット
npx prisma migrate reset
```

### Prisma Client エラー

```bash
# クライアントを再生成
npx prisma generate
```

---

## 8. 本番環境へのデプロイ

### 環境変数の変更点

```bash
DISCORD_REDIRECT_URI=https://your-domain.com/api/auth/discord/callback
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

Developer Portal の Redirects にも本番URLを追加してください。

### ビルドと起動

```bash
# ビルド（Webpackモード）
npx next build --webpack

# 起動
npm start

# Bot（別プロセス）
npm run bot
```
