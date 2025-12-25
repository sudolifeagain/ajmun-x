/**
 * Slash Command Definitions
 *
 * This file contains all slash command definitions for the Discord bot.
 * Separated from index.ts for better maintainability.
 */

import { SlashCommandBuilder } from "discord.js";

/**
 * Attribute choices used in attendance commands
 */
const attributeChoices = [
    { name: "そのほか", value: "participant" },
    { name: "会議フロント", value: "organizer" },
    { name: "事務局員", value: "staff" },
] as const;

/**
 * Config key choices used in system commands
 */
const configKeyChoices = [
    { name: "事務局員ロールID", value: "staff_role_ids" },
    { name: "会議フロントロールID", value: "organizer_role_ids" },
    { name: "bot管理者ロールID", value: "admin_role_ids" },
    { name: "会議サーバーID", value: "target_guild_ids" },
] as const;

/**
 * /attendance command definition
 */
const attendanceCommand = new SlashCommandBuilder()
    .setName("attendance")
    .setDescription("出席状況を確認")
    .addSubcommand((sub) =>
        sub
            .setName("status")
            .setDescription("出席状況サマリーを表示")
            .addStringOption((opt) =>
                opt
                    .setName("conference")
                    .setDescription("会議名 (all で全会議)")
                    .setRequired(false)
                    .setAutocomplete(true)
            )
            .addStringOption((opt) =>
                opt
                    .setName("attribute")
                    .setDescription("属性で絞り込み")
                    .setRequired(false)
                    .addChoices(...attributeChoices)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName("present")
            .setDescription("本日出席済みユーザー一覧")
            .addStringOption((opt) =>
                opt
                    .setName("conference")
                    .setDescription("会議名 (all で全会議)")
                    .setRequired(false)
                    .setAutocomplete(true)
            )
            .addStringOption((opt) =>
                opt
                    .setName("attribute")
                    .setDescription("属性で絞り込み")
                    .setRequired(false)
                    .addChoices(...attributeChoices)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName("absent")
            .setDescription("本日未出席ユーザー一覧")
            .addStringOption((opt) =>
                opt
                    .setName("conference")
                    .setDescription("会議名 (all で全会議)")
                    .setRequired(false)
                    .setAutocomplete(true)
            )
            .addStringOption((opt) =>
                opt
                    .setName("attribute")
                    .setDescription("属性で絞り込み")
                    .setRequired(false)
                    .addChoices(...attributeChoices)
            )
    );

/**
 * /system command definition
 */
const systemCommand = new SlashCommandBuilder()
    .setName("system")
    .setDescription("システム設定 (bot管理者のみ)")
    .addSubcommand((sub) =>
        sub
            .setName("config")
            .setDescription("設定を変更")
            .addStringOption((opt) =>
                opt
                    .setName("key")
                    .setDescription("設定キー")
                    .setRequired(true)
                    .addChoices(...configKeyChoices)
            )
            .addStringOption((opt) =>
                opt
                    .setName("value")
                    .setDescription("設定値 (カンマ区切りで複数指定可)")
                    .setRequired(true)
            )
    )
    .addSubcommand((sub) =>
        sub.setName("show").setDescription("現在の設定を表示")
    )
    .addSubcommand((sub) =>
        sub.setName("sync").setDescription("全サーバーのメンバーを同期")
    )
    .addSubcommand((sub) =>
        sub
            .setName("delete")
            .setDescription("設定を削除")
            .addStringOption((opt) =>
                opt
                    .setName("key")
                    .setDescription("削除する設定キー")
                    .setRequired(true)
                    .addChoices(...configKeyChoices)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName("send-qr")
            .setDescription("QRコードをDM送信")
            .addStringOption((opt) =>
                opt
                    .setName("target")
                    .setDescription("送信対象")
                    .setRequired(true)
                    .addChoices(
                        { name: "全員", value: "all" },
                        { name: "そのほか", value: "participant" },
                        { name: "会議フロント", value: "organizer" },
                        { name: "事務局員", value: "staff" },
                        { name: "テスト（指定ユーザーのみ）", value: "test" }
                    )
            )
            .addStringOption((opt) =>
                opt
                    .setName("user_ids")
                    .setDescription("テスト送信時のユーザーID（カンマ区切りで複数可）")
                    .setRequired(false)
            )
            .addBooleanOption((opt) =>
                opt
                    .setName("retry_failed")
                    .setDescription("以前失敗したユーザーのみ再送信")
                    .setRequired(false)
            )
    )
    .addSubcommand((sub) =>
        sub.setName("dm-status").setDescription("DM送信状況を確認")
    );

/**
 * /setup command definition (initial configuration)
 */
const setupCommand = new SlashCommandBuilder()
    .setName("setup")
    .setDescription("初期設定 (bot管理者未設定時は誰でも実行可)")
    .addSubcommand((sub) =>
        sub
            .setName("target-guild")
            .setDescription("対象ギルドを設定")
            .addBooleanOption((opt) =>
                opt.setName("enable").setDescription("有効/無効").setRequired(true)
            )
            .addStringOption((opt) =>
                opt
                    .setName("guild_id")
                    .setDescription("他サーバーのID（省略時は現在のサーバー）")
                    .setRequired(false)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName("operation-server")
            .setDescription("運営サーバーを設定")
            .addBooleanOption((opt) =>
                opt.setName("enable").setDescription("有効/無効").setRequired(true)
            )
            .addStringOption((opt) =>
                opt
                    .setName("guild_id")
                    .setDescription("他サーバーのID（省略時は現在のサーバー）")
                    .setRequired(false)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName("admin-roles")
            .setDescription("bot管理者ロールを設定")
            .addStringOption((opt) =>
                opt
                    .setName("roles")
                    .setDescription("ロールID (カンマ区切りで複数指定可)")
                    .setRequired(true)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName("staff-roles")
            .setDescription("事務局員ロールを設定")
            .addStringOption((opt) =>
                opt
                    .setName("roles")
                    .setDescription("ロールID (カンマ区切りで複数指定可)")
                    .setRequired(true)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName("organizer-roles")
            .setDescription("会議フロントロールを追加")
            .addStringOption((opt) =>
                opt
                    .setName("roles")
                    .setDescription("ロールID (カンマ区切りで複数指定可)")
                    .setRequired(true)
            )
            .addStringOption((opt) =>
                opt
                    .setName("guild_ids")
                    .setDescription("対象サーバーID (カンマ区切り、省略時は全サーバー)")
                    .setRequired(false)
            )
    )
    .addSubcommand((sub) =>
        sub.setName("status").setDescription("現在のサーバー設定を表示")
    );

/**
 * /help command definition
 */
const helpCommand = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Botの使い方を表示");

/**
 * All slash commands for registration
 */
export const commands = [attendanceCommand, systemCommand, setupCommand, helpCommand];

