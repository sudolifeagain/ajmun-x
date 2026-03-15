/**
 * System Command Handler
 *
 * Handles /system command with subcommands: sync, config, delete, show, send-qr, dm-status
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
import { syncAllGuilds, hasStaffPermission, hasAdminPermission, arePermissionsConfigured, getTargetUsers, sendQRCodesToUsers, getDmSendStatus } from "../services";
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
            content: `✅ 同期完了: ${result.guilds}サーバー、${result.members}メンバー（ユニーク: ${result.uniqueUsers}人）`,
        });

        await logger.info("メンバー同期実行", {
            ...getLogContext(interaction.user),
            details: `${result.guilds}サーバー、${result.members}メンバー（ユニーク: ${result.uniqueUsers}人）を同期`,
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

    // Get server configurations from Guild table
    const operationServers = await prisma.guild.findMany({
        where: { isOperationServer: true },
        select: { guildId: true, guildName: true },
    });

    const targetGuilds = await prisma.guild.findMany({
        where: { isTargetGuild: true },
        select: { guildId: true, guildName: true },
    });

    const unassignedGuilds = await prisma.guild.findMany({
        where: { isOperationServer: false, isTargetGuild: false },
        select: { guildId: true, guildName: true },
    });

    // Get role-guild mappings
    const roleMappings = await prisma.organizerRoleMapping.findMany();
    const allGuilds = await prisma.guild.findMany({
        select: { guildId: true, guildName: true },
    });
    const guildNameMap = new Map(allGuilds.map(g => [g.guildId, g.guildName]));

    const configList = configs
        .map((c) => {
            const formattedValue = formatConfigValue(c.value, c.key);
            return `**${c.key}**:\n${formattedValue}`;
        })
        .join("\n\n");

    // Format server lists
    const opServerList = operationServers.length > 0
        ? operationServers.map((g) => `• ${g.guildName}`).join("\n")
        : "未設定";

    const targetGuildList = targetGuilds.length > 0
        ? targetGuilds.map((g) => `• ${g.guildName}`).join("\n")
        : "未設定";

    const unassignedList = unassignedGuilds.length > 0
        ? unassignedGuilds.map((g) => `• ${g.guildName}`).join("\n")
        : "なし";

    // Format role-guild mappings
    const mappingList = roleMappings.length > 0
        ? roleMappings.map((m) => {
            const guildNames = m.targetGuildIds.split(",")
                .map((id: string) => guildNameMap.get(id.trim()) || id.trim())
                .join(", ");
            return `• <@&${m.roleId}> → ${guildNames}`;
        }).join("\n")
        : "なし";

    const embed = new EmbedBuilder()
        .setTitle("⚙️ システム設定")
        .setColor(0x3b82f6)
        .setDescription(configList || "ロール設定がありません")
        .addFields(
            {
                name: "🏢 運営サーバー",
                value: opServerList,
                inline: true,
            },
            {
                name: "📋 会議サーバー（出席対象）",
                value: targetGuildList,
                inline: true,
            },
            {
                name: "⚪ 未設定サーバー",
                value: unassignedList,
                inline: true,
            },
            {
                name: "🔗 ロール→会議マッピング",
                value: mappingList,
                inline: false,
            }
        )
        .setFooter({ text: "ロール: @ロール名 / ユーザー: @ユーザー名 で表示されます" })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.SuppressNotifications });

    await logger.debug("設定一覧表示", getLogContext(interaction.user));
}

// ============================================================================
// Main Exports
// ============================================================================

/**
 * Handle /system send-qr subcommand
 */
async function handleSendQr(
    interaction: ChatInputCommandInteraction,
    client: Client
): Promise<void> {
    const target = interaction.options.getString("target", true);
    const userIdsStr = interaction.options.getString("user_ids");
    const retryFailed = interaction.options.getBoolean("retry_failed") ?? false;

    // Validate test mode requires user_ids
    if (target === "test" && !userIdsStr) {
        await interaction.reply({
            content: "❌ テストモードでは `user_ids` オプションが必要です。",
            ephemeral: true,
        });
        return;
    }

    await interaction.deferReply();

    try {
        // Get target users
        const targetUsers = await getTargetUsers({
            attribute: target === "test" ? undefined : (target as "all" | "participant" | "organizer" | "staff"),
            retryFailed,
            specificUserIds: target === "test" && userIdsStr
                ? userIdsStr.split(",").map((id) => id.trim()).filter(Boolean)
                : undefined,
        });

        if (targetUsers.length === 0) {
            await interaction.editReply({
                content: "⚠️ 送信対象のユーザーが見つかりませんでした。",
            });
            return;
        }

        // Confirm the operation
        await interaction.editReply({
            content: `📤 **${targetUsers.length}人**にQRコードを送信中...\nこの処理には時間がかかる場合があります。`,
        });

        // Send QR codes with progress updates
        let lastProgressUpdate = 0;
        const result = await sendQRCodesToUsers(targetUsers, client, async (current, total) => {
            // Update progress every 10 users
            if (current - lastProgressUpdate >= 10 || current === total) {
                lastProgressUpdate = current;
                const progressPercent = Math.round((current / total) * 100);
                await interaction.editReply({
                    content: `📤 送信中... **${current}/${total}** (${progressPercent}%)`,
                }).catch(() => { }); // Ignore errors if message is too old
            }
        });

        // Final result
        const embed = new EmbedBuilder()
            .setTitle("📤 DM送信結果")
            .setColor(result.failed > 0 ? 0xf59e0b : 0x10b981)
            .addFields(
                { name: "送信対象", value: `${result.total}人`, inline: true },
                { name: "成功", value: `${result.sent}人`, inline: true },
                { name: "失敗", value: `${result.failed}人`, inline: true }
            )
            .setTimestamp();

        if (result.failedUsers.length > 0 && result.failedUsers.length <= 10) {
            embed.addFields({
                name: "失敗したユーザー",
                value: result.failedUsers
                    .slice(0, 10)
                    .map((u) => `<@${u.userId}>: ${u.error}`)
                    .join("\n"),
            });
        } else if (result.failedUsers.length > 10) {
            embed.addFields({
                name: "失敗したユーザー",
                value: `${result.failedUsers.length}人（/system dm-status で確認可能）`,
            });
        }

        await interaction.editReply({
            content: "",
            embeds: [embed],
        });

        await logger.info("QRコードDM送信", {
            ...getLogContext(interaction.user),
            details: `対象: ${target}, 成功: ${result.sent}, 失敗: ${result.failed}`,
        });
    } catch (error) {
        console.error("Send QR error:", error);
        await interaction.editReply({
            content: "❌ QRコード送信中にエラーが発生しました。",
        });
    }
}

/**
 * Handle /system dm-status subcommand
 */
async function handleDmStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    const status = await getDmSendStatus();

    const embed = new EmbedBuilder()
        .setTitle("📊 DM送信状況")
        .setColor(0x3b82f6)
        .addFields(
            { name: "合計", value: `${status.total}件`, inline: true },
            { name: "✅ 送信成功", value: `${status.sent}件`, inline: true },
            { name: "❌ 失敗", value: `${status.failed}件`, inline: true },
            { name: "⏳ 処理中", value: `${status.pending}件`, inline: true }
        )
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.SuppressNotifications,
    });
}

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
        case "send-qr":
            await handleSendQr(interaction, client);
            break;
        case "dm-status":
            await handleDmStatus(interaction);
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
