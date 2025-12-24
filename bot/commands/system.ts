import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    Client,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ButtonInteraction,
} from "discord.js";
import { prisma } from "../utils";
import { syncAllGuilds, hasStaffPermission, hasAdminPermission, arePermissionsConfigured } from "../services";
import logger from "../utils/discordLogger";

// Map for pending delete confirmations
const pendingDeletes = new Map<string, { key: string; userId: string; timestamp: number }>();

// Clean up old pending deletes (older than 5 minutes)
function cleanupPendingDeletes(): void {
    const now = Date.now();
    for (const [id, data] of pendingDeletes.entries()) {
        if (now - data.timestamp > 5 * 60 * 1000) {
            pendingDeletes.delete(id);
        }
    }
}

/**
 * Handle /system command
 */
export async function handleSystem(
    interaction: ChatInputCommandInteraction,
    client: Client
): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    // Check permissions based on subcommand
    if (subcommand === "sync") {
        // Allow sync for anyone if no permissions are configured (initial setup mode)
        const permissionsConfigured = await arePermissionsConfigured();
        if (permissionsConfigured) {
            // Sync requires staff permission when permissions are configured
            const hasPermission = await hasStaffPermission(interaction.user.id);
            if (!hasPermission) {
                await interaction.reply({
                    content: "❌ このコマンドを実行する権限がありません。",
                    ephemeral: true,
                });
                return;
            }
        }

        await interaction.deferReply();

        try {
            const result = await syncAllGuilds(client.guilds.cache);
            await interaction.editReply({
                content: `✅ 同期完了: ${result.guilds}サーバー、${result.members}メンバー`,
            });

            // Log sync operation
            await logger.info("メンバー同期実行", {
                discordUser: {
                    id: interaction.user.id,
                    name: interaction.user.username,
                },
                source: "Bot",
                details: `${result.guilds}サーバー、${result.members}メンバーを同期`,
            });
        } catch (error) {
            console.error("Sync error:", error);
            await interaction.editReply({
                content: "❌ 同期中にエラーが発生しました。",
            });
        }
        return;
    }

    // Config, delete, and show require admin permission
    const hasPermission = await hasAdminPermission(interaction.user.id);
    if (!hasPermission) {
        await interaction.reply({
            content: "❌ このコマンドを実行する権限がありません。",
            ephemeral: true,
        });
        return;
    }

    if (subcommand === "config") {
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

        // Log config operation
        await logger.info(`設定${isUpdate ? "更新" : "追加"}`, {
            discordUser: {
                id: interaction.user.id,
                name: interaction.user.username,
            },
            source: "Bot",
            details: `\`${key}\` = \`${value}\`${isUpdate ? ` (旧値: \`${existingConfig?.value}\`)` : ""}`,
        });
    } else if (subcommand === "delete") {
        cleanupPendingDeletes();

        const key = interaction.options.getString("key", true);

        // Check if config exists
        const existingConfig = await prisma.systemConfig.findUnique({ where: { key } });
        if (!existingConfig) {
            await interaction.reply({
                content: `❌ 設定 \`${key}\` は存在しません。`,
                ephemeral: true,
            });
            return;
        }

        // Create confirmation buttons
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

        // Store pending delete info
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
    } else if (subcommand === "show") {
        const configs = await prisma.systemConfig.findMany();

        const configList = configs
            .map((c) => `**${c.key}**: \`${c.value}\``)
            .join("\n");

        const embed = new EmbedBuilder()
            .setTitle("⚙️ システム設定")
            .setColor(0x3b82f6)
            .setDescription(configList || "設定がありません")
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.SuppressNotifications });

        // Log show operation
        await logger.debug("設定一覧表示", {
            discordUser: {
                id: interaction.user.id,
                name: interaction.user.username,
            },
            source: "Bot",
        });
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

    // Check if the same user is clicking the button
    if (pendingDelete.userId !== interaction.user.id) {
        await interaction.reply({
            content: "❌ この操作はコマンドを実行したユーザーのみ行えます。",
            ephemeral: true,
        });
        return true;
    }

    if (customId.startsWith("confirm_delete_")) {
        // Perform delete
        const existingConfig = await prisma.systemConfig.findUnique({ where: { key: pendingDelete.key } });

        await prisma.systemConfig.delete({
            where: { key: pendingDelete.key },
        });

        pendingDeletes.delete(interactionId);

        await interaction.update({
            content: `🗑️ 設定 \`${pendingDelete.key}\` を削除しました。`,
            components: [],
        });

        // Log delete operation
        await logger.warn("設定削除", {
            discordUser: {
                id: interaction.user.id,
                name: interaction.user.username,
            },
            source: "Bot",
            details: `\`${pendingDelete.key}\` = \`${existingConfig?.value}\` を削除`,
        });
    } else {
        // Cancel
        pendingDeletes.delete(interactionId);

        await interaction.update({
            content: "❌ 削除をキャンセルしました。",
            components: [],
        });
    }

    return true;
}

