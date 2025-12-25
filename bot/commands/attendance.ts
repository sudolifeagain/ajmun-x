import { ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { prisma, getTodayJST, getAttributeLabel } from "../utils";
import { getOrganizerGuildIds } from "../services";

const MAX_DISPLAY = 100;

/**
 * Resolve conference name to guild ID
 * If allowedGuildIds is provided, only those guilds can be resolved
 */
async function resolveConference(
    conference: string | null,
    allowedGuildIds: string[]
): Promise<{
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
            // If allowedGuildIds is specified (organizer), filter by those
            ...(allowedGuildIds.length > 0 && { guildId: { in: allowedGuildIds } }),
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
 * @param allowedGuildIds Empty array = all guilds, non-empty = only those guilds
 */
async function handleStatus(
    interaction: ChatInputCommandInteraction,
    allowedGuildIds: string[]
): Promise<void> {
    const conference = interaction.options.getString("conference");
    const attribute = interaction.options.getString("attribute");
    const today = getTodayJST();

    // For organizers, if no conference specified, force filter to their guilds
    const { guildId: targetGuildId, guildName, error } = await resolveConference(conference, allowedGuildIds);
    if (error) {
        await interaction.reply({ content: `❌ ${error}`, ephemeral: true });
        return;
    }

    // Build guild filter
    let guildFilter: string[] | null = null;
    if (targetGuildId) {
        guildFilter = [targetGuildId];
    } else if (allowedGuildIds.length > 0) {
        guildFilter = allowedGuildIds;
    }

    const presentCount = await prisma.attendanceLog.count({
        where: {
            checkInDate: today,
            ...(attribute && { attribute }),
            ...(guildFilter && { primaryGuildId: { in: guildFilter } }),
        },
    });

    const totalUsers = guildFilter
        ? await prisma.userGuildMembership.count({
            where: {
                guildId: { in: guildFilter },
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
    if (allowedGuildIds.length > 0 && !targetGuildId) {
        embed.setFooter({ text: `対象: ${allowedGuildIds.length}サーバー` });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.SuppressNotifications });
}

/**
 * Handle /attendance present command
 */
async function handlePresent(
    interaction: ChatInputCommandInteraction,
    allowedGuildIds: string[]
): Promise<void> {
    const conference = interaction.options.getString("conference");
    const attribute = interaction.options.getString("attribute");
    const today = getTodayJST();

    const { guildId: targetGuildId, guildName, error } = await resolveConference(conference, allowedGuildIds);
    if (error) {
        await interaction.reply({ content: `❌ ${error}`, ephemeral: true });
        return;
    }

    // Build guild filter
    let guildFilter: string[] | null = null;
    if (targetGuildId) {
        guildFilter = [targetGuildId];
    } else if (allowedGuildIds.length > 0) {
        guildFilter = allowedGuildIds;
    }

    const logs = await prisma.attendanceLog.findMany({
        where: {
            checkInDate: today,
            ...(attribute && { attribute }),
            ...(guildFilter && { primaryGuildId: { in: guildFilter } }),
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
    const userList = displayUsers.map((name) => `• ${name.replace(/_/g, "\\_")}`).join("\n");

    const embed = new EmbedBuilder()
        .setTitle("✅ 本日出席済み")
        .setColor(0x22c55e)
        .setDescription(userList || "まだ誰も出席していません")
        .addFields({ name: "対象日", value: today })
        .setTimestamp();

    const filterDesc = buildFilterDescription(guildName, attribute);
    if (filterDesc) embed.setFooter({ text: remaining > 0 ? `${filterDesc} | 他 ${remaining}人` : filterDesc });
    else if (remaining > 0) embed.setFooter({ text: `他 ${remaining}人` });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.SuppressNotifications });
}

/**
 * Handle /attendance absent command
 */
async function handleAbsent(
    interaction: ChatInputCommandInteraction,
    allowedGuildIds: string[]
): Promise<void> {
    const conference = interaction.options.getString("conference");
    const attribute = interaction.options.getString("attribute");
    const today = getTodayJST();

    const { guildId: targetGuildId, guildName, error } = await resolveConference(conference, allowedGuildIds);
    if (error) {
        await interaction.reply({ content: `❌ ${error}`, ephemeral: true });
        return;
    }

    // Build guild filter
    let guildFilter: string[] | null = null;
    if (targetGuildId) {
        guildFilter = [targetGuildId];
    } else if (allowedGuildIds.length > 0) {
        guildFilter = allowedGuildIds;
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
            ...(guildFilter && {
                guildMemberships: { some: { guildId: { in: guildFilter } } },
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
    const userList = displayUsers.map((name) => `• ${name.replace(/_/g, "\\_")}`).join("\n");

    const embed = new EmbedBuilder()
        .setTitle("❌ 本日未出席")
        .setColor(0xef4444)
        .setDescription(userList || "全員出席済みです")
        .addFields({ name: "対象日", value: today })
        .setTimestamp();

    const filterDesc = buildFilterDescription(guildName, attribute);
    if (filterDesc) embed.setFooter({ text: remaining > 0 ? `${filterDesc} | 他 ${remaining}人` : filterDesc });
    else if (remaining > 0) embed.setFooter({ text: `他 ${remaining}人` });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.SuppressNotifications });
}

/**
 * Handle /attendance command
 */
export async function handleAttendance(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check organizer permission (organizer, staff, or admin)
    const organizerGuildIds = await getOrganizerGuildIds(interaction.user.id);

    if (organizerGuildIds === null) {
        await interaction.reply({
            content: "❌ このコマンドを実行する権限がありません。",
            ephemeral: true,
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    // For organizers (not staff/admin), restrict to their guilds
    // organizerGuildIds is empty for staff/admin (meaning all guilds)
    // organizerGuildIds is an array for organizers (meaning only those guilds)
    switch (subcommand) {
        case "status":
            await handleStatus(interaction, organizerGuildIds);
            break;
        case "present":
            await handlePresent(interaction, organizerGuildIds);
            break;
        case "absent":
            await handleAbsent(interaction, organizerGuildIds);
            break;
    }
}

/**
 * Handle autocomplete for attendance command
 */
export async function handleAttendanceAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === "conference") {
        const organizerGuildIds = await getOrganizerGuildIds(interaction.user.id);

        // If null, user has no permission at all
        if (organizerGuildIds === null) {
            await interaction.respond([]);
            return;
        }

        const searchText = focusedOption.value;
        const whereClause: any = {
            isTargetGuild: true,
            guildName: { contains: searchText },
        };

        // If not empty array (admin/staff), restrict to specific guilds
        if (organizerGuildIds.length > 0) {
            whereClause.guildId = { in: organizerGuildIds };
        }

        try {
            const guilds = await prisma.guild.findMany({
                where: whereClause,
                take: 25, // Discord limits to 25 choices
            });

            await interaction.respond(
                guilds.map((g) => ({ name: g.guildName, value: g.guildName }))
            );
        } catch (error) {
            console.error("Autocomplete error:", error);
            await interaction.respond([]);
        }
    }
}
