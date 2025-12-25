---
title: "Discord連携QRコード入退場管理システムを開発した"
description: 300人規模の会議の参加者管理システムを無料で運用した話
date: 2025-12-25T17:00:00+09:00
image: image.png
math: false
license: false
hidden: true
comments: false
draft: false
categories: tech
slug: ajmun37-reception
tags: 
    - Next.js
    - Discord
    - TypeScript
    - Prisma
    - OCI
---
## はじめに
第37回 模擬国連会議全日本大会の入退場管理システムを開発しました。Discord OAuth認証とQRコードを組み合わせた、会議向けのシステムです。

## 開発の背景
一般的な会議の参加者管理では、参加費の支払状況の確認などを行う場合がありますが、本大会では全参加者が支払い済みであることを前提としています。そのため、受付業務の目的はシンプルに「今日、誰が来ていて、誰がまだ来ていないのか」を把握することにあります。

以前は、会議の設計・運営を担当する会議フロントが、参加者（デリ）の受付業務を兼任していました。しかし、この運用にはいくつかの課題がありました。

1. **物理的な制約と混雑**: 6つの会議の受付を一箇所で行うには会場の間口が狭く、参加者が集中すると廊下まで溢れるほどの混雑が発生していました。
2. **アナログな運用による遅延**: スプレッドシートを用いた手動の記録方式だったため、参加者一人ひとりのチェックインに時間がかかり、これが混雑に拍車をかけていました。
3. **属人化とリスク**: 受付担当者が特定の役職（会議フロント）に固定されていたため、担当者が遅刻するなどした場合、代わりに誰が受付をするのかをその場で調整する必要があり、運営上の負担となっていました。

これらのペインを解消し、スムーズかつ属人化しない受付フローを構築するために、本システムの開発に至りました。

## 技術スタック
- **フロントエンド**: Next.js 15, React, TailwindCSS
- **バックエンド**: Next.js API Routes
- **データベース**: SQLite (Prisma ORM)
- **認証**: Discord OAuth2
- **Bot**: Discord.js
- **配布**: Discord DM (MessageFlags.SuppressNotifications)
- **インフラ**: Oracle Cloud Infrastructure (OCI) Free Tier
- **CDN/セキュリティ**: Cloudflare (Access含む)

## 主な機能

### 1. DMによるQRコード一斉配布（プッシュ型）
開発当初は、参加者がWebサイトにログインしてQRコードを表示する「プル型」を想定していましたが、Discordは基本ログインした状態のため、パスワードを覚えていない人が想定よりも多く、受付時のボトルネックになる懸念がありました。

そこで、Botから参加者全員のDMへQRコードを直接送りつける「プッシュ型」への転換を行いました。

- **一斉送信**: 管理者コマンド `/system send-qr` で300名規模の参加者に一括送信
- **サイレント送信**: `MessageFlags.SuppressNotifications` を使用し、スマホの通知を鳴らさずに"そっと"チケットを届ける配慮
- **Webログイン併用**: DMを受け取れない設定のユーザー向けに、Webログインによる表示もフォールバックとして残存

これにより、当日は「スマホの画面（DM）を見せるだけ」という極めてスムーズな体験を実現しました。

### 2. Discord OAuth 認証と権限管理
フォールバックとしてのWebログイン機能では、Discord APIからユーザー情報を取得し、所属サーバーとロールに基づいて権限を決定します。

```typescript
// OAuth callback で所属サーバーを確認
const membership = await prisma.userGuildMembership.findFirst({
    where: { discordUserId, guildId: targetGuildId }
});

// スタッフロールIDと照合
const staffRoleIds = staffConfig.value.split(",");
if (userRoles.some(roleId => staffRoleIds.includes(roleId))) {
    primaryAttribute = "staff";
}
```

SystemConfig テーブルに保存された staff_role_ids と、Botが同期したメンバーのロール情報を照合することで、柔軟な権限管理を実現しています。

### 3. 3層の権限システム
本システムでは、以下の3層の権限レベルを実装しています。

| 権限レベル | 対象 | 使用可能なコマンド |
|---|---|---|
| admin | Bot管理者 | すべてのコマンド (/system config, /setup 等) |
| staff | 事務局員 | /attendance, /system sync |
| organizer | 会議フロント | /attendance（自分の会議のみ） |

会議フロント（organizer）は、自分が所属する会議サーバーの出席状況のみ閲覧できるよう、権限をスコープしています。これにより、各会議の運営者は自分の責任範囲の情報のみにアクセスでき、セキュリティとプライバシーを確保しています。

```typescript
// organizer は自分の会議のみ閲覧可能
export async function getOrganizerGuildIds(userId: string): Promise<string[] | null> {
    const level = await getUserPermissionLevel(userId);
    if (level === "staff" || level === "admin") return []; // 全ギルドアクセス可
    if (level === "none") return null;
    // organizer - 所属ギルドのみ
    const memberships = await prisma.userGuildMembership.findMany({...});
    return organizerGuildIds;
}
```

### 4. QRコード発行とセキュリティ
SHA256ハッシュを用いた署名付きトークンを生成し、QRコードとして表示します。
DMで配布したQRコードと、Webログイン後に表示されるQRコードは、**整合性が保たれる（同じトークンが維持される）**設計となっており、どの経路で取得しても問題なくチェックイン可能です。

```typescript
// トークン生成（ランダムその値を含めて推測・リプレイ攻撃防止）
const payload = `${userId}:${Date.now()}:${randomBytes(16)}`;
const signature = sha256(`${payload}:${QR_SECRET}`).slice(0, 16);
return `${base64url(payload)}.${signature}`;
```

### 5. UX/UIへのこだわり
参加者やスタッフがストレスなく利用できるよう、以下の点にこだわりました。

- **ダークモード採用**: 会場の照明が暗くても目に優しい slate/purple のグラデーション背景。
- **直感的なスキャナー**: html5-qrcode を使用し、15fpsでスキャン。振動フィードバック（成功/重複/エラー）で手元を見なくても状況を把握可能。
- **誤操作防止**: スキャン結果の自動リセットやダブルタップ削除機能。

### 6. Discord Bot (Interactive)
出席状況の確認やシステム管理は、全てDiscordのSlashコマンドで完結します。
新しく実装した **`/help` コマンド** では、セレクトメニュー（プルダウン）を用いて、インタラクティブにコマンドの使い方が確認できるようになりました。権限を持たない一般参加者でも閲覧可能です。

**出席管理コマンド (/attendance)**
- `/attendance status`: 本日の出席状況サマリーを表示
  - `conference`: 特定の会議（サーバー）に絞り込み
  - `attribute`: 参加者属性（staff/organizer等）で絞り込み
- `/attendance present`: 出席済みユーザー一覧を表示
- `/attendance absent`: 未出席ユーザー一覧を表示

**システム管理コマンド (/system)** ※管理者専用
- `/system send-qr`: QRコードの一斉送信（ターゲット指定可、再送オプションあり）
- `/system dm-status`: DM送信の進捗確認
- `/system sync`: 全サーバーのメンバー情報を手動同期
- `/system config`: 詳細設定の手動変更

**初期設定コマンド (/setup)**
従来はデータベースを直接操作して設定していた項目を、すべてDiscord上から設定可能にしました。
特に `guild_id` オプションにより、Botを招待した直後の遠隔サーバーの設定も可能です。

- `/setup target-guild`: このサーバーを「会議サーバー（出席管理対象）」として登録
  - `guild_id`: （オプション）遠隔地のサーバーIDを指定可能
- `/setup operation-server`: このサーバーを「運営サーバー（管理用）」として登録
- `/setup admin-roles`: Bot管理者のロールIDを設定
- `/setup staff-roles`: 事務局員（受付担当）のロールIDを設定
- `/setup organizer-roles`: 会議フロント（各会議責任者）のロールIDを追加
- `/setup status`: 現在のサーバー設定状況を表示

### 7. Google Sheets連携（強化版）
出席データをGoogle Sheetsに自動同期するAPIエンドポイントを実装しました。
特にDM配布に関しては、**「いつ、何回送ったか」** の履歴をすべてトラッキングしており、カンマ区切りでタイムスタンプをスプレッドシートに反映させることで、送信トラブルの調査を容易にしています。

```typescript
// /api/attendance-export
// 複数日付対応のエクスポートAPI
const dates = multiDates
    ? multiDates.split(",").map(d => d.trim())
    : [singleDate || getTodayJST()];
return NextResponse.json({
    dates,
    members,  // 各メンバーの attendanceByDate を含む
    guilds,
    summary: { total, attended, absent }
});
```

Google Apps Scriptと連携し、以下の機能を提供しています。

- **複数日付対応**: 4日間すべての出席状況を1枚のシートで可視化（出席日数順に自動ソート）
- **一元管理**: 全会議の参加者を1つのシートに集約し、所属会議や属性もカラムとして表示
- **複数送信ログ**: DM送信履歴を改行区切りでセル内に表示（タイムスタンプ付き）

## 苦労した点

### APIレート制限と大量送信
300名へのDM一斉送信は、Discord APIのレート制限に抵触するリスクがあります。
本システムでは、APIにレート制限を実装し、一定数（Batch Size 10）ごとに適切なウェイト（Delay 2000ms）を挟むことで、API制限を回避しつつ、数分以内に全員への配布を完了させるチューニングを行いました。

### OCI ファイアウォール設定
OCIのセキュリティリスト設定とiptablesの両方を正しく設定する必要があり、Cloudflare経由のアクセスで522エラーが発生。ルールの順序が重要でした。

### Prisma キャッシュ問題
デプロイ時にPrismaクライアントのキャッシュが原因でDBテーブルが見つからないエラーが発生。`node_modules/.prisma`と`.next`を削除してクリーンビルドが必要でした。

## 運用コスト
本システムの大きな特徴の一つが、ほぼ無料で運用可能であることです。

| サービス | 費用 | 備考 |
|---|---|---|
| Oracle Cloud (OCI) | 0円 | Always Free Tier（1GB RAM, 50GB SSD） |
| Cloudflare | 0円 | 無料プラン（CDN、DNS、Access） |
| Discord API | 0円 | Bot、OAuth2 無料 |
| GitHub | 0円 | パブリックリポジトリ |
| 独自ドメイン | 約1,000〜2,000円/年 | 唯一の有料部分 |

**総コスト: 年間約1,000〜2,000円程度**
（ドメイン取得済みなら追加費用ゼロ）

## 今後の展望

会議本番（2025年12月27日〜30日）では、約300名の参加者を迎えます。
「DMが届かない」等のトラブルにはWebログインで対応しつつ、基本的にはスマホ一つで完結するスマートな受付体験を提供する予定です。

GitHub: [ajmun-x](https://github.com/re4lity/ajmun-x)
※大会期間終了後にパブリックリポジトリ化予定