/**
 * Setup Command Handler
 *
 * Handles /setup command for initial configuration.
 * Permission: Anyone can run if admin_role_ids is not set,
 *             otherwise only users with admin roles can run.
 */

import {
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import prisma from "../../app/lib/prisma";
import logger from "../utils/discordLogger";
import { hasAdminPermission } from "../services/permissionService";
import { validateSnowflakeList } from "../utils/validation";

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
 * Supports optional guild_id to configure remote servers
 */
async function handleTargetGuild(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const enable = interaction.options.getBoolean("enable", true);
    const remoteGuildId = interaction.options.getString("guild_id");
    const targetGuildId = remoteGuildId || interaction.guildId!;

    // Check if guild exists in database
    const guild = await prisma.guild.findUnique({
        where: { guildId: targetGuildId },
    });

    if (!guild) {
        await interaction.reply({
            content: `❌ サーバー \`${targetGuildId}\` はBotが参加していないか、まだ同期されていません。\n先に \`/system sync\` を実行してください。`,
            ephemeral: true,
        });
        return;
    }

    await prisma.guild.update({
        where: { guildId: targetGuildId },
        data: { isTargetGuild: enable },
    });

    const serverName = remoteGuildId ? `\`${targetGuildId}\` (${guild.guildName})` : `${interaction.guild?.name}`;
    await interaction.reply({
        content: `✅ ${serverName} を対象ギルドとして${enable ? "設定" : "解除"}しました`,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info(`対象ギルド${enable ? "設定" : "解除"}`, {
        ...getLogContext(interaction.user),
        details: `サーバー: ${guild.guildName} (${targetGuildId})`,
    });
}

/**
 * Handle /setup operation-server subcommand
 * Supports optional guild_id to configure remote servers
 */
async function handleOperationServer(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const enable = interaction.options.getBoolean("enable", true);
    const remoteGuildId = interaction.options.getString("guild_id");
    const targetGuildId = remoteGuildId || interaction.guildId!;

    // Check if guild exists in database
    const guild = await prisma.guild.findUnique({
        where: { guildId: targetGuildId },
    });

    if (!guild) {
        await interaction.reply({
            content: `❌ サーバー \`${targetGuildId}\` はBotが参加していないか、まだ同期されていません。`,
            ephemeral: true,
        });
        return;
    }

    await prisma.guild.update({
        where: { guildId: targetGuildId },
        data: { isOperationServer: enable },
    });

    const serverName = remoteGuildId ? `\`${targetGuildId}\` (${guild.guildName})` : `${interaction.guild?.name}`;
    await interaction.reply({
        content: `✅ ${serverName} を運営サーバーとして${enable ? "設定" : "解除"}しました`,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info(`運営サーバー${enable ? "設定" : "解除"}`, {
        ...getLogContext(interaction.user),
        details: `サーバー: ${guild.guildName} (${targetGuildId})`,
    });
}

/**
 * Handle /setup admin-roles subcommand
 */
async function handleAdminRoles(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const roles = interaction.options.getString("roles", true);

    const validation = validateSnowflakeList(roles);
    if (!validation.valid) {
        await interaction.reply({
            content: `❌ 無効なID形式です: \`${validation.invalid.join(", ")}\``,
            ephemeral: true,
        });
        return;
    }

    await prisma.systemConfig.upsert({
        where: { key: "admin_role_ids" },
        update: { value: roles },
        create: { key: "admin_role_ids", value: roles, description: "bot管理者ロールID" },
    });

    await interaction.reply({
        content: `✅ bot管理者ロールを設定しました: \`${roles}\`\n⚠️ 以降、/setup コマンドはbot管理者ロール保持者のみ実行可能です`,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info("bot管理者ロール設定", {
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

    const validation = validateSnowflakeList(roles);
    if (!validation.valid) {
        await interaction.reply({
            content: `❌ 無効なID形式です: \`${validation.invalid.join(", ")}\``,
            ephemeral: true,
        });
        return;
    }

    await prisma.systemConfig.upsert({
        where: { key: "staff_role_ids" },
        update: { value: roles },
        create: { key: "staff_role_ids", value: roles, description: "事務局員ロールID" },
    });

    await interaction.reply({
        content: `✅ 事務局員ロールを設定しました: \`${roles}\``,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info("事務局員ロール設定", {
        ...getLogContext(interaction.user),
        details: `ロールID: ${roles}`,
    });
}

/**
 * Handle /setup secretary-roles subcommand
 */
async function handleSecretaryRoles(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const roles = interaction.options.getString("roles", true);

    const validation = validateSnowflakeList(roles);
    if (!validation.valid) {
        await interaction.reply({
            content: `❌ 無効なID形式です: \`${validation.invalid.join(", ")}\``,
            ephemeral: true,
        });
        return;
    }

    await prisma.systemConfig.upsert({
        where: { key: "secretary_role_ids" },
        update: { value: roles },
        create: { key: "secretary_role_ids", value: roles, description: "当セクロールID" },
    });

    await interaction.reply({
        content: `✅ 当セクロールを設定しました: \`${roles}\``,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info("当セクロール設定", {
        ...getLogContext(interaction.user),
        details: `ロールID: ${roles}`,
    });
}

/**
 * Handle /setup organizer-roles subcommand
 * If guild_ids is provided: Create role-guild mapping in OrganizerRoleMapping
 * If guild_ids is omitted: Add to organizer_role_ids in SystemConfig (legacy behavior)
 */
async function handleOrganizerRoles(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    const newRoles = interaction.options.getString("roles", true);
    const guildIds = interaction.options.getString("guild_ids");

    const rolesValidation = validateSnowflakeList(newRoles);
    if (!rolesValidation.valid) {
        await interaction.reply({
            content: `❌ 無効なロールID形式です: \`${rolesValidation.invalid.join(", ")}\``,
            ephemeral: true,
        });
        return;
    }

    if (guildIds) {
        const guildValidation = validateSnowflakeList(guildIds);
        if (!guildValidation.valid) {
            await interaction.reply({
                content: `❌ 無効なサーバーID形式です: \`${guildValidation.invalid.join(", ")}\``,
                ephemeral: true,
            });
            return;
        }
    }

    // If guild_ids is provided, create role-guild mapping
    if (guildIds) {
        const roleIds = newRoles.split(",").map((r) => r.trim());
        const targetGuildIds = guildIds.split(",").map((g) => g.trim()).join(",");

        for (const roleId of roleIds) {
            await prisma.organizerRoleMapping.upsert({
                where: { roleId },
                update: { targetGuildIds },
                create: { roleId, targetGuildIds },
            });
        }

        await interaction.reply({
            content: `✅ 会議フロントマッピングを設定しました:\nロール: \`${newRoles}\`\n対象サーバー: \`${guildIds}\``,
            flags: MessageFlags.SuppressNotifications,
        });

        await logger.info("会議フロントマッピング設定", {
            ...getLogContext(interaction.user),
            details: `ロール: ${newRoles} → サーバー: ${guildIds}`,
        });
        return;
    }

    // Legacy behavior: Add to organizer_role_ids in SystemConfig
    const existing = await prisma.systemConfig.findUnique({
        where: { key: "organizer_role_ids" },
    });

    const combined = existing?.value
        ? `${existing.value},${newRoles}`
        : newRoles;
    const uniqueRoles = [...new Set(combined.split(",").map((r) => r.trim()))].join(",");

    await prisma.systemConfig.upsert({
        where: { key: "organizer_role_ids" },
        update: { value: uniqueRoles },
        create: { key: "organizer_role_ids", value: uniqueRoles, description: "会議フロントロールID" },
    });

    await interaction.reply({
        content: `✅ 会議フロントロールを追加しました: \`${newRoles}\`\n現在の設定: \`${uniqueRoles}\`\n\n💡 特定サーバーに限定する場合は guild_ids オプションを使用してください`,
        flags: MessageFlags.SuppressNotifications,
    });

    await logger.info("会議フロントロール追加", {
        ...getLogContext(interaction.user),
        details: `追加: ${newRoles}, 合計: ${uniqueRoles}`,
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

    const organizerConfig = await prisma.systemConfig.findUnique({
        where: { key: "organizer_role_ids" },
    });

    const secretaryConfig = await prisma.systemConfig.findUnique({
        where: { key: "secretary_role_ids" },
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
                name: "bot管理者ロール",
                value: adminConfig?.value || "未設定",
                inline: false,
            },
            {
                name: "事務局員ロール",
                value: staffConfig?.value || "未設定",
                inline: false,
            },
            {
                name: "会議フロントロール",
                value: organizerConfig?.value || "未設定",
                inline: false,
            },
            {
                name: "当セクロール",
                value: secretaryConfig?.value || "未設定",
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
                content: "❌ このコマンドはbot管理者ロール保持者のみ実行可能です",
                ephemeral: true,
            });
            return;
        }
    } else {
        // No admin roles configured: require Discord Administrator permission
        if (!interaction.memberPermissions?.has("Administrator")) {
            await interaction.reply({
                content: "❌ bot管理者ロールが未設定のため、Discord管理者権限が必要です",
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
        case "secretary-roles":
            await handleSecretaryRoles(interaction);
            break;
        case "organizer-roles":
            await handleOrganizerRoles(interaction);
            break;
        case "status":
            await handleStatus(interaction);
            break;
    }
}

/**
 * Handle autocomplete for setup command
 */
export async function handleSetupAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== "organizer-roles") {
        return;
    }

    const inputValue = focused.value.toLowerCase();

    if (focused.name === "roles") {
        // Suggest roles from the current guild
        const guild = interaction.guild;
        if (!guild) {
            await interaction.respond([]);
            return;
        }

        const roles = guild.roles.cache
            .filter(role =>
                role.name !== "@everyone" &&
                (role.name.toLowerCase().includes(inputValue) || role.id.includes(inputValue))
            )
            .map(role => ({
                name: `@${role.name} (${role.id})`,
                value: role.id,
            }))
            .slice(0, 25);

        await interaction.respond(roles);
    } else if (focused.name === "guild_ids") {
        // Suggest target guilds from database
        const guilds = await prisma.guild.findMany({
            where: { isTargetGuild: true },
            select: { guildId: true, guildName: true },
        });

        const filtered = guilds
            .filter(g =>
                g.guildName.toLowerCase().includes(inputValue) ||
                g.guildId.includes(inputValue)
            )
            .map(g => ({
                name: `${g.guildName} (${g.guildId})`,
                value: g.guildId,
            }))
            .slice(0, 25);

        await interaction.respond(filtered);
    }
}
