/**
 * System Command Handler
 *
 * Handles /system command with subcommands: sync, config, delete, show
 * All subcommands except sync require admin permission.
 */

import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    Client,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ButtonInteraction,
    User,
} from "discord.js";
import { prisma } from "../utils";
import { syncAllGuilds, hasStaffPermission, hasAdminPermission, arePermissionsConfigured } from "../services";
import logger from "../utils/discordLogger";

// ============================================================================
// Types & Constants
// ============================================================================

interface PendingDelete {
    key: string;
    userId: string;
    timestamp: number;
}

/** Pending delete confirmations with 5-minute timeout */
const pendingDeletes = new Map<string, PendingDelete>();

/** Delete confirmation timeout in milliseconds */
const DELETE_TIMEOUT_MS = 5 * 60 * 1000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clean up expired pending deletes
 */
function cleanupPendingDeletes(): void {
    const now = Date.now();
    for (const [id, data] of pendingDeletes.entries()) {
        if (now - data.timestamp > DELETE_TIMEOUT_MS) {
            pendingDeletes.delete(id);
        }
    }
}

/**
 * Get log context from Discord user
 */
function getLogContext(user: User) {
    return {
        discordUser: {
            id: user.id,
            name: user.username,
        },
        source: "Bot" as const,
    };
}

/**
 * Reply with permission error
 */
async function replyPermissionError(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
        content: "❌ このコマンドを実行する権限がありません。",
        ephemeral: true,
    });
}

/**
 * Format config IDs as mentions for display
 * Shows both role and user mention formats since we can't distinguish them
 */
function formatConfigValue(value: string, key: string): string {
    const ids = value.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return "`(empty)`";

    // For role/user ID configs, show as mentions
    if (key.includes("role_ids") || key.includes("user_ids")) {
        return ids.map((id) => `<@&${id}> / <@${id}>`).join("\n");
    }
    return `\`${value}\``;
}

// ============================================================================
// Subcommand Handlers
// ============================================================================

/**
 * Handle /system sync subcommand
 */
async function handleSync(
    interaction: ChatInputCommandInteraction,
    client: Client
): Promise<void> {
    // Allow sync for anyone if no permissions are configured (initial setup mode)
    const permissionsConfigured = await arePermissionsConfigured();
    if (permissionsConfigured) {
        const hasPermission = await hasStaffPermission(interaction.user.id);
        if (!hasPermission) {
            await replyPermissionError(interaction);
            return;
        }
    }

    await interaction.deferReply();

    try {
        const result = await syncAllGuilds(client.guilds.cache);
        await interaction.editReply({
            content: `✅ 同期完了: ${result.guilds}サーバー、${result.members}メンバー`,
        });

        await logger.info("メンバー同期実行", {
            ...getLogContext(interaction.user),
            details: `${result.guilds}サーバー、${result.members}メンバーを同期`,
        });
    } catch (error) {
        console.error("Sync error:", error);
        await interaction.editReply({
            content: "❌ 同期中にエラーが発生しました。",
        });
    }
}

/**
 * Handle /system config subcommand
 */
async function handleConfig(interaction: ChatInputCommandInteraction): Promise<void> {
    const key = interaction.options.getString("key", true);
    const value = interaction.options.getString("value", true);

    const existingConfig = await prisma.systemConfig.findUnique({ where: { key } });
    const isUpdate = !!existingConfig;

    await prisma.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value, description: "" },
    });

    await interaction.reply({
        content: `✅ 設定を${isUpdate ? "更新" : "追加"}しました: \`${key}\` = \`${value}\``,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info(`設定${isUpdate ? "更新" : "追加"}`, {
        ...getLogContext(interaction.user),
        details: `\`${key}\` = \`${value}\`${isUpdate ? ` (旧値: \`${existingConfig?.value}\`)` : ""}`,
    });
}

/**
 * Handle /system delete subcommand
 */
async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
    cleanupPendingDeletes();

    const key = interaction.options.getString("key", true);

    const existingConfig = await prisma.systemConfig.findUnique({ where: { key } });
    if (!existingConfig) {
        await interaction.reply({
            content: `❌ 設定 \`${key}\` は存在しません。`,
            ephemeral: true,
        });
        return;
    }

    const confirmId = `confirm_delete_${interaction.id}`;
    const cancelId = `cancel_delete_${interaction.id}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(confirmId)
            .setLabel("削除する")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(cancelId)
            .setLabel("キャンセル")
            .setStyle(ButtonStyle.Secondary)
    );

    pendingDeletes.set(interaction.id, {
        key,
        userId: interaction.user.id,
        timestamp: Date.now(),
    });

    await interaction.reply({
        content: `⚠️ 設定 \`${key}\` (値: \`${existingConfig.value}\`) を削除します。よろしいですか？`,
        components: [row],
        flags: MessageFlags.SuppressNotifications,
    });
}

/**
 * Handle /system show subcommand
 */
async function handleShow(interaction: ChatInputCommandInteraction): Promise<void> {
    const configs = await prisma.systemConfig.findMany();

    const configList = configs
        .map((c) => {
            const formattedValue = formatConfigValue(c.value, c.key);
            return `**${c.key}**:\n${formattedValue}`;
        })
        .join("\n\n");

    const embed = new EmbedBuilder()
        .setTitle("⚙️ システム設定")
        .setColor(0x3b82f6)
        .setDescription(configList || "設定がありません")
        .setFooter({ text: "ロール: @ロール名 / ユーザー: @ユーザー名 で表示されます" })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.SuppressNotifications });

    await logger.debug("設定一覧表示", getLogContext(interaction.user));
}

// ============================================================================
// Main Exports
// ============================================================================

/**
 * Handle /system command
 */
export async function handleSystem(
    interaction: ChatInputCommandInteraction,
    client: Client
): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    // Sync has special permission handling (allows anyone during initial setup)
    if (subcommand === "sync") {
        await handleSync(interaction, client);
        return;
    }

    // All other subcommands require admin permission
    const hasPermission = await hasAdminPermission(interaction.user.id);
    if (!hasPermission) {
        await replyPermissionError(interaction);
        return;
    }

    switch (subcommand) {
        case "config":
            await handleConfig(interaction);
            break;
        case "delete":
            await handleDelete(interaction);
            break;
        case "show":
            await handleShow(interaction);
            break;
    }
}

/**
 * Handle button interaction for delete confirmation
 */
export async function handleSystemButton(interaction: ButtonInteraction): Promise<boolean> {
    const customId = interaction.customId;

    if (!customId.startsWith("confirm_delete_") && !customId.startsWith("cancel_delete_")) {
        return false;
    }

    const interactionId = customId.replace("confirm_delete_", "").replace("cancel_delete_", "");
    const pendingDelete = pendingDeletes.get(interactionId);

    if (!pendingDelete) {
        await interaction.update({
            content: "❌ この操作は期限切れです。再度コマンドを実行してください。",
            components: [],
        });
        return true;
    }

    // Verify the same user is clicking the button
    if (pendingDelete.userId !== interaction.user.id) {
        await interaction.reply({
            content: "❌ この操作はコマンドを実行したユーザーのみ行えます。",
            ephemeral: true,
        });
        return true;
    }

    if (customId.startsWith("confirm_delete_")) {
        const existingConfig = await prisma.systemConfig.findUnique({
            where: { key: pendingDelete.key },
        });

        await prisma.systemConfig.delete({
            where: { key: pendingDelete.key },
        });

        pendingDeletes.delete(interactionId);

        await interaction.update({
            content: `🗑️ 設定 \`${pendingDelete.key}\` を削除しました。`,
            components: [],
        });

        await logger.warn("設定削除", {
            ...getLogContext(interaction.user),
            details: `\`${pendingDelete.key}\` = \`${existingConfig?.value}\` を削除`,
        });
    } else {
        pendingDeletes.delete(interactionId);
        await interaction.update({
            content: "❌ 削除をキャンセルしました。",
            components: [],
        });
    }

    return true;
}
