import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { prisma, getTodayJST, getAttributeLabel } from "../utils";
import { hasStaffPermission } from "../services";


const MAX_DISPLAY = 100;

/**
 * Resolve conference name to guild ID
 */
async function resolveConference(conference: string | null): Promise<{
    guildId: string | null;
    guildName: string | null;
    error?: string;
}> {
    if (!conference || conference === "all") {
        return { guildId: null, guildName: null };
    }
    const guild = await prisma.guild.findFirst({
        where: {
            guildName: { contains: conference },
            isTargetGuild: true,
        },
    });
    if (!guild) {
        return { guildId: null, guildName: null, error: `会議「${conference}」が見つかりません` };
    }
    return { guildId: guild.guildId, guildName: guild.guildName };
}

/**
 * Build filter description for embed
 */
function buildFilterDescription(guildName: string | null, attribute: string | null): string | null {
    const filters: string[] = [];
    if (guildName) filters.push(`会議: ${guildName}`);
    if (attribute) filters.push(`属性: ${getAttributeLabel(attribute)}`);
    return filters.length > 0 ? `フィルタ: ${filters.join(" / ")}` : null;
}

/**
 * Handle /attendance status command
 */
async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    const conference = interaction.options.getString("conference");
    const attribute = interaction.options.getString("attribute");
    const today = getTodayJST();

    const { guildId: targetGuildId, guildName, error } = await resolveConference(conference);
    if (error) {
        await interaction.reply({ content: `❌ ${error}`, ephemeral: true });
        return;
    }

    const presentCount = await prisma.attendanceLog.count({
        where: {
            checkInDate: today,
            ...(attribute && { attribute }),
            ...(targetGuildId && { primaryGuildId: targetGuildId }),
        },
    });

    const totalUsers = targetGuildId
        ? await prisma.userGuildMembership.count({
            where: {
                guildId: targetGuildId,
                ...(attribute && { user: { primaryAttribute: attribute } }),
            },
        })
        : await prisma.user.count(
            attribute ? { where: { primaryAttribute: attribute } } : undefined
        );

    const embed = new EmbedBuilder()
        .setTitle("📊 出席状況")
        .setColor(0x5865f2)
        .addFields(
            { name: "出席者数", value: `${presentCount}人`, inline: true },
            { name: "未出席者数", value: `${totalUsers - presentCount}人`, inline: true },
            { name: "対象日", value: today, inline: false }
        )
        .setTimestamp();

    const filterDesc = buildFilterDescription(guildName, attribute);
    if (filterDesc) embed.setDescription(filterDesc);

    await interaction.reply({ embeds: [embed] });
}

/**
 * Handle /attendance present command
 */
async function handlePresent(interaction: ChatInputCommandInteraction): Promise<void> {
    const conference = interaction.options.getString("conference");
    const attribute = interaction.options.getString("attribute");
    const today = getTodayJST();

    const { guildId: targetGuildId, guildName, error } = await resolveConference(conference);
    if (error) {
        await interaction.reply({ content: `❌ ${error}`, ephemeral: true });
        return;
    }

    const logs = await prisma.attendanceLog.findMany({
        where: {
            checkInDate: today,
            ...(attribute && { attribute }),
            ...(targetGuildId && { primaryGuildId: targetGuildId }),
        },
        include: {
            user: { include: { guildMemberships: true } },
        },
    });

    const currentGuildId = interaction.guildId;
    const displayGuildId = targetGuildId || currentGuildId;

    const allUsers = logs.map((log) => {
        let membership = displayGuildId
            ? log.user.guildMemberships.find((m) => m.guildId === displayGuildId)
            : undefined;
        if (!membership && log.primaryGuildId) {
            membership = log.user.guildMemberships.find((m) => m.guildId === log.primaryGuildId);
        }
        return membership?.nickname || log.user.globalName || log.user.discordUserId;
    });

    const displayUsers = allUsers.slice(0, MAX_DISPLAY);
    const remaining = allUsers.length - displayUsers.length;
    const userList = displayUsers.map((name) => `• ${name}`).join("\n");

    const embed = new EmbedBuilder()
        .setTitle("✅ 本日出席済み")
        .setColor(0x22c55e)
        .setDescription(userList || "まだ誰も出席していません")
        .addFields({ name: "対象日", value: today })
        .setTimestamp();

    const filterDesc = buildFilterDescription(guildName, attribute);
    if (filterDesc) embed.setFooter({ text: remaining > 0 ? `${filterDesc} | 他 ${remaining}人` : filterDesc });
    else if (remaining > 0) embed.setFooter({ text: `他 ${remaining}人` });

    await interaction.reply({ embeds: [embed] });
}

/**
 * Handle /attendance absent command
 */
async function handleAbsent(interaction: ChatInputCommandInteraction): Promise<void> {
    const conference = interaction.options.getString("conference");
    const attribute = interaction.options.getString("attribute");
    const today = getTodayJST();

    const { guildId: targetGuildId, guildName, error } = await resolveConference(conference);
    if (error) {
        await interaction.reply({ content: `❌ ${error}`, ephemeral: true });
        return;
    }

    const presentUserIds = (
        await prisma.attendanceLog.findMany({
            where: { checkInDate: today },
            select: { discordUserId: true },
        })
    ).map((log) => log.discordUserId);

    const absentUsers = await prisma.user.findMany({
        where: {
            discordUserId: { notIn: presentUserIds },
            ...(attribute && { primaryAttribute: attribute }),
            ...(targetGuildId && {
                guildMemberships: { some: { guildId: targetGuildId } },
            }),
        },
        include: { guildMemberships: true },
    });

    const currentGuildId = interaction.guildId;
    const displayGuildId = targetGuildId || currentGuildId;

    const allUsers = absentUsers.map((user) => {
        const membership = displayGuildId
            ? user.guildMemberships.find((m) => m.guildId === displayGuildId)
            : undefined;
        return membership?.nickname || user.globalName || user.discordUserId;
    });

    const displayUsers = allUsers.slice(0, MAX_DISPLAY);
    const remaining = allUsers.length - displayUsers.length;
    const userList = displayUsers.map((name) => `• ${name}`).join("\n");

    const embed = new EmbedBuilder()
        .setTitle("❌ 本日未出席")
        .setColor(0xef4444)
        .setDescription(userList || "全員出席済みです")
        .addFields({ name: "対象日", value: today })
        .setTimestamp();

    const filterDesc = buildFilterDescription(guildName, attribute);
    if (filterDesc) embed.setFooter({ text: remaining > 0 ? `${filterDesc} | 他 ${remaining}人` : filterDesc });
    else if (remaining > 0) embed.setFooter({ text: `他 ${remaining}人` });

    await interaction.reply({ embeds: [embed] });
}

/**
 * Handle /attendance command
 */
export async function handleAttendance(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check staff permission
    const hasPermission = await hasStaffPermission(interaction.user.id);
    if (!hasPermission) {
        await interaction.reply({
            content: "❌ このコマンドを実行する権限がありません。",
            ephemeral: true,
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case "status":
            await handleStatus(interaction);
            break;
        case "present":
            await handlePresent(interaction);
            break;
        case "absent":
            await handleAbsent(interaction);
            break;
    }
}
