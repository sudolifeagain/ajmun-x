import { ChatInputCommandInteraction, EmbedBuilder, Client, MessageFlags } from "discord.js";
import { prisma } from "../utils";
import { syncAllGuilds, hasStaffPermission, hasAdminPermission, arePermissionsConfigured } from "../services";

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
        } catch (error) {
            console.error("Sync error:", error);
            await interaction.editReply({
                content: "❌ 同期中にエラーが発生しました。",
            });
        }
        return;
    }

    // Config and show require admin permission
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

        await prisma.systemConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value, description: "" },
        });

        await interaction.reply({
            content: `✅ 設定を更新しました: \`${key}\` = \`${value}\``,
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
    }
}

