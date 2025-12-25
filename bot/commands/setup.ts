/**
 * Setup Command Handler
 *
 * Handles /setup command for initial configuration.
 * Permission: Anyone can run if admin_role_ids is not set,
 *             otherwise only users with admin roles can run.
 */

import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import prisma from "../../app/lib/prisma";
import logger from "../utils/discordLogger";
import { hasAdminPermission } from "../services/permissionService";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if setup commands are locked (admin_role_ids is configured)
 */
async function isSetupLocked(): Promise<boolean> {
    const adminConfig = await prisma.systemConfig.findUnique({
        where: { key: "admin_role_ids" },
    });
    return !!adminConfig?.value;
}

/**
 * Get log context from Discord user
 */
function getLogContext(user: { id: string; username: string }) {
    return {
        discordUser: { id: user.id, name: user.username },
        source: "Bot (Setup)" as const,
    };
}

// ============================================================================
// Subcommand Handlers
// ============================================================================

/**
 * Handle /setup target-guild subcommand
 */
async function handleTargetGuild(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const enable = interaction.options.getBoolean("enable", true);
    const guildId = interaction.guildId!;

    await prisma.guild.update({
        where: { guildId },
        data: { isTargetGuild: enable },
    });

    await interaction.reply({
        content: `✅ このサーバーを対象ギルドとして${enable ? "設定" : "解除"}しました`,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info(`対象ギルド${enable ? "設定" : "解除"}`, {
        ...getLogContext(interaction.user),
        details: `サーバー: ${interaction.guild?.name}`,
    });
}

/**
 * Handle /setup operation-server subcommand
 */
async function handleOperationServer(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const enable = interaction.options.getBoolean("enable", true);
    const guildId = interaction.guildId!;

    await prisma.guild.update({
        where: { guildId },
        data: { isOperationServer: enable },
    });

    await interaction.reply({
        content: `✅ このサーバーを運営サーバーとして${enable ? "設定" : "解除"}しました`,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info(`運営サーバー${enable ? "設定" : "解除"}`, {
        ...getLogContext(interaction.user),
        details: `サーバー: ${interaction.guild?.name}`,
    });
}

/**
 * Handle /setup admin-roles subcommand
 */
async function handleAdminRoles(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const roles = interaction.options.getString("roles", true);

    await prisma.systemConfig.upsert({
        where: { key: "admin_role_ids" },
        update: { value: roles },
        create: { key: "admin_role_ids", value: roles, description: "管理者ロールID" },
    });

    await interaction.reply({
        content: `✅ 管理者ロールを設定しました: \`${roles}\`\n⚠️ 以降、/setup コマンドは管理者ロール保持者のみ実行可能です`,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info("管理者ロール設定", {
        ...getLogContext(interaction.user),
        details: `ロールID: ${roles}`,
    });
}

/**
 * Handle /setup staff-roles subcommand
 */
async function handleStaffRoles(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const roles = interaction.options.getString("roles", true);

    await prisma.systemConfig.upsert({
        where: { key: "staff_role_ids" },
        update: { value: roles },
        create: { key: "staff_role_ids", value: roles, description: "スタッフロールID" },
    });

    await interaction.reply({
        content: `✅ スタッフロールを設定しました: \`${roles}\``,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info("スタッフロール設定", {
        ...getLogContext(interaction.user),
        details: `ロールID: ${roles}`,
    });
}

/**
 * Handle /setup status subcommand
 */
async function handleStatus(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const guildId = interaction.guildId!;

    const guild = await prisma.guild.findUnique({
        where: { guildId },
    });

    const adminConfig = await prisma.systemConfig.findUnique({
        where: { key: "admin_role_ids" },
    });

    const staffConfig = await prisma.systemConfig.findUnique({
        where: { key: "staff_role_ids" },
    });

    const embed = new EmbedBuilder()
        .setTitle("⚙️ サーバー設定状況")
        .setColor(0x5865f2)
        .addFields(
            {
                name: "対象ギルド",
                value: guild?.isTargetGuild ? "✅ 有効" : "❌ 無効",
                inline: true,
            },
            {
                name: "運営サーバー",
                value: guild?.isOperationServer ? "✅ 有効" : "❌ 無効",
                inline: true,
            },
            {
                name: "セットアップロック",
                value: adminConfig?.value ? "🔒 ロック済み" : "🔓 未ロック（誰でも設定可能）",
                inline: true,
            },
            {
                name: "管理者ロール",
                value: adminConfig?.value || "未設定",
                inline: false,
            },
            {
                name: "スタッフロール",
                value: staffConfig?.value || "未設定",
                inline: false,
            }
        )
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.SuppressNotifications,
    });
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Handle /setup command
 */
export async function handleSetup(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    // Permission check: if admin_role_ids is set, require admin permission
    const locked = await isSetupLocked();
    if (locked) {
        const hasPermission = await hasAdminPermission(interaction.user.id);
        if (!hasPermission) {
            await interaction.reply({
                content: "❌ このコマンドは管理者ロール保持者のみ実行可能です",
                ephemeral: true,
            });
            return;
        }
    }

    switch (subcommand) {
        case "target-guild":
            await handleTargetGuild(interaction);
            break;
        case "operation-server":
            await handleOperationServer(interaction);
            break;
        case "admin-roles":
            await handleAdminRoles(interaction);
            break;
        case "staff-roles":
            await handleStaffRoles(interaction);
            break;
        case "status":
            await handleStatus(interaction);
            break;
    }
}
