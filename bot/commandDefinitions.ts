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
    { name: "参加者", value: "participant" },
    { name: "会議フロント", value: "organizer" },
    { name: "スタッフ", value: "staff" },
] as const;

/**
 * Config key choices used in system commands
 */
const configKeyChoices = [
    { name: "スタッフロールID", value: "staff_role_ids" },
    { name: "会議フロントロールID", value: "organizer_role_ids" },
    { name: "管理者ロールID", value: "admin_role_ids" },
    { name: "運営サーバーID", value: "operation_guild_id" },
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
    .setDescription("システム設定 (管理者のみ)")
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
    );

/**
 * All slash commands for registration
 */
export const commands = [attendanceCommand, systemCommand];
